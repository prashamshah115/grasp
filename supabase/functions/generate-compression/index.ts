import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rate-limit.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  NotFoundError,
  isValidUUID,
} from '../_shared/errors.ts'

interface CompressionRequest {
  topicId: string
}

interface CompressionResponse {
  success: boolean
  content: string
  sourceCount: number
}

// Helper: Call OpenAI LLM
async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

serve(async (req) => {
  const FUNCTION_NAME = 'generate-compression'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Authenticate user (uses centralized error handling with CORS)
    const { user } = await requireAuth(req, supabase)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.generate_compression)
    if (!rateLimitResult.allowed) {
      console.log(`[${FUNCTION_NAME}] Rate limit exceeded for user:`, user.id)
      return rateLimitResponse(rateLimitResult)
    }

    console.log(`[${FUNCTION_NAME}] Rate limit OK - remaining:`, rateLimitResult.remaining)

    // Safe JSON parsing with error handling
    let body: CompressionRequest
    try {
      body = await req.json() as CompressionRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Input validation
    if (!body.topicId || typeof body.topicId !== 'string') {
      throw new ValidationError('topicId is required and must be a string')
    }

    if (!isValidUUID(body.topicId)) {
      throw new ValidationError('topicId must be a valid UUID')
    }

    const { topicId } = body
    console.log(`[${FUNCTION_NAME}] Request:`, { userId: user.id, topicId })

    // STEP 1: Grab all document pages for this topic (admin + user docs)
    const { data: pages, error: pagesError } = await supabase
      .from('document_pages')
      .select(`
        content,
        page_number,
        documents!inner(
          id,
          title,
          topic_id,
          owner_user_id
        )
      `)
      .eq('documents.topic_id', topicId)
      .or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`, { foreignTable: 'documents' })
      .order('documents.id', { ascending: true })
      .order('page_number', { ascending: true })
      .limit(50)

    if (pagesError) throw pagesError
    if (!pages || pages.length === 0) {
      throw new NotFoundError('No documents found for this topic. Upload course materials first.')
    }

    console.log('[generate-compression] Found', pages.length, 'pages')

    // STEP 2: Fetch questions for context
    const { data: questions } = await supabase
      .from('questions')
      .select('prompt')
      .eq('topic_id', topicId)
      .limit(20)

    const questionList =
      questions?.map((q: any) => `- ${q.prompt}`).join('\n') ||
      'No questions available.'

    console.log('[generate-compression] Questions:', questions?.length ?? 0)

    // STEP 3: Aggregate & truncate content
    const content = pages
      .map((p: any) => {
        const pageContent = p.content || ''
        return `[${p.documents.title}, p.${p.page_number}]\n${pageContent.substring(0, 2000)}`
      })
      .join('\n\n---\n\n')

    // STEP 4: Build LLM system prompt
    const systemPrompt = `
You are creating ultra-dense, exam-optimized compression notes.

TOPIC QUESTIONS:
${questionList}

SOURCE MATERIAL:
${content}

TASK:
Generate 10–20 bullet points with:
- Key formulas
- Core definitions
- Algorithms
- Pitfalls
- Exam-critical facts

FORMAT:
- Markdown bullets
- No intro/outro
- Bold key terms
- Use code blocks for formulas
`

    // STEP 5: Generate via LLM
    console.log('[generate-compression] Calling LLM…')
    const compressionContent = await callLLM(systemPrompt, 'Generate the compression notes.')

    // STEP 6: Save to DB
    const { error: saveError } = await supabase
      .from('compression_notes')
      .upsert({
        user_id: user.id,
        topic_id: topicId,
        content_md: compressionContent,
        source_pages: pages.map((p: any) => p.documents.id),
        generated_at: new Date().toISOString(),
        is_ai_generated: true
      })

    if (saveError) throw saveError

    console.log(`[${FUNCTION_NAME}] Success`)

    return successResponse({
      success: true,
      content: compressionContent,
      sourceCount: pages.length
    } as CompressionResponse)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
