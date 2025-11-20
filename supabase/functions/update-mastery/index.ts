// Edge Function: /update-mastery
// Purpose: Update topic mastery after practice session
// Called by: useUpdateMastery hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UpdateMasteryRequest {
  sessionId: string
}

interface UpdateMasteryResponse {
  success: boolean
  topicsUpdated: number
}

// Calculate mastery level based on accuracy
function calculateMasteryLevel(accuracy: number): 'weak' | 'moderate' | 'strong' {
  if (accuracy < 0.6) return 'weak'
  if (accuracy < 0.8) return 'moderate'
  return 'strong'
}

serve(async (req) => {
  try {
    // Initialize Supabase client
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

    console.log('[update-mastery] Session found:', {
      userId: session.user_id,
      topicId: session.topic_id,
      courseId: session.course_id
    })

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
      console.log('[update-mastery] No attempts to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No attempts to process',
          topicsUpdated: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[update-mastery] Processing', attempts.length, 'attempts')

    // Group attempts by topic
    const topicStats = new Map<string, { correct: number; total: number }>()

    for (const attempt of attempts) {
      // Use session topic_id if available, otherwise use question's topic_id
      const topicId = session.topic_id || attempt.questions.topic_id

      const stats = topicStats.get(topicId) || { correct: 0, total: 0 }
      stats.total++
      if (attempt.is_correct) stats.correct++
      topicStats.set(topicId, stats)
    }

    console.log('[update-mastery] Topic stats:', Array.from(topicStats.entries()).map(([id, stats]) => ({
      topicId: id,
      correct: stats.correct,
      total: stats.total
    })))

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

      console.log('[update-mastery] Updating topic:', {
        topicId,
        newAttempts,
        newCorrect,
        accuracy: (accuracy * 100).toFixed(1) + '%',
        masteryLevel
      })

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
        console.error('[update-mastery] Upsert error for topic', topicId, ':', upsertError)
        throw upsertError
      }

      console.log('[update-mastery] Successfully updated topic', topicId, ':', masteryLevel)
    }

    console.log('[update-mastery] Success, updated', topicStats.size, 'topics')

    return new Response(
      JSON.stringify({
        success: true,
        topicsUpdated: topicStats.size
      } as UpdateMasteryResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        }
      }
    )

  } catch (error) {
    console.error('[update-mastery] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
