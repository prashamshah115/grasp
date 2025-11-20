import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RAGRequest {
  message: string
  topicId?: string
  courseId?: string
}

// Helper to generate embedding using Trigger.dev worker or Jina AI
async function generateEmbedding(text: string): Promise<number[]> {
  // Option 1: Call Jina AI directly for bge-base-en-v1.5 embeddings
  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('JINA_API_KEY')}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v2-base-en',
      input: [text]
    })
  })
  const data = await response.json()
  return data.data[0].embedding // 768d vector from bge-base-en-v1.5
}

// Helper to call OpenAI (or any LLM)
async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { message, topicId, courseId } = await req.json() as RAGRequest

    console.log('[rag-chat] Request:', { userId: user.id, topicId, courseId, message: message.substring(0, 100) })

    // STEP 1: Generate query embedding
    console.log('[rag-chat] Generating embedding...')
    const queryEmbedding = await generateEmbedding(message)

    // STEP 2: Vector search
    console.log('[rag-chat] Searching documents...')
    const { data: pages, error: searchError } = await supabase.rpc(
      'search_document_pages',
      {
        query_embedding: queryEmbedding,
        filter_course_id: courseId || null,
        filter_topic_id: topicId || null,
        filter_user_id: user.id,
        match_threshold: 0.7,
        match_count: 10
      }
    )

    if (searchError) {
      console.error('[rag-chat] Search error:', searchError)
      throw searchError
    }

    console.log('[rag-chat] Found', pages?.length || 0, 'matching pages')

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I don't have enough context to answer this question. Try uploading relevant course materials first.",
          citations: [],
          pages: []
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 3: Build context for LLM
    const context = pages.map((p: any, i: number) =>
      `[Source ${i + 1}: ${p.doc_title}, Page ${p.page_number} (similarity: ${(p.similarity * 100).toFixed(1)}%)]\n${p.content}`
    ).join('\n\n---\n\n')

    // STEP 4: Build system prompt
    const systemPrompt = `You are GRASP, an AI study tutor for university courses.

RULES:
1. Answer ONLY using the provided context from course materials
2. Always cite sources like "[Source 1]" or "[Source 2]"
3. Be concise (<200 words unless asked for more)
4. If information is missing, say "Not covered in the provided materials"
5. Use technical accuracy appropriate for university students

CONTEXT FROM COURSE MATERIALS:
${context}`

    // STEP 5: Call LLM
    console.log('[rag-chat] Calling LLM...')
    const answer = await callLLM(systemPrompt, message)

    // STEP 6: Format citations
    const citations = pages.map((p: any) => ({
      documentTitle: p.doc_title,
      pageNumber: p.page_number,
      similarity: p.similarity,
      docType: p.doc_type,
      publicUrl: p.public_url
    }))

    console.log('[rag-chat] Success')

    return new Response(
      JSON.stringify({
        answer,
        citations,
        pages: pages.slice(0, 5) // Top 5 for reference
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[rag-chat] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
