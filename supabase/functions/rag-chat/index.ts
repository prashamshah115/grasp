// Edge Function: /rag-chat
// Purpose: Dual-stage RAG retrieval with BGE embeddings (768d) + LLM tutor
// Called by: useRAGChat hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RAGRequest {
  message: string
  topicId?: string
  courseId?: string
  questionId?: string // Optional: current practice question context
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

// Helper: Generate BGE embedding via Trigger.dev or direct API
async function generateBGEEmbedding(text: string): Promise<number[]> {
  const triggerUrl = Deno.env.get('TRIGGER_API_URL')
  const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

  if (!triggerUrl || !triggerKey) {
    throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
  }

  try {
    // Call Trigger.dev embed-text endpoint
    const response = await fetch(`${triggerUrl}/embed-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${triggerKey}`
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error(`Trigger.dev embedding failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.embedding // 768d vector from BGE
  } catch (error) {
    console.error('[rag-chat] Embedding generation failed:', error)
    throw new Error('Failed to generate query embedding')
  }
}

// Helper: Call OpenAI (or any LLM)
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
      max_tokens: 500
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
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { message, topicId, courseId, questionId } = await req.json() as RAGRequest

    console.log('[rag-chat] Request:', {
      userId: user.id,
      topicId,
      courseId,
      questionId,
      message: message.substring(0, 100)
    })

    // STEP 1: Generate query embedding using BGE (768d)
    console.log('[rag-chat] Generating BGE embedding...')
    const queryEmbedding = await generateBGEEmbedding(message)

    if (queryEmbedding.length !== 768) {
      throw new Error(`Invalid embedding dimension: expected 768, got ${queryEmbedding.length}`)
    }

    // STEP 2: Vector search using RPC (searches page_embeddings_v2 with 768d)
    console.log('[rag-chat] Searching documents...')
    const { data: pages, error: searchError } = await supabase.rpc(
      'search_document_pages',
      {
        query_embedding: queryEmbedding,
        filter_course_id: courseId || null,
        filter_topic_id: topicId || null,
        filter_user_id: user.id, // Include user's own docs + admin docs
        match_threshold: 0.7,
        match_count: 10
      }
    )

    if (searchError) {
      console.error('[rag-chat] Search error:', searchError)
      throw searchError
    }

    console.log('[rag-chat] Found', pages?.length || 0, 'matching pages')

    // STEP 3: Handle no results
    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I don't have enough context to answer this question. Try uploading relevant course materials first.",
          citations: [],
          pages: []
        } as RAGResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 4: Build context for LLM
    const context = pages.map((p, i) =>
      `[Source ${i + 1}: ${p.doc_title}, Page ${p.page_number} (similarity: ${(p.similarity * 100).toFixed(1)}%)]\n${p.content}`
    ).join('\n\n---\n\n')

    // STEP 5: Build system prompt
    const systemPrompt = `You are GRASP, an AI study tutor for university courses.

RULES:
1. Answer ONLY using the provided context from course materials
2. Always cite sources like "[Source 1]" or "[Source 2]"
3. Be concise (<200 words unless asked for more)
4. If information is missing, say "Not covered in the provided materials"
5. Use technical accuracy appropriate for university students

CONTEXT FROM COURSE MATERIALS:
${context}`

    // STEP 6: Call LLM
    console.log('[rag-chat] Calling LLM...')
    const answer = await callLLM(systemPrompt, message)

    // STEP 7: Format citations
    const citations = pages.map(p => ({
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
      } as RAGResponse),
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
    console.error('[rag-chat] Error:', error)
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
