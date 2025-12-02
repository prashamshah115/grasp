import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
import {
  logFunctionStart,
  logFunctionEnd,
  logQuery,
  logApiCall,
  logError,
  logValidationError,
  createTimer,
} from '../_shared/logger.ts'

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
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Please set this environment variable in Supabase Edge Functions secrets.')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview', // Use valid OpenAI model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5, // Balanced creativity for comprehensive explanations
        max_tokens: 3000, // Increased for comprehensive, detailed notes
        top_p: 0.9, // Nucleus sampling for better quality
        frequency_penalty: 0.2, // Reduce repetition in longer outputs
        presence_penalty: 0.1 // Encourage diverse topic coverage
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

serve(async (req) => {
  const FUNCTION_NAME = 'generate-compression'
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
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.generate_compression)
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
    let body: CompressionRequest
    try {
      const rawBody = await req.text()
      body = JSON.parse(rawBody) as CompressionRequest
      timer.checkpoint('parse_complete', { hasTopicId: !!body.topicId })
    } catch (error) {
      logError(FUNCTION_NAME, error, { step: 'json_parse', userId: user.id })
      timer.end({ success: false, reason: 'parse_error' })
      throw new ValidationError(`Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Input validation
    if (!body.topicId || typeof body.topicId !== 'string') {
      logValidationError(FUNCTION_NAME, 'topicId', body.topicId, 'topicId is required and must be a string', {
        userId: user.id,
      })
      timer.end({ success: false, reason: 'validation_error' })
      throw new ValidationError('topicId is required and must be a string')
    }

    if (!isValidUUID(body.topicId)) {
      logValidationError(FUNCTION_NAME, 'topicId', body.topicId, 'topicId must be a valid UUID', {
        userId: user.id,
      })
      timer.end({ success: false, reason: 'validation_error' })
      throw new ValidationError('topicId must be a valid UUID')
    }

    const { topicId } = body
    timer.checkpoint('validation_complete', { topicId, userId: user.id })

    // STEP 1: Get course_id from topic
    timer.checkpoint('fetch_topic_start')
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', topicId)
      .single()

    logQuery(FUNCTION_NAME, 'fetch_topic', {
      count: topic ? 1 : 0,
      error: topicError,
    }, {
      userId: user.id,
      topicId,
    })

    if (topicError || !topic) {
      logError(FUNCTION_NAME, topicError || new Error('Topic not found'), {
        step: 'fetch_topic',
        userId: user.id,
        topicId,
      })
      timer.end({ success: false, reason: 'topic_not_found' })
      throw new NotFoundError('Topic not found')
    }

    const courseId = topic.course_id
    timer.checkpoint('fetch_topic_complete', { courseId })

    // Check if user is enrolled in the course
    const { data: enrollment } = await supabase
      .from('user_courses')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()
    
    const isEnrolled = !!enrollment
    console.log(`[${FUNCTION_NAME}] User enrollment check:`, isEnrolled)

    // STEP 2: Grab all document pages for this topic OR course (handles NULL topic_id)
    // RLS policies handle access control automatically:
    // - owner_user_id IS NULL (public documents)
    // - owner_user_id = auth.uid() (user's own documents)
    // - User is enrolled in the course
    // First try topic-specific documents, then fall back to course documents
    let { data: pages, error: pagesError } = await supabase
      .from('document_pages')
      .select(`
        text_content,
        page_number,
        documents!inner(
          id,
          title,
          topic_id,
          course_id,
          owner_user_id
        )
      `)
      .eq('documents.course_id', courseId)
      .eq('documents.topic_id', topicId)
      .order('page_number', { ascending: true })
      .limit(50)

    // If no topic-specific documents, fall back to course documents (topic_id IS NULL)
    if (!pages || pages.length === 0) {
      console.log(`[${FUNCTION_NAME}] No topic-specific documents, searching course documents...`)
      const { data: coursePages, error: coursePagesError } = await supabase
        .from('document_pages')
        .select(`
          text_content,
          page_number,
          documents!inner(
            id,
            title,
            topic_id,
            course_id,
            owner_user_id
          )
        `)
        .eq('documents.course_id', courseId)
        .is('documents.topic_id', null)
        .order('page_number', { ascending: true })
        .limit(50)

      if (coursePagesError) {
        console.error(`[${FUNCTION_NAME}] Error fetching course pages:`, coursePagesError)
        pagesError = coursePagesError
      } else {
        pages = coursePages
        console.log(`[${FUNCTION_NAME}] Found ${pages?.length || 0} course documents (topic_id: NULL)`)
      }
    }

    if (pagesError) {
      console.error(`[${FUNCTION_NAME}] Pages error:`, {
        message: pagesError.message,
        code: pagesError.code,
        details: pagesError.details,
        hint: pagesError.hint,
        stack: pagesError.stack,
      })
      throw pagesError
    }
    
    logQuery(FUNCTION_NAME, 'fetch_document_pages', {
      count: pages?.length || 0,
      error: pagesError,
    }, {
      userId: user.id,
      topicId,
      courseId,
    })

    if (pagesError) {
      logError(FUNCTION_NAME, pagesError, {
        step: 'fetch_pages',
        userId: user.id,
        topicId,
        courseId,
      })
      timer.end({ success: false, reason: 'pages_error' })
      throw pagesError
    }
    
    if (!pages || pages.length === 0) {
      logError(FUNCTION_NAME, new Error('No documents found'), {
        step: 'fetch_pages',
        userId: user.id,
        topicId,
        courseId,
      })
      timer.end({ success: false, reason: 'no_documents' })
      throw new NotFoundError('No documents found for this topic or course. Upload course materials first.')
    }

    timer.checkpoint('fetch_pages_complete', { pageCount: pages.length })

    // STEP 2: Fetch questions for context
    const { data: questions } = await supabase
      .from('questions')
      .select('prompt')
      .eq('topic_id', topicId)
      .limit(20)

    const questionList =
      questions?.map((q: any) => `- ${q.prompt}`).join('\n') ||
      'No questions available.'

    console.log(`[${FUNCTION_NAME}] Questions: ${questions?.length ?? 0}`)

    // STEP 3: Aggregate & truncate content
    // Handle both text_content and content fields (different ingestion paths use different fields)
    const contentParts: string[] = []
    
    try {
      for (const p of pages) {
        try {
          // Safely access nested document fields - handle both array and object formats
          let docTitle = 'Unknown Document'
          if (p.documents) {
            if (Array.isArray(p.documents)) {
              docTitle = p.documents[0]?.title || 'Unknown Document'
            } else {
              docTitle = p.documents.title || 'Unknown Document'
            }
          }
          
          const pageNum = p.page_number || 0
          
          // Try text_content first (newer ingestion), fall back to content (older ingestion)
          const pageContent = p.text_content || p.content || ''
          
          if (!pageContent || pageContent.trim().length === 0) {
            console.warn(`[${FUNCTION_NAME}] Page ${pageNum} of ${docTitle} has no content`)
            continue // Skip empty pages
          }
          
          // Only include pages with actual content
          const contentChunk = `[${docTitle}, p.${pageNum}]\n${pageContent.substring(0, 2000)}`
          if (contentChunk.length > 0) {
            contentParts.push(contentChunk)
          }
        } catch (pageError) {
          console.error(`[${FUNCTION_NAME}] Error processing page:`, pageError)
          // Continue with other pages
        }
      }
    } catch (aggregateError) {
      console.error(`[${FUNCTION_NAME}] Error aggregating content:`, aggregateError)
      throw new Error(`Failed to aggregate content: ${aggregateError instanceof Error ? aggregateError.message : 'Unknown error'}`)
    }
    
    const content = contentParts.join('\n\n---\n\n')
    
    if (!content || content.trim().length === 0) {
      throw new NotFoundError('No content found in document pages. Documents may not be fully processed or pages are empty.')
    }
    
    console.log(`[${FUNCTION_NAME}] Aggregated ${content.length} chars from ${contentParts.length} pages (out of ${pages.length} total)`)

    // STEP 4: Build enhanced LLM system prompt for high-quality compression
    const systemPrompt = `You are an expert university-level content compression engine. Your job is to convert dense academic material into clean, exam-optimized **Markdown** notes without adding facts not found in the source.

## OUTPUT REQUIREMENTS

- Output **high-quality Markdown only**.
- Use clear section headers (##, ###).
- Use **bold** for key terms.
- Use bullet points for concepts, numbered lists for steps.
- Use fenced code blocks \`\`\` for formulas or pseudocode.
- No intro, no outro, no fluff — begin immediately with headers.

## QUALITY PRINCIPLES

1. **Accuracy First**
   - No invented info. Stay strictly within the provided source content.
   - If the source is ambiguous, summarize conservatively.

2. **Compression Without Loss**
   - Extract the *full conceptual structure* of the topic.
   - Prioritize depth over breadth: explain the idea, the intuition, the mechanics.

3. **Teach From Zero**
   - Assume the student is learning for the first time.
   - Define all key terms before using them.

4. **Exam Optimization**
   - Highlight high-yield facts, common mistakes, edge cases.
   - Prefer clarity over density.

## REQUIRED SECTIONS (in order)

Always output sections in the exact order listed. Never skip or rename a section.

### 1. Core Definitions (3–5 bullets)
- Essential terminology
- First-principles explanations

### 2. Key Concepts & Principles (5–8 bullets)
- Theories, rules, relationships
- Intuition & purpose

### 3. Processes / Algorithms (3–5 items)
- Step-by-step numbered lists
- Pseudocode if relevant
- Logic / decision criteria

### 4. Formulas (2–4 items)
Use code blocks:
\`\`\`
Formula: F = ma
Variables:
* F = Force
* m = Mass
* a = Acceleration
\`\`\`
Explain when/how each formula applies.

### 5. Practical Applications (2–3 bullets)
- Real-world uses
- Problem-solving strategies

### 6. Pitfalls & Edge Cases (2–3 bullets)
- Common errors students make
- Exceptions / tricky variants

### 7. Exam-Critical Facts (2–3 bullets)
- High-probability test points
- Must-memorize distinctions

## STRICT RULES

- Do NOT introduce external facts. Only compress what's in the source.
- If the source lacks enough detail, be concise rather than inventing content.
- If formulas are not present, do not create them.
- Each bullet point must represent one idea only.

## FINAL INSTRUCTION

Return only the Markdown notes. Do not mention the prompt.
Use the question list and source content below as your entire knowledge base.

TOPIC QUESTIONS:

${questionList}

SOURCE MATERIAL:

${content}`

    // STEP 5: Generate via LLM
    timer.checkpoint('llm_start')
    let compressionContent: string
    try {
      const llmStartTime = Date.now()
      compressionContent = await callLLM(systemPrompt, 'Generate the compression notes.')
      const llmDuration = Date.now() - llmStartTime
      
      logApiCall(FUNCTION_NAME, 'callLLM', true, llmDuration, undefined, {
        userId: user.id,
        topicId,
        courseId,
        contentLength: compressionContent.length,
      })
      timer.checkpoint('llm_complete', { contentLength: compressionContent.length })
    } catch (error) {
      logError(FUNCTION_NAME, error, {
        step: 'llm_call',
        userId: user.id,
        topicId,
        courseId,
      })
      timer.end({ success: false, reason: 'llm_error' })
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Track LLM usage (non-blocking)
    try {
      const inputTokens = Math.ceil(systemPrompt.length / 4) // Rough estimate
      const outputTokens = Math.ceil(compressionContent.length / 4)
      const costEstimate = (inputTokens * 0.01 + outputTokens * 0.03) / 1000 // GPT-4 Turbo pricing
      
      await supabase
        .from('llm_usage')
        .insert({
          user_id: user.id,
          feature: 'compression_notes',
          model: 'gpt-4-turbo-preview',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_estimate: costEstimate,
          metadata: {
            topicId,
            courseId,
            sourcePages: pages.length,
            duration_ms: llmDuration,
          },
        })
      console.log('[generate-compression] LLM usage tracked')
    } catch (usageError) {
      console.warn('[generate-compression] Failed to track LLM usage (non-critical):', usageError)
    }

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
    console.error(`[${FUNCTION_NAME}] Unhandled error:`, error)
    console.error(`[${FUNCTION_NAME}] Error stack:`, error instanceof Error ? error.stack : 'No stack')
    return handleError(error, FUNCTION_NAME)
  }
})
