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
import {
  logFunctionStart,
  logFunctionEnd,
  logQuery,
  logApiCall,
  logError,
  logValidationError,
  createTimer,
} from '../_shared/logger.ts'

interface RAGRequest {
  message: string
  topicId?: string
  courseId?: string
  questionId?: string // optional: practice question context
  thread_id?: string // optional: existing thread ID for persistence
}

interface RAGResponse {
  answer: string
  thread_id?: string // thread ID for persistence
  message_id?: string // assistant message ID
  user_message_id?: string // user message ID
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
// THREAD PERSISTENCE HELPERS
// ------------------------------------------
async function getOrCreateThread(
  supabase: any,
  userId: string,
  courseId: string | null,
  topicId: string | null,
  existingThreadId?: string
): Promise<string | null> {
  try {
    // If thread ID provided, verify it exists and belongs to user
    if (existingThreadId) {
      const { data: thread } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', existingThreadId)
        .eq('user_id', userId)
        .single()
      
      if (thread) return thread.id
    }

    // Try to find existing active thread for this user + topic
    if (topicId) {
      const { data: existing } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', userId)
        .eq('topic_id', topicId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        console.log('[rag-chat] Found existing thread:', existing.id)
        return existing.id
      }
    }

    // Create new thread
    const { data: newThread, error } = await supabase
      .from('chat_threads')
      .insert({
        user_id: userId,
        course_id: courseId,
        topic_id: topicId,
        model: 'gpt-4-turbo-preview',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[rag-chat] Failed to create thread:', error)
      return null
    }

    console.log('[rag-chat] Created new thread:', newThread.id)
    return newThread.id
  } catch (err) {
    console.error('[rag-chat] Thread error:', err)
    return null
  }
}

async function saveMessage(
  supabase: any,
  threadId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        user_id: userId,
        role,
        content,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[rag-chat] Failed to save message:', error)
      return null
    }

    return data.id
  } catch (err) {
    console.error('[rag-chat] Message save error:', err)
    return null
  }
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
async function callLLM(
  systemPrompt: string, 
  userMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Please set this environment variable in Supabase Edge Functions secrets.')
  }

