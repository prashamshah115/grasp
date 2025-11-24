import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  NotFoundError,
  isValidUUID,
} from '../_shared/errors.ts'

interface GlobalQuestionRequest {
  courseId: string
  weakOnly?: boolean
}

serve(async (req: Request) => {
  const FUNCTION_NAME = 'next-global-question'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Init DB
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Authenticate user (uses centralized error handling with CORS)
    const { user } = await requireAuth(req, supabase)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Safe JSON parsing with error handling
    let body: GlobalQuestionRequest
    try {
      body = await req.json() as GlobalQuestionRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Input validation
    if (!body.courseId || typeof body.courseId !== 'string') {
      throw new ValidationError('courseId is required and must be a string')
    }

    if (!isValidUUID(body.courseId)) {
      throw new ValidationError('courseId must be a valid UUID')
    }

    const { courseId, weakOnly } = body
    console.log(`[${FUNCTION_NAME}] Request:`, { userId: user.id, courseId, weakOnly })

    // STEP 1 — find weak topics
    const { data: weakTopics } = await supabase
      .from('topic_mastery')
      .select('topic_id, num_attempts, num_correct')
      .eq('user_id', user.id)
      .order('last_practiced_at', { ascending: true, nullsFirst: true })

    const weakTopicIds =
      weakTopics
        ?.filter((t: any) =>
          t.num_attempts === 0 ||
          (t.num_correct / t.num_attempts) < 0.6
        )
        .map((t: any) => t.topic_id) || []

    console.log('[next-global-question] Weak topics:', weakTopicIds.length)

    // Determine target topics based on weakOnly flag
    let targetTopicIds: string[] = []
    if (weakOnly) {
      // Strictly use weak topics; if none, return specific error
      targetTopicIds = weakTopicIds
      if (targetTopicIds.length === 0) {
        throw new NotFoundError('No weak topics available')
      }
    } else {
      // Use weak topics if any; else fallback to all course topics
      targetTopicIds = weakTopicIds
      if (targetTopicIds.length === 0) {
        const { data: allTopics } = await supabase
          .from('topics')
          .select('id')
          .eq('course_id', courseId)
        targetTopicIds = allTopics?.map((t: any) => t.id) || []
      }
      if (targetTopicIds.length === 0) {
        throw new NotFoundError('No topics found for this course')
      }
    }

    // STEP 2 — Get list of questions already used in exams (to exclude from practice)
    const { data: examQuestionIds } = await supabase
      .from('exam_questions')
      .select('question_id')
    
    const excludedQuestionIds = examQuestionIds?.map((eq: any) => eq.question_id) || []
    console.log(`[${FUNCTION_NAME}] Excluding ${excludedQuestionIds.length} exam questions from practice`)

    // STEP 3 — try spaced repetition RPC
    const { data: question, error: questionError } = await supabase
      .rpc('get_next_spaced_question', {
        target_user_id: user.id,
        target_topic_ids: targetTopicIds
      })

    if (questionError) {
      console.error('[next-global-question] RPC error:', questionError)
      throw questionError
    }

    // STEP 4 — Check if the spaced question is an exam question, if so skip it
    let selectedQuestion = null
    if (question && question.length > 0) {
      // Filter out exam questions from RPC results
      const nonExamQuestions = question.filter((q: any) => !excludedQuestionIds.includes(q.id))
      if (nonExamQuestions.length > 0) {
        selectedQuestion = nonExamQuestions[0]
      }
    }

    // STEP 5 — fallback: random lowest-difficulty question (excluding exam questions)
    if (!selectedQuestion) {
      console.log('[next-global-question] No spaced question, using fallback')

      let fallbackQuery = supabase
        .from('questions')
        .select('*')
        .in('topic_id', targetTopicIds)
        .order('difficulty', { ascending: true })
      
      // Exclude exam questions if any exist
      if (excludedQuestionIds.length > 0) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${excludedQuestionIds.join(',')})`)
      }
      
      const { data: fallbackQuestion, error: fallbackError } = await fallbackQuery
        .limit(1)
        .single()

      if (fallbackError || !fallbackQuestion) {
        throw new NotFoundError('No practice questions available (all questions may be assigned to exams)')
      }

      console.log(`[${FUNCTION_NAME}] Using fallback ID:`, fallbackQuestion.id)

      return successResponse(fallbackQuestion)
    }

    console.log(`[${FUNCTION_NAME}] Success, spaced Q ID:`, selectedQuestion.id)

    return successResponse(selectedQuestion)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
