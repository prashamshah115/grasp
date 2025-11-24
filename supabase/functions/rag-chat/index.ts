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
    console.log(`[${FUNCTION_NAME}] Request received:`, {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    })

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
      const rawBody = await req.text()
      console.log(`[${FUNCTION_NAME}] Raw request body:`, rawBody.substring(0, 200))
      body = JSON.parse(rawBody) as RAGRequest
      console.log(`[${FUNCTION_NAME}] Parsed body:`, {
        message: body.message?.substring(0, 50),
        topicId: body.topicId,
        courseId: body.courseId,
        questionId: body.questionId,
      })
    } catch (error) {
      console.error(`[${FUNCTION_NAME}] JSON parse error:`, error)
      throw new ValidationError(`Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Input validation
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      throw new ValidationError('Message is required and cannot be empty')
    }

    const { message, topicId, courseId, questionId } = body

    // Convert empty strings to null for UUID fields
    const normalizedTopicId = topicId && topicId.trim() !== '' ? topicId : null
    const normalizedCourseId = courseId && courseId.trim() !== '' ? courseId : null
    const normalizedQuestionId = questionId && questionId.trim() !== '' ? questionId : null

    console.log(`[${FUNCTION_NAME}] Request:`, {
      userId: user.id,
      topicId: normalizedTopicId,
      courseId: normalizedCourseId,
      questionId: normalizedQuestionId,
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

    // Check if user is enrolled in the course (if courseId provided)
    let isEnrolled = false
    if (normalizedCourseId) {
      const { data: enrollment } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id)
        .eq('course_id', normalizedCourseId)
        .maybeSingle()
      isEnrolled = !!enrollment
      console.log(`[rag-chat] User enrollment check for course ${normalizedCourseId}:`, isEnrolled)
    }

    // Try vector search - RLS policies will handle access control
    // The RPC function should return documents where user has access (public, own, or enrolled course)
    let { data: pages, error: searchError } = await supabase.rpc(
      'search_document_pages',
      {
        query_embedding: queryEmbedding,
        filter_course_id: normalizedCourseId,
        filter_topic_id: normalizedTopicId,
        filter_user_id: user.id, // Pass user ID but RLS will allow access to public/enrolled docs
        match_threshold: 0.6, // Lower threshold to get more results
        match_count: 15 // Increase count
      }
    )

    if (searchError) {
      console.error('[rag-chat] Vector search error:', searchError)
      // Log but don't throw - will check for documents below
    }

    console.log('[rag-chat] Found', pages?.length || 0, 'pages')

    // No matching pages → check if documents exist for this course/topic
    if (!pages || pages.length === 0) {
      // Check if documents exist at all for this course/topic (RLS will filter automatically)
      let docCheckQuery = supabase
        .from('documents')
        .select('id, title, course_id, topic_id, owner_user_id')
        .limit(5)

      if (normalizedCourseId) {
        docCheckQuery = docCheckQuery.eq('course_id', normalizedCourseId)
      }
      if (normalizedTopicId) {
        docCheckQuery = docCheckQuery.eq('topic_id', normalizedTopicId)
      }

      const { data: docCheck, error: docCheckError } = await docCheckQuery

      console.log(`[rag-chat] Document check: found ${docCheck?.length || 0} documents`, {
        courseId,
        topicId,
        isEnrolled,
        error: docCheckError?.message
      })

      if (docCheck && docCheck.length > 0) {
        // Documents exist but no matching embeddings - might need processing
        return successResponse({
          answer:
            "I found course materials but couldn't match them to your question. This might mean:\n\n1. Documents are still being processed (embeddings not generated yet)\n2. Your question doesn't match the content closely enough\n3. Try rephrasing your question or wait a few minutes for processing to complete.",
          citations: [],
          pages: []
        } as RAGResponse)
      }

      return successResponse({
        answer:
          "I don't have enough context to answer this yet. Please upload course materials or documents for this topic. Once uploaded, documents will be processed automatically.",
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
    
    if (normalizedCourseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('name, code')
        .eq('id', normalizedCourseId)
        .single()
      if (course) {
        courseName = `${course.code}: ${course.name}`
      }
    }
    
    if (normalizedTopicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('name')
        .eq('id', normalizedTopicId)
        .single()
      if (topic) {
        topicName = topic.name
      }
    }
    
    if (normalizedQuestionId) {
      const { data: question } = await supabase
        .from('questions')
        .select('prompt')
        .eq('id', normalizedQuestionId)
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
    console.error(`[${FUNCTION_NAME}] Unhandled error:`, error)
    console.error(`[${FUNCTION_NAME}] Error stack:`, error instanceof Error ? error.stack : 'No stack')
    return handleError(error, FUNCTION_NAME)
  }
})
