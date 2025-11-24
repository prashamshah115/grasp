// Edge Function: /update-question-history
// Purpose: Update spaced repetition history using SM-2-style scheduling
// Called by: useUpdateQuestionHistory hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  isValidUUID,
} from '../_shared/errors.ts'

interface UpdateHistoryRequest {
  questionId: string
  isCorrect: boolean
}

interface UpdateHistoryResponse {
  success: boolean
  nextReview: string
  timesSeen: number
  timesCorrect: number
  accuracy: number
}

// SM-2 Variant (simplified): exponential spacing + penalty for wrong answers
function calculateNextReview(
  timesCorrect: number,
  timesSeen: number,
  isCorrect: boolean
): Date {
  const now = Date.now()

  if (!isCorrect) {
    // Wrong → review in 12 hours
    return new Date(now + 12 * 60 * 60 * 1000)
  }

  // Correct → exponential spacing: 2^(correct_count) days
  const newCorrect = timesCorrect + 1
  const intervalDays = Math.pow(2, newCorrect)

  const intervalMs = Math.min(
    intervalDays * 24 * 60 * 60 * 1000,
    90 * 24 * 60 * 60 * 1000 // Max 90 days
  )

  return new Date(now + intervalMs)
}

serve(async (req) => {
  const FUNCTION_NAME = 'update-question-history'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user and get properly configured Supabase client
    // This uses the CORRECT Supabase v2 pattern for Edge Functions
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Safe JSON parsing with error handling
    let body: UpdateHistoryRequest
    try {
      body = await req.json() as UpdateHistoryRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Input validation
    if (!body.questionId || typeof body.questionId !== 'string') {
      throw new ValidationError('questionId is required and must be a string')
    }

    if (!isValidUUID(body.questionId)) {
      throw new ValidationError('questionId must be a valid UUID')
    }

    if (typeof body.isCorrect !== 'boolean') {
      throw new ValidationError('isCorrect is required and must be a boolean')
    }

    const { questionId, isCorrect } = body

    console.log(`[${FUNCTION_NAME}] Request:`, {
      userId: user.id,
      questionId,
      isCorrect
    })

    // ----------------------------------------------------
    // STEP 1 — Fetch existing history
    // ----------------------------------------------------
    const { data: existing } = await supabase
      .from('question_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .single()

    let newTimesSeen: number
    let newTimesCorrect: number

    if (!existing) {
      console.log('[update-question-history] First time seeing this question')
      newTimesSeen = 1
      newTimesCorrect = isCorrect ? 1 : 0
    } else {
      newTimesSeen = existing.times_seen + 1
      newTimesCorrect = existing.times_correct + (isCorrect ? 1 : 0)

      console.log('[update-question-history] Updating existing history:', {
        timesSeen: newTimesSeen,
        timesCorrect: newTimesCorrect
      })
    }

    // ----------------------------------------------------
    // STEP 2 — Compute next review time
    // ----------------------------------------------------
    const nextReview = calculateNextReview(
      newTimesCorrect,
      newTimesSeen,
      isCorrect
    )

    console.log('[update-question-history] Next review:', nextReview.toISOString())

    // ----------------------------------------------------
    // STEP 3 — Upsert back into DB
    // ----------------------------------------------------
    const { error: upsertError } = await supabase
      .from('question_history')
      .upsert({
        user_id: user.id,
        question_id: questionId,
        last_seen: new Date().toISOString(),
        times_seen: newTimesSeen,
        times_correct: newTimesCorrect,
        next_review: nextReview.toISOString()
      })

    if (upsertError) {
      console.error('[update-question-history] Upsert error:', upsertError)
      throw upsertError
    }

    // Accuracy for frontend analytics
    const accuracy = newTimesCorrect / newTimesSeen
    console.log(`[${FUNCTION_NAME}] Success:`, {
      accuracy: (accuracy * 100).toFixed(1) + '%'
    })

    // Return success response with CORS headers
    return successResponse({
      success: true,
      nextReview: nextReview.toISOString(),
      timesSeen: newTimesSeen,
      timesCorrect: newTimesCorrect,
      accuracy
    } as UpdateHistoryResponse)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
