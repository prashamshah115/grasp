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
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { topicId } = await req.json() as CompressionRequest
    console.log('[generate-compression] Request:', { userId: user.id, topicId })

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
      return new Response(
        JSON.stringify({
          error: 'NoContentFound',
          message: 'No documents found for this topic. Upload course materials first.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
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
      .map((p: any) =>
        `[${p.documents.title}, p.${p.page_number}]\n${p.content.substring(0, 2000)}`
      )
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

  } catch (error: any) {
    console.error('[generate-compression] Error:', error)
    return new Response(
      JSON.stringify({
        error: error?.message ?? 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
