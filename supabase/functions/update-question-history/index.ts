// Edge Function: /update-question-history
// Purpose: Update spaced repetition history using SM-2-style scheduling
// Called by: useUpdateQuestionHistory hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  try {
    // Init Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Authentication
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

    const { questionId, isCorrect } = await req.json() as UpdateHistoryRequest

    console.log('[update-question-history] Request:', {
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
    console.log('[update-question-history] Success:', {
      accuracy: (accuracy * 100).toFixed(1) + '%'
    })

    // ----------------------------------------------------
    // STEP 4 — Response
    // ----------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        nextReview: nextReview.toISOString(),
        timesSeen: newTimesSeen,
        timesCorrect: newTimesCorrect,
        accuracy
      } as UpdateHistoryResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type'
        }
      }
    )

  } catch (error: any) {
    console.error('[update-question-history] Error:', error)
    return new Response(
      JSON.stringify({
        error: error?.message ?? 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
