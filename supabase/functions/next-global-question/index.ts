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
}

serve(async (req) => {
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

    const { courseId } = body
    console.log(`[${FUNCTION_NAME}] Request:`, { userId: user.id, courseId })

    // STEP 1 — find weak topics
    const { data: weakTopics } = await supabase
      .from('topic_mastery')
      .select('topic_id, num_attempts, num_correct')
      .eq('user_id', user.id)
      .order('last_practiced_at', { ascending: true, nullsFirst: true })

    const weakTopicIds =
      weakTopics
        ?.filter(t =>
          t.num_attempts === 0 ||
          (t.num_correct / t.num_attempts) < 0.6
        )
        .map(t => t.topic_id) || []

    console.log('[next-global-question] Weak topics:', weakTopicIds.length)

    // If no weak topics → fallback to all topics in course
    let targetTopicIds = weakTopicIds
    if (targetTopicIds.length === 0) {
      const { data: allTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('course_id', courseId)
      targetTopicIds = allTopics?.map(t => t.id) || []
    }

    if (targetTopicIds.length === 0) {
      throw new NotFoundError('No topics found for this course')
    }

    // STEP 2 — try spaced repetition RPC
    const { data: question, error: questionError } = await supabase
      .rpc('get_next_spaced_question', {
        target_user_id: user.id,
        target_topic_ids: targetTopicIds
      })

    if (questionError) {
      console.error('[next-global-question] RPC error:', questionError)
      throw questionError
    }

    // STEP 3 — fallback: random lowest-difficulty question
    if (!question || question.length === 0) {
      console.log('[next-global-question] No spaced question, using fallback')

      const { data: fallbackQuestion, error: fallbackError } = await supabase
        .from('questions')
        .select('*')
        .in('topic_id', targetTopicIds)
        .order('difficulty', { ascending: true })
        .limit(1)
        .single()

      if (fallbackError || !fallbackQuestion) {
        throw new NotFoundError('No questions available')
      }

      console.log(`[${FUNCTION_NAME}] Using fallback ID:`, fallbackQuestion.id)

      return successResponse(fallbackQuestion)
    }

    console.log(`[${FUNCTION_NAME}] Success, spaced Q ID:`, question[0].id)

    return successResponse(question[0])

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
