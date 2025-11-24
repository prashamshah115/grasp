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
      temperature: 0.5, // Balanced creativity for comprehensive explanations
      max_tokens: 3000, // Increased for comprehensive, detailed notes
      top_p: 0.9, // Nucleus sampling for better quality
      frequency_penalty: 0.2, // Reduce repetition in longer outputs
      presence_penalty: 0.1 // Encourage diverse topic coverage
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
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.generate_compression)
    if (!rateLimitResult.allowed) {
      console.log(`[${FUNCTION_NAME}] Rate limit exceeded for user:`, user.id)
      return rateLimitResponse(rateLimitResult)
    }

    console.log(`[${FUNCTION_NAME}] Rate limit OK - remaining:`, rateLimitResult.remaining)

    // Safe JSON parsing with error handling
    let body: CompressionRequest
    try {
      const rawBody = await req.text()
      console.log(`[${FUNCTION_NAME}] Raw request body:`, rawBody)
      body = JSON.parse(rawBody) as CompressionRequest
      console.log(`[${FUNCTION_NAME}] Parsed body:`, body)
    } catch (error) {
      console.error(`[${FUNCTION_NAME}] JSON parse error:`, error)
      throw new ValidationError(`Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}`)
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

    // STEP 1: Get course_id from topic
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', topicId)
      .single()

    if (topicError || !topic) {
      throw new NotFoundError('Topic not found')
    }

    const courseId = topic.course_id
    console.log(`[${FUNCTION_NAME}] Found course_id: ${courseId} for topic ${topicId}`)

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
    
    if (!pages || pages.length === 0) {
      throw new NotFoundError('No documents found for this topic or course. Upload course materials first.')
    }

    console.log(`[${FUNCTION_NAME}] Found ${pages.length} pages`)

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
    const systemPrompt = `You are an expert educational content creator specializing in creating comprehensive, exam-optimized study notes for university-level courses. Your task is to transform dense course materials into clear, structured, and actionable compression notes.

QUALITY STANDARDS:
1. **Comprehensiveness**: Cover all critical concepts, not just surface-level facts
2. **Clarity**: Explain concepts from the ground up - assume the reader is learning, not reviewing
3. **Structure**: Organize information logically with clear hierarchies
4. **Actionability**: Include practical applications, examples, and common pitfalls
5. **Exam Focus**: Prioritize information likely to appear on exams while maintaining educational value

CONTENT REQUIREMENTS:
- **Foundational Concepts**: Start with core definitions and principles before advanced topics
- **Step-by-Step Explanations**: Break down complex processes into clear steps
- **Visual Descriptions**: Describe diagrams, algorithms, or processes in text format
- **Connections**: Show relationships between concepts
- **Common Mistakes**: Highlight frequent errors or misconceptions
- **Memory Aids**: Include mnemonics or patterns when helpful

TOPIC QUESTIONS (for context on what students need to know):
${questionList}

SOURCE MATERIAL:
${content}

TASK:
Generate comprehensive compression notes (15-25 bullet points) that include:

1. **Core Definitions** (3-5 points)
   - Essential terminology with clear explanations
   - Fundamental concepts explained from first principles

2. **Key Concepts & Principles** (5-8 points)
   - Important theories, frameworks, or models
   - How concepts relate to each other
   - Underlying principles that govern the topic

3. **Processes & Algorithms** (3-5 points)
   - Step-by-step procedures
   - Algorithm descriptions with clear logic flow
   - Decision trees or flowcharts described in text

4. **Formulas & Equations** (2-4 points)
   - Key formulas with variable explanations
   - When and how to apply each formula
   - Formula derivations or intuitions when helpful

5. **Practical Applications** (2-3 points)
   - Real-world examples
   - Use cases and scenarios
   - Problem-solving strategies

6. **Common Pitfalls & Edge Cases** (2-3 points)
   - Frequent mistakes students make
   - Exceptions to general rules
   - Tricky edge cases to watch for

7. **Exam-Critical Facts** (2-3 points)
   - High-probability exam topics
   - Quick reference facts
   - Comparison tables or distinctions

FORMATTING GUIDELINES:
- Use Markdown formatting with clear hierarchy
- Use **bold** for key terms and important concepts
- Use code blocks for formulas, code snippets, or technical notation
- Use numbered lists for sequential processes
- Use bullet points for parallel concepts
- Include section headers (##) to organize content
- No introductory or concluding paragraphs - dive straight into content
- Each bullet should be self-contained but build on previous points

QUALITY CHECK:
Before finalizing, ensure:
✓ All major concepts from source materials are covered
✓ Explanations are clear enough for someone learning the topic
✓ Information is accurate and grounded in source materials
✓ Formatting enhances readability
✓ Content is exam-relevant without sacrificing educational depth

Generate the compression notes now:`

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
    console.error(`[${FUNCTION_NAME}] Unhandled error:`, error)
    console.error(`[${FUNCTION_NAME}] Error stack:`, error instanceof Error ? error.stack : 'No stack')
    return handleError(error, FUNCTION_NAME)
  }
})