  // Build messages array with conversation history
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt }
  ]
  
  // Add conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    })
  }
  
  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview', // Use valid OpenAI model
        messages: messages,
        temperature: 0.3, // Lower for more focused responses
        max_tokens: 400, // Shorter, concise answers
        top_p: 0.9,
        frequency_penalty: 0.2,
        presence_penalty: 0.1
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      let errMessage = `OpenAI API error: ${response.status}`
      try {
        const errJson = JSON.parse(errText)
        errMessage = errJson.error?.message || errMessage
      } catch {
        errMessage = `${errMessage} - ${errText.substring(0, 200)}`
      }
      
      // Provide helpful error messages for common issues
      if (response.status === 401) {
        throw new Error('OpenAI API key is invalid. Please check your OPENAI_API_KEY configuration.')
      } else if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.')
      } else if (response.status === 500 || response.status === 503) {
        throw new Error('OpenAI API is temporarily unavailable. Please try again later.')
      }
      
      throw new Error(errMessage)
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API')
    }
    
    return data.choices[0].message.content
  } catch (error) {
    if (error instanceof Error && error.message.includes('OpenAI')) {
      throw error // Re-throw OpenAI-specific errors
    }
    throw new Error(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// ------------------------------------------
// MAIN
// ------------------------------------------
serve(async (req) => {
  const FUNCTION_NAME = 'rag-chat'
  const timer = createTimer(FUNCTION_NAME)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    logFunctionStart(FUNCTION_NAME, {
      method: req.method,
      url: req.url,
    })

    // Authenticate user and get properly configured Supabase client
    // This uses the CORRECT Supabase v2 pattern for Edge Functions
    timer.checkpoint('auth_start')
    const { supabase, user } = await requireAuth(req)
    timer.checkpoint('auth_complete', { userId: user.id })

    // Rate limiting check
    timer.checkpoint('rate_limit_start')
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.rag_chat)
    if (!rateLimitResult.allowed) {
      logError(FUNCTION_NAME, new Error('Rate limit exceeded'), {
        userId: user.id,
        remaining: rateLimitResult.remaining,
      })
      timer.end({ success: false, reason: 'rate_limit' })
      return rateLimitResponse(rateLimitResult)
    }
    timer.checkpoint('rate_limit_ok', { remaining: rateLimitResult.remaining })

    // Safe JSON parsing with error handling
    timer.checkpoint('parse_start')
    let body: RAGRequest
    try {
      const rawBody = await req.text()
      body = JSON.parse(rawBody) as RAGRequest
      timer.checkpoint('parse_complete', {
        messageLength: body.message?.length || 0,
        hasTopicId: !!body.topicId,
        hasCourseId: !!body.courseId,
        hasQuestionId: !!body.questionId,
      })
    } catch (error) {
      logError(FUNCTION_NAME, error, { step: 'json_parse' })
      timer.end({ success: false, reason: 'parse_error' })
      throw new ValidationError(`Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Input validation
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      logValidationError(FUNCTION_NAME, 'message', body.message, 'Message is required and cannot be empty', {
        userId: user.id,
      })
      timer.end({ success: false, reason: 'validation_error' })
      throw new ValidationError('Message is required and cannot be empty')
    }

    const { message, topicId, courseId, questionId, thread_id } = body

    // Convert empty strings to null for UUID fields
    const normalizedTopicId = topicId && topicId.trim() !== '' ? topicId : null
    const normalizedCourseId = courseId && courseId.trim() !== '' ? courseId : null
    const normalizedQuestionId = questionId && questionId.trim() !== '' ? questionId : null

    console.log(`[${FUNCTION_NAME}] Request:`, {
      userId: user.id,
      topicId: normalizedTopicId,
      courseId: normalizedCourseId,
      questionId: normalizedQuestionId,
      threadId: thread_id,
      message: message.substring(0, 80)
    })

    // ------------------------------------------
    // THREAD PERSISTENCE (non-blocking)
    // ------------------------------------------
    let threadId: string | null = null
    let userMessageId: string | null = null
    
    // Try to get or create thread (don't fail if this errors)
    threadId = await getOrCreateThread(
      supabase,
      user.id,
      normalizedCourseId,
      normalizedTopicId,
      thread_id
    )
    
    // Save user message if we have a thread
    if (threadId) {
      userMessageId = await saveMessage(supabase, threadId, user.id, 'user', message)
    }

    // ------------------------------------------
    // STEP 0 — FETCH QUESTION CONTEXT FIRST (if questionId provided)
    // ------------------------------------------
    let questionPrompt: string | null = null
    if (normalizedQuestionId) {
      console.log(`[rag-chat] Fetching question context for: ${normalizedQuestionId}`)
      const { data: question } = await supabase
        .from('questions')
        .select('prompt')
        .eq('id', normalizedQuestionId)
        .maybeSingle()
      if (question) {
        questionPrompt = question.prompt || null
        console.log(`[rag-chat] Question context loaded:`, {
          prompt: questionPrompt ? questionPrompt.substring(0, 100) : null
        })
      } else {
        console.warn(`[rag-chat] Question not found: ${normalizedQuestionId}`)
      }
    }

    // ------------------------------------------
    // STEP 1 — BGE embedding (768d)
    // ------------------------------------------
    timer.checkpoint('embedding_start')
    let queryEmbedding: number[]
    try {
      const embeddingStartTime = Date.now()
      queryEmbedding = await generateBGEEmbedding(message)
      const embeddingDuration = Date.now() - embeddingStartTime
      
      if (queryEmbedding.length !== 768) {
        throw new Error(`Invalid embedding dimension: expected 768, got ${queryEmbedding.length}`)
      }
      
      logApiCall(FUNCTION_NAME, 'generateBGEEmbedding', true, embeddingDuration, undefined, {
        userId: user.id,
        embeddingDimension: queryEmbedding.length,
      })
      timer.checkpoint('embedding_complete', { dimension: queryEmbedding.length })
    } catch (error) {
      logError(FUNCTION_NAME, error, { step: 'embedding', userId: user.id })
      timer.end({ success: false, reason: 'embedding_error' })
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`)
    }

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
    timer.checkpoint('vector_search_start')
    let pages: any[] | null = null
    let searchError: any = null
    
    try {
      const searchStartTime = Date.now()
      const result = await supabase.rpc(
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
      const searchDuration = Date.now() - searchStartTime
      
      pages = result.data
      searchError = result.error
      
      logQuery(FUNCTION_NAME, 'search_document_pages', {
        count: pages?.length || 0,
        error: searchError,
      }, {
        userId: user.id,
        courseId: normalizedCourseId,
        topicId: normalizedTopicId,
        duration: searchDuration,
      })
      
      if (searchError) {
        logError(FUNCTION_NAME, searchError, {
          step: 'vector_search',
          userId: user.id,
          courseId: normalizedCourseId,
        })
        // Don't throw - continue with empty results, LLM can still help
      }
      
      timer.checkpoint('vector_search_complete', { pageCount: pages?.length || 0 })
    } catch (error) {
      logError(FUNCTION_NAME, error, { step: 'vector_search_exception', userId: user.id })
      // Continue with empty pages - graceful degradation
      pages = null
    }

    // ------------------------------------------
    // STEP 2.5 — SEARCH EXTERNAL RESULTS (web content)
    // ------------------------------------------
    let externalResults: any[] = []
    if (normalizedCourseId) {
      try {
        const { data: webResults, error: webError } = await supabase.rpc(
          'search_external_results',
          {
            query_embedding: queryEmbedding,
            filter_course_id: normalizedCourseId,
            match_threshold: 0.5,
            match_count: 5
          }
        )

        if (!webError && webResults) {
          externalResults = webResults
          console.log('[rag-chat] Found', externalResults.length, 'external web results')
        }
      } catch (webErr) {
        console.warn('[rag-chat] External search failed (continuing):', webErr)
      }
    }

    // ------------------------------------------
    // STEP 2.6 — FETCH KNOWLEDGE OBJECTS (concepts, formulas)
    // ------------------------------------------
    let knowledgeObjects: any[] = []
    if (normalizedCourseId) {
      try {
        const { data: kos, error: koError } = await supabase
          .from('knowledge_objects')
          .select('title, object_type, summary, content')
          .eq('course_id', normalizedCourseId)
          .limit(10)

        if (!koError && kos) {
          knowledgeObjects = kos
          console.log('[rag-chat] Found', knowledgeObjects.length, 'knowledge objects')
        }
      } catch (koErr) {
        console.warn('[rag-chat] Knowledge objects fetch failed (continuing):', koErr)
      }
    }

    // No matching pages → log but continue to LLM call (LLM can use its knowledge)
    if (!pages || pages.length === 0) {
      console.log(`[rag-chat] No course materials found, will use LLM knowledge with course/question context`)
    }

    // ------------------------------------------
    // STEP 3 — Build LLM context block (course materials + web + knowledge objects)
    // ------------------------------------------
    const hasMaterials = pages && pages.length > 0
    const hasWebResults = externalResults && externalResults.length > 0
    const hasKnowledgeObjects = knowledgeObjects && knowledgeObjects.length > 0
    
    // Course materials context
    const courseContext = hasMaterials
      ? pages
          .map(
            (p: any, i: number) =>
              `[Source ${i + 1}: ${p.doc_title}, Page ${p.page_number} (similarity ${(p.similarity * 100).toFixed(1)}%)]\n${p.content}`
          )
          .join('\n\n---\n\n')
      : ''

    // External web sources context
    const webContext = hasWebResults
      ? externalResults
          .map(
            (r: any, i: number) =>
              `[Web Source ${i + 1}: ${r.title} (${r.source_type})]\n${r.snippet || r.raw_content?.substring(0, 500) || ''}`
          )
          .join('\n\n---\n\n')
      : ''

    // Knowledge objects context (concepts, formulas)
    const knowledgeContext = hasKnowledgeObjects
      ? knowledgeObjects
          .map(
            (ko: any) => {
              const content = ko.content as any
              if (ko.object_type === 'formula') {
                return `[Formula: ${ko.title}]\n${content?.latex || ko.summary || ''}`
              }
              return `[${ko.object_type.charAt(0).toUpperCase() + ko.object_type.slice(1)}: ${ko.title}]\n${ko.summary || ''}`
            }
          )
          .join('\n\n')
      : ''

    // Combine all contexts
    const context = [courseContext, webContext, knowledgeContext].filter(Boolean).join('\n\n===\n\n')

    // ------------------------------------------
    // STEP 3.5 — FETCH USER MEMORY, MASTERY, AND CONVERSATION HISTORY
    // ------------------------------------------
    timer.checkpoint('memory_fetch_start')
    
    // Fetch user memory (3 keys: preferred_style, struggling_topic, misconception)
    let userMemory: Record<string, string> = {}
    if (normalizedCourseId) {
      try {
        const { data: memories } = await supabase
          .from('user_memory')
          .select('memory_key, memory_value')
          .eq('user_id', user.id)
          .eq('course_id', normalizedCourseId)
          .in('memory_key', ['preferred_style', 'struggling_topic', 'misconception'])
        
        if (memories) {
          memories.forEach(m => {
            userMemory[m.memory_key] = m.memory_value
          })
        }
        console.log(`[rag-chat] Loaded ${Object.keys(userMemory).length} memory entries`)
      } catch (memoryError) {
        console.warn(`[rag-chat] Failed to fetch user memory (non-critical):`, memoryError)
      }
    }
    
    // Fetch weak topics from user_topic_mastery
    let weakTopics: string[] = []
    if (normalizedCourseId) {
      try {
        const { data: mastery } = await supabase
          .from('user_topic_mastery')
          .select('topic_id, mastery_score, topics (name)')
          .eq('user_id', user.id)
          .eq('course_id', normalizedCourseId)
          .lt('mastery_score', 0.4)
          .order('mastery_score', { ascending: true })
          .limit(3)
        
        if (mastery) {
          weakTopics = mastery
            .filter(m => {
              const topic = m.topics as any
              return topic && (Array.isArray(topic) ? topic[0]?.name : topic.name)
            })
            .map(m => {
              const topic = m.topics as any
              return Array.isArray(topic) ? topic[0]?.name : topic?.name
            })
            .filter(Boolean) as string[]
        }
        console.log(`[rag-chat] Found ${weakTopics.length} weak topics`)
      } catch (masteryError) {
        console.warn(`[rag-chat] Failed to fetch mastery (non-critical):`, masteryError)
      }
    }
    
    // Fetch last 20 messages for conversation history
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (threadId) {
      try {
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('thread_id', threadId)
          .in('role', ['user', 'assistant'])
          .order('created_at', { ascending: false })
          .limit(20)
        
        if (messages) {
          conversationHistory = messages
            .reverse() // Reverse to chronological order
            .map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }))
        }
        console.log(`[rag-chat] Loaded ${conversationHistory.length} messages from history`)
      } catch (historyError) {
        console.warn(`[rag-chat] Failed to fetch conversation history (non-critical):`, historyError)
      }
    }
    
    timer.checkpoint('memory_fetch_complete', {
      memoryCount: Object.keys(userMemory).length,
      weakTopicsCount: weakTopics.length,
      historyCount: conversationHistory.length
    })
    
    // ------------------------------------------
    // STEP 4 — ENHANCED SYSTEM PROMPT WITH CONTEXT AWARENESS
    // ------------------------------------------
    
    // Fetch course and topic names for better context
    // Note: questionPrompt already fetched above (STEP 0)
    let courseName = null
    let topicName = null
    
    if (normalizedCourseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('name, code')
        .eq('id', normalizedCourseId)
        .maybeSingle()
      if (course) {
        courseName = `${course.code}: ${course.name}`
      }
    }
    
    if (normalizedTopicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('name')
        .eq('id', normalizedTopicId)
        .maybeSingle()
      if (topic) {
        topicName = topic.name
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
    
    const hasAnyContext = hasMaterials || hasWebResults || hasKnowledgeObjects
    
    // Build memory section
    let memorySection = ''
    if (Object.keys(userMemory).length > 0) {
      memorySection = '\nUSER MEMORY:\n'
      if (userMemory.preferred_style) {
        memorySection += `- Preferred explanation style: ${userMemory.preferred_style}\n`
      }
      if (userMemory.struggling_topic) {
        memorySection += `- Struggles with: ${userMemory.struggling_topic}\n`
      }
      if (userMemory.misconception) {
        memorySection += `- Common misconception: ${userMemory.misconception}\n`
      }
    }
    
    // Build mastery hints section
    let masteryHints = ''
    if (weakTopics.length > 0) {
      masteryHints = `\nWEAK TOPICS TO WATCH:\n${weakTopics.map(t => `- ${t}`).join('\n')}\n`
      masteryHints += 'When relevant, proactively address these topics and provide extra clarity.\n'
    }
    
    const systemPrompt = `You are GRASP, a concise AI tutor helping students with ${courseName || 'their coursework'}.${memorySection}${masteryHints}

${hasAnyContext 
  ? `AVAILABLE SOURCES:
${context}

RULES:
- PREFER information from course materials when available
- Use knowledge objects (concepts, formulas) for precise definitions
- Web sources provide supplementary context (Quizlet, GitHub, past exams)
- If sources don't cover the question, use your knowledge to help
- ${userMemory.preferred_style === 'short' ? 'Keep answers VERY SHORT (2-3 sentences).' : userMemory.preferred_style === 'detailed' ? 'Provide detailed explanations when helpful.' : 'Keep answers SHORT (3-5 sentences for simple questions, max 8-10 for complex ones)'}
- Use bullet points for lists, not paragraphs
- No citations or source references in your response
- ${weakTopics.length > 0 ? 'When discussing topics related to weak areas, provide extra clarity and examples.' : ''}`
  : `RULES:
- Use your knowledge to help answer the question
- Focus on ${courseName ? `the course: ${courseName}` : 'the subject matter'}
- ${userMemory.preferred_style === 'short' ? 'Keep answers VERY SHORT (2-3 sentences).' : userMemory.preferred_style === 'detailed' ? 'Provide detailed explanations when helpful.' : 'Keep answers SHORT (3-5 sentences for simple questions, max 8-10 for complex ones)'}
- Use bullet points for lists, not paragraphs
- ${weakTopics.length > 0 ? 'When discussing topics related to weak areas, provide extra clarity and examples.' : ''}`
}

CONTEXT:
${contextInfo}

Be direct and helpful. Get to the point quickly.`

    // ------------------------------------------
    // STEP 5 — LLM call with conversation history
    // ------------------------------------------
    timer.checkpoint('llm_start')
    let answer: string
    try {
      const llmStartTime = Date.now()
      
      // Build messages array with conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt }
      ]
      
      // Add conversation history (last 20 messages)
      if (conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          })
        })
      }
      
      // Add current user message
      messages.push({ role: 'user', content: message })
      
      // Call LLM with conversation history
      answer = await callLLM(systemPrompt, message, conversationHistory)
      const llmDuration = Date.now() - llmStartTime
      
      logApiCall(FUNCTION_NAME, 'callLLM', true, llmDuration, undefined, {
        userId: user.id,
        answerLength: answer.length,
        hasContext: hasAnyContext,
      })
      timer.checkpoint('llm_complete', { answerLength: answer.length })
    } catch (error) {
      logError(FUNCTION_NAME, error, {
        step: 'llm_call',
        userId: user.id,
        hasContext: hasAnyContext,
      })
      timer.end({ success: false, reason: 'llm_error' })
      throw new Error(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Track LLM usage (non-blocking)
    try {
      const inputTokens = Math.ceil((systemPrompt.length + message.length) / 4) // Rough estimate
      const outputTokens = Math.ceil(answer.length / 4)
      const costEstimate = (inputTokens * 0.01 + outputTokens * 0.03) / 1000 // GPT-4 Turbo pricing
      
      await supabase
        .from('llm_usage')
        .insert({
          user_id: user.id,
          feature: 'rag_chat',
          model: 'gpt-4-turbo-preview',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_estimate: costEstimate,
          metadata: {
            courseId: normalizedCourseId,
            topicId: normalizedTopicId,
            questionId: normalizedQuestionId,
            hasMaterials,
            hasWebResults,
            hasKnowledgeObjects,
            contextChunks: pages?.length || 0,
            externalChunks: externalResults?.length || 0,
            knowledgeChunks: knowledgeObjects?.length || 0,
            duration_ms: llmDuration,
          },
        })
      console.log('[rag-chat] LLM usage tracked')
    } catch (usageError) {
      console.warn('[rag-chat] Failed to track LLM usage (non-critical):', usageError)
    }

    // ------------------------------------------
    // STEP 6 — Save assistant message (non-blocking)
    // ------------------------------------------
    let assistantMessageId: string | null = null
    if (threadId) {
      assistantMessageId = await saveMessage(supabase, threadId, user.id, 'assistant', answer)
    }

    // ------------------------------------------
    // STEP 6.5 — Save RAG contexts for audit trail (non-blocking)
    // ------------------------------------------
    if (assistantMessageId && pages && pages.length > 0) {
      try {
        const ragContexts = pages.slice(0, 10).map((p: any) => ({
          message_id: assistantMessageId,
          page_id: p.id || null,
          document_id: p.document_id || null,
          source_type: 'page' as const,
          similarity_score: p.similarity,
          content_preview: p.content?.substring(0, 500) || null,
        }))
        
        const { error: ragError } = await supabase
          .from('chat_rag_contexts')
          .insert(ragContexts)
        
        if (ragError) {
          console.warn('[rag-chat] Failed to save RAG contexts (non-critical):', ragError)
        } else {
          console.log(`[rag-chat] Saved ${ragContexts.length} RAG contexts for message ${assistantMessageId}`)
        }
      } catch (ragSaveError) {
        console.warn('[rag-chat] RAG context save error (non-critical):', ragSaveError)
      }
    }

    // ------------------------------------------
    // STEP 7 — format citations for UI
    // ------------------------------------------
    const citations = (pages || []).map((p: any) => ({
      documentTitle: p.doc_title,
      pageNumber: p.page_number,
      similarity: p.similarity,
      docType: p.doc_type,
      publicUrl: p.public_url
    }))

    timer.end({
      success: true,
      threadId,
      userMessageId,
      assistantMessageId,
      citationsCount: citations.length,
      pagesCount: (pages || []).length,
    })

    // Return success response with CORS headers
    return successResponse({
      answer,
      thread_id: threadId || undefined,
      message_id: assistantMessageId || undefined,
      user_message_id: userMessageId || undefined,
      citations,
      pages: (pages || []).slice(0, 5)
    } as RAGResponse)

  } catch (error) {
    logError(FUNCTION_NAME, error, {
      step: 'unhandled_error',
      userId: (error as any)?.userId || 'unknown',
    })
    timer.end({ success: false, reason: 'unhandled_error' })
    return handleError(error, FUNCTION_NAME)
  }
})
