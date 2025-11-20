import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UpdateMasteryRequest {
  sessionId: string
}

function calculateMasteryLevel(accuracy: number): 'weak' | 'moderate' | 'strong' {
  if (accuracy < 0.6) return 'weak'
  if (accuracy < 0.8) return 'moderate'
  return 'strong'
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { sessionId } = await req.json() as UpdateMasteryRequest

    console.log('[update-mastery] Request:', { sessionId })

    // Get session info
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('user_id, topic_id, course_id')
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      console.error('[update-mastery] Session error:', sessionError)
      throw sessionError
    }

    // Get attempts for this session
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select('is_correct, question_id, questions!inner(topic_id)')
      .eq('session_id', sessionId)

    if (attemptsError) {
      console.error('[update-mastery] Attempts error:', attemptsError)
      throw attemptsError
    }

    if (!attempts || attempts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No attempts to process' }),
        { status: 200 }
      )
    }

    console.log('[update-mastery] Processing', attempts.length, 'attempts')

    // Group attempts by topic
    const topicStats = new Map<string, { correct: number; total: number }>()

    for (const attempt of attempts) {
      const topicId = session.topic_id || (attempt.questions as any).topic_id
      const stats = topicStats.get(topicId) || { correct: 0, total: 0 }
      stats.total++
      if (attempt.is_correct) stats.correct++
      topicStats.set(topicId, stats)
    }

    // Update mastery for each topic
    for (const [topicId, stats] of topicStats) {
      // Get existing mastery
      const { data: existing } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', session.user_id)
        .eq('topic_id', topicId)
        .single()

      const newAttempts = (existing?.num_attempts || 0) + stats.total
      const newCorrect = (existing?.num_correct || 0) + stats.correct
      const accuracy = newCorrect / newAttempts
      const masteryLevel = calculateMasteryLevel(accuracy)

      // Upsert mastery
      const { error: upsertError } = await supabase
        .from('topic_mastery')
        .upsert({
          user_id: session.user_id,
          topic_id: topicId,
          num_attempts: newAttempts,
          num_correct: newCorrect,
          last_practiced_at: new Date().toISOString(),
          mastery_level: masteryLevel
        })

      if (upsertError) {
        console.error('[update-mastery] Upsert error:', upsertError)
        throw upsertError
      }

      console.log('[update-mastery] Updated topic', topicId, ':', masteryLevel, `(${(accuracy * 100).toFixed(1)}%)`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        topicsUpdated: topicStats.size
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[update-mastery] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
