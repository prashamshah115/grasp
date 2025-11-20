// Edge Function: /rag-chat
// Purpose: Dual-stage RAG retrieval with BGE embeddings (768d) + LLM tutor
// Called by: useRAGChat hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RAGRequest {
  message: string
  topicId?: string
  courseId?: string
  questionId?: string // optional: practice question context
}

interface RAGResponse {
  answer: string
  citations: Array<{
    documentTitle: string
    pageNumber: number
    similarity: number
    docType: string
    publicUrl?: string
  }>
  pages: Array<any>
}

// ------------------------------------------
// EMBEDDING HELPER — Trigger.dev BGE 768d
// ------------------------------------------
async function generateBGEEmbedding(text: string): Promise<number[]> {
  const triggerUrl = Deno.env.get('TRIGGER_API_URL')
  const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

  if (!triggerUrl || !triggerKey) {
    throw new Error('Trigger.dev not configured. Missing TRIGGER_API_URL or TRIGGER_SECRET_KEY')
  }

  try {
    const response = await fetch(`${triggerUrl}/embed-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${triggerKey}`
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Trigger.dev embedding failed: ${err}`)
    }

    const data = await response.json()
    return data.embedding // 768d output
  } catch (error) {
    console.error('[rag-chat] Embedding generation failed:', error)
    throw new Error('Failed to generate BGE embedding')
  }
}

// ------------------------------------------
// LLM HELPER — OpenAI GPT-4 Turbo
// ------------------------------------------
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
      max_tokens: 500
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// ------------------------------------------
// MAIN
// ------------------------------------------
serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auth
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

    // Parse request
    const { message, topicId, courseId, questionId } =
      await req.json() as RAGRequest

    console.log('[rag-chat] Request:', {
      userId: user.id,
      topicId,
      courseId,
      questionId,
      message: message.substring(0, 80)
    })

    // ------------------------------------------
    // STEP 1 — BGE embedding (768d)
    // ------------------------------------------
    console.log('[rag-chat] Generating BGE embedding...')
    const queryEmbedding = await generateBGEEmbedding(message)

    if (queryEmbedding.length !== 768)
      throw new Error(`Invalid embedding dimension: expected 768, got ${queryEmbedding.length}`)

    // ------------------------------------------
    // STEP 2 — VECTOR SEARCH (RPC)
    // ------------------------------------------
    console.log('[rag-chat] Searching documents...')

    const { data: pages, error: searchError } = await supabase.rpc(
      'search_document_pages',
      {
        query_embedding: queryEmbedding,
        filter_course_id: courseId ?? null,
        filter_topic_id: topicId ?? null,
        filter_user_id: user.id,
        match_threshold: 0.7,
        match_count: 10
      }
    )

    if (searchError) {
      console.error('[rag-chat] Vector search error:', searchError)
      throw searchError
    }

    console.log('[rag-chat] Found', pages?.length || 0, 'pages')

    // No matching pages → fallback message
    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "I don't have enough context to answer this yet. Upload course materials or documents for this topic.",
          citations: [],
          pages: []
        } as RAGResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ------------------------------------------
    // STEP 3 — Build LLM context block
    // ------------------------------------------
    const context = pages
      .map(
        (p: any, i: number) =>
          `[Source ${i + 1}: ${p.doc_title}, Page ${p.page_number} (similarity ${(p.similarity * 100).toFixed(1)}%)]\n${p.content}`
      )
      .join('\n\n---\n\n')

    // ------------------------------------------
    // STEP 4 — SYSTEM PROMPT
    // ------------------------------------------
    const systemPrompt = `You are GRASP, an AI tutor for university-level courses.

RULES:
1. Answer ONLY using the provided course materials.
2. Cite sources using "[Source 1]" etc.
3. If context is missing: say "Not covered in the provided materials."
4. Keep answers concise and technically correct.
5. NO hallucination.

CONTEXT:
${context}
`

    // ------------------------------------------
    // STEP 5 — LLM call
    // ------------------------------------------
    console.log('[rag-chat] Calling LLM…')
    const answer = await callLLM(systemPrompt, message)

    // ------------------------------------------
    // STEP 6 — format citations for UI
    // ------------------------------------------
    const citations = pages.map((p: any) => ({
      documentTitle: p.doc_title,
      pageNumber: p.page_number,
      similarity: p.similarity,
      docType: p.doc_type,
      publicUrl: p.public_url
    }))

    console.log('[rag-chat] Success')

    // ------------------------------------------
    // RETURN
    // ------------------------------------------
    return new Response(
      JSON.stringify({
        answer,
        citations,
        pages: pages.slice(0, 5)
      } as RAGResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type'
        }
      }
    )

  } catch (error: any) {
    console.error('[rag-chat] Error:', error)
    return new Response(
      JSON.stringify({
        error: error?.message ?? 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
