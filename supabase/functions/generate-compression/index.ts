// Edge Function: /generate-compression
// Purpose: Generate AI study notes (10-20 bullets) for a topic
// Called by: useGenerateCompression hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CompressionRequest {
  topicId: string
}

interface CompressionResponse {
  success: boolean
  content: string
  sourceCount: number
}

// Helper: Call OpenAI for compression generation
async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
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
  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { topicId } = await req.json() as CompressionRequest

    console.log('[generate-compression] Request:', { userId: user.id, topicId })

    // STEP 1: Get all pages for this topic (user's + admin docs)
    const { data: pages, error: pagesError } = await supabase
      .from('document_pages')
      .select(`
        content,
        page_number,
        documents!inner(
          id,
          title,
          doc_type,
          topic_id,
          owner_user_id
        )
      `)
      .eq('documents.topic_id', topicId)
      .or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`, { foreignTable: 'documents' })
      .order('documents.id', { ascending: true })
      .order('page_number', { ascending: true })
      .limit(50) // Max 50 pages for context

    if (pagesError) {
      console.error('[generate-compression] Pages error:', pagesError)
      throw pagesError
    }

    console.log('[generate-compression] Found', pages?.length || 0, 'pages')

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'NoContentFound',
          message: 'No documents found for this topic. Upload course materials first.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 2: Get practice questions for context
    const { data: questions } = await supabase
      .from('questions')
      .select('prompt')
      .eq('topic_id', topicId)
      .limit(20)

    const questionList = questions?.map(q => `- ${q.prompt}`).join('\n') || 'No questions available.'

    console.log('[generate-compression] Found', questions?.length || 0, 'questions')

    // STEP 3: Aggregate content (truncate to avoid token limits)
    const content = pages.map(p =>
      `[${p.documents.title}, p.${p.page_number}]\n${p.content.substring(0, 2000)}`
    ).join('\n\n---\n\n')

    // STEP 4: Build system prompt
    const systemPrompt = `You are creating ultra-dense exam prep notes for a university course.

TOPIC QUESTIONS (what students will be tested on):
${questionList}

SOURCE MATERIAL:
${content}

TASK:
Generate 10-20 bullet points that:
1. Answer the question types above
2. Include key definitions, algorithms, equations
3. Focus on exam-critical content only
4. Are dense but clear (each bullet = 1-2 sentences)

FORMAT:
- Use markdown bullets only
- No intro/outro text
- Start directly with content
- Use **bold** for key terms
- Use code blocks for algorithms/formulas`

    // STEP 5: Generate compression
    console.log('[generate-compression] Calling LLM...')
    const compressionContent = await callLLM(systemPrompt, 'Generate the compression notes now.')

    // STEP 6: Save to database
    const { error: saveError } = await supabase
      .from('compression_notes')
      .upsert({
        user_id: user.id,
        topic_id: topicId,
        content_md: compressionContent,
        source_pages: pages.map(p => p.documents.id),
        generated_at: new Date().toISOString(),
        is_ai_generated: true
      })

    if (saveError) {
      console.error('[generate-compression] Save error:', saveError)
      throw saveError
    }

    console.log('[generate-compression] Success')

    return new Response(
      JSON.stringify({
        success: true,
        content: compressionContent,
        sourceCount: pages.length
      } as CompressionResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        }
      }
    )

  } catch (error) {
    console.error('[generate-compression] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
