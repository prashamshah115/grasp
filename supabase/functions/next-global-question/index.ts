import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  NotFoundError,
  isValidUUID,
} from '../_shared/errors.ts'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rate-limit.ts'

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
    // Authenticate user and get properly configured Supabase client
    // This uses the CORRECT Supabase v2 pattern for Edge Functions
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.next_global_question)
    if (!rateLimitResult.allowed) {
      console.log(`[${FUNCTION_NAME}] Rate limit exceeded for user:`, user.id)
      return rateLimitResponse(rateLimitResult)
    }

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

    // STEP 2 — try spaced repetition RPC (results already include is_exam_only flag)
    const { data: question, error: questionError } = await supabase
      .rpc('get_next_spaced_question', {
        target_user_id: user.id,
        target_topic_ids: targetTopicIds
      })

    if (questionError) {
      console.error('[next-global-question] RPC error:', questionError)
      throw questionError
    }

    // STEP 3 — Check if the spaced question is an exam-only question, if so skip it
    let selectedQuestion = null
    if (question && question.length > 0) {
      // Filter out exam-only questions from RPC results
      const nonExamQuestions = question.filter((q: any) => !q.is_exam_only)
      if (nonExamQuestions.length > 0) {
        selectedQuestion = nonExamQuestions[0]
      }
    }

    // STEP 4 — fallback: pick a random low-difficulty question that is NOT exam-only
    if (!selectedQuestion) {
      console.log('[next-global-question] No spaced question, using fallback')

      const { data: fallbackQuestions, error: fallbackError } = await supabase
        .from('questions')
        .select('*')
        .eq('is_exam_only', false)
        .in('topic_id', targetTopicIds)
        .order('difficulty', { ascending: true })
        .limit(25)

      if (fallbackError) {
        console.error('[next-global-question] Fallback query error:', fallbackError)
        throw fallbackError
      }

      const availableQuestions = fallbackQuestions || []
      if (availableQuestions.length === 0) {
        throw new NotFoundError('No practice questions available (all questions may be assigned to exams)')
      }

      const randomIndex = Math.floor(Math.random() * availableQuestions.length)
      const fallbackQuestion = availableQuestions[randomIndex]

      console.log(
        `[${FUNCTION_NAME}] Using fallback ID:`,
        fallbackQuestion?.id,
        'from',
        availableQuestions.length,
        'candidates'
      )

      return successResponse(fallbackQuestion)
    }

    console.log(`[${FUNCTION_NAME}] Success, spaced Q ID:`, selectedQuestion.id)

    return successResponse(selectedQuestion)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
