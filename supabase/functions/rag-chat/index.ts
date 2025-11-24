// Edge Function: /rag-chat
// Purpose: Dual-stage RAG retrieval with BGE embeddings (768d) + LLM tutor
// Called by: useRAGChat hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rate-limit.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
} from '../_shared/errors.ts'

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
// EMBEDDING HELPER — Jina API (BGE-compatible, 768d)
// ------------------------------------------
async function generateBGEEmbedding(text: string): Promise<number[]> {
  const jinaApiKey = Deno.env.get('JINA_API_KEY')
  
  if (!jinaApiKey) {
    throw new Error('JINA_API_KEY not configured')
  }

  try {
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jinaApiKey}`
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v2-base-en', // BGE-compatible, 768 dimensions
        input: [text] // Single query text
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Jina API error: ${response.status} - ${err}`)
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    if (!embedding || embedding.length !== 768) {
      throw new Error(`Invalid embedding: expected 768d, got ${embedding?.length || 0}`)
    }

    return embedding
  } catch (error) {
    console.error('[rag-chat] Embedding generation failed:', error)
    throw new Error(`Failed to generate BGE embedding: ${(error as Error).message}`)
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
      temperature: 0.4, // Slightly higher for more natural, varied explanations
      max_tokens: 1500, // Increased for comprehensive explanations
      top_p: 0.9, // Nucleus sampling for better quality
      frequency_penalty: 0.1, // Reduce repetition
      presence_penalty: 0.1 // Encourage diverse topics
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
  const FUNCTION_NAME = 'rag-chat'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user and get properly configured Supabase client
    // This uses the CORRECT Supabase v2 pattern for Edge Functions
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.rag_chat)
    if (!rateLimitResult.allowed) {
      console.log(`[${FUNCTION_NAME}] Rate limit exceeded for user:`, user.id)
      return rateLimitResponse(rateLimitResult)
    }

    console.log(`[${FUNCTION_NAME}] Rate limit OK - remaining:`, rateLimitResult.remaining)

    // Safe JSON parsing with error handling
    let body: RAGRequest
    try {
      body = await req.json() as RAGRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Input validation
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      throw new ValidationError('Message is required and cannot be empty')
    }

    const { message, topicId, courseId, questionId } = body

    console.log(`[${FUNCTION_NAME}] Request:`, {
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
      return successResponse({
        answer:
          "I don't have enough context to answer this yet. Upload course materials or documents for this topic.",
        citations: [],
        pages: []
      } as RAGResponse)
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
    // STEP 4 — ENHANCED SYSTEM PROMPT WITH CONTEXT AWARENESS
    // ------------------------------------------
    
    // Fetch course and topic names for better context
    let courseName = null
    let topicName = null
    let questionPrompt = null
    
    if (courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('name, code')
        .eq('id', courseId)
        .single()
      if (course) {
        courseName = `${course.code}: ${course.name}`
      }
    }
    
    if (topicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('name')
        .eq('id', topicId)
        .single()
      if (topic) {
        topicName = topic.name
      }
    }
    
    if (questionId) {
      const { data: question } = await supabase
        .from('questions')
        .select('prompt')
        .eq('id', questionId)
        .single()
      if (question) {
        questionPrompt = question.prompt
      }
    }
    
    // Build context-aware system prompt based on available information
    let contextInfo = ''
    if (courseName) {
      contextInfo += `\nCURRENT COURSE: ${courseName}`
    }
    if (topicName) {
      contextInfo += `\nCURRENT TOPIC: ${topicName}`
    }
    if (questionPrompt) {
      contextInfo += `\nCURRENT QUESTION: ${questionPrompt.substring(0, 200)}${questionPrompt.length > 200 ? '...' : ''}`
    }
    
    const systemPrompt = `You are GRASP, an advanced AI tutor specialized in university-level course instruction. Your role is to help students understand complex concepts through clear, structured explanations grounded in their course materials.

CORE PRINCIPLES:
1. **Ground Truth First**: Answer ONLY using the provided course materials. Never invent information or make assumptions beyond what's explicitly stated.
2. **Progressive Disclosure**: Start with the core concept, then build complexity. Use analogies and examples when helpful.
3. **Active Learning**: Encourage understanding over memorization. Ask clarifying questions when appropriate.
4. **Citation Integrity**: Always cite sources using "[Source 1]", "[Source 2]" format. Include page numbers and document titles.
5. **Honest Limitations**: If information is missing or unclear, explicitly state: "This isn't fully covered in the provided materials. You may want to consult [specific source] or ask your instructor."

RESPONSE GUIDELINES:
- **Structure**: Use clear headings, bullet points, and numbered lists for complex topics
- **Depth**: Provide comprehensive explanations that build from fundamentals to advanced concepts
- **Clarity**: Avoid jargon without explanation. Define technical terms on first use.
- **Examples**: Include concrete examples, analogies, or visual descriptions when helpful
- **Connections**: Link concepts to related topics when relevant
- **Actionability**: When appropriate, suggest practice problems or study strategies

CONTEXT AWARENESS:
${contextInfo}

COURSE MATERIALS PROVIDED:
${context}

IMPORTANT:
- If the user's question requires information not in the provided materials, acknowledge this clearly
- If multiple sources conflict, mention this and explain the differences
- If a concept builds on prerequisite knowledge, briefly review those foundations
- Maintain a supportive, encouraging tone while being academically rigorous
- Adapt your explanation depth based on the complexity of the question

Remember: Your goal is to help students achieve deep understanding, not just provide quick answers.`

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

    console.log(`[${FUNCTION_NAME}] Success`)

    // Return success response with CORS headers
    return successResponse({
      answer,
      citations,
      pages: pages.slice(0, 5)
    } as RAGResponse)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
