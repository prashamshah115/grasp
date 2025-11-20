import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UpdateHistoryRequest {
  questionId: string
  isCorrect: boolean
}

// SM-2 Algorithm for spaced repetition
function calculateNextReview(
  timesCorrect: number,
  timesSeen: number,
  isCorrect: boolean
): Date {
  const now = Date.now()

  if (!isCorrect) {
    // Wrong answer → review in 12 hours
    return new Date(now + 12 * 60 * 60 * 1000)
  }

  // Correct answer → exponential backoff
  // Interval = 2^(correct_count) days
  const newCorrect = timesCorrect + 1
  const intervalDays = Math.pow(2, newCorrect)
  const intervalMs = Math.min(intervalDays * 24 * 60 * 60 * 1000, 90 * 24 * 60 * 60 * 1000) // Max 90 days

  return new Date(now + intervalMs)
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { questionId, isCorrect } = await req.json() as UpdateHistoryRequest

    console.log('[update-question-history] Request:', { userId: user.id, questionId, isCorrect })

    // Get existing history
    const { data: existing } = await supabase
      .from('question_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .single()

    let newTimesSeen: number
    let newTimesCorrect: number

    if (!existing) {
      // First time seeing this question
      newTimesSeen = 1
      newTimesCorrect = isCorrect ? 1 : 0
    } else {
      newTimesSeen = existing.times_seen + 1
      newTimesCorrect = existing.times_correct + (isCorrect ? 1 : 0)
    }

    // Calculate next review date using SM-2
    const nextReview = calculateNextReview(newTimesCorrect, newTimesSeen, isCorrect)

    // Upsert history
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
      console.error('[update-question-history] Error:', upsertError)
      throw upsertError
    }

    console.log('[update-question-history] Success, next review:', nextReview.toISOString())

    return new Response(
      JSON.stringify({
        success: true,
        nextReview: nextReview.toISOString(),
        timesSeen: newTimesSeen,
        timesCorrect: newTimesCorrect,
        accuracy: newTimesCorrect / newTimesSeen
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[update-question-history] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
