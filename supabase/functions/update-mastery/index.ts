// Edge Function: /update-mastery
// Purpose: Update topic mastery after a study session
// Called by: useUpdateMastery hook in frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  isValidUUID,
} from '../_shared/errors.ts'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rate-limit.ts'

interface UpdateMasteryRequest {
  sessionId: string
}

interface UpdateMasteryResponse {
  success: boolean
  topicsUpdated: number
}

function calculateMasteryLevel(accuracy: number): 'weak' | 'moderate' | 'strong' {
  if (accuracy < 0.6) return 'weak'
  if (accuracy < 0.8) return 'moderate'
  return 'strong'
}

serve(async (req) => {
  const FUNCTION_NAME = 'update-mastery'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user and get properly configured Supabase client
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.update_mastery)
    if (!rateLimitResult.allowed) {
      console.log(`[${FUNCTION_NAME}] Rate limit exceeded for user:`, user.id)
      return rateLimitResponse(rateLimitResult)
    }

    // Safe JSON parsing with error handling
    let body: UpdateMasteryRequest
    try {
      body = await req.json() as UpdateMasteryRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Input validation
    if (!body.sessionId || typeof body.sessionId !== 'string') {
      throw new ValidationError('sessionId is required and must be a string')
    }

    if (!isValidUUID(body.sessionId)) {
      throw new ValidationError('sessionId must be a valid UUID')
    }

    const { sessionId } = body
    console.log(`[${FUNCTION_NAME}] Request:`, { sessionId, userId: user.id })

    // -----------------------------------------------
    // STEP 1: Fetch session info and verify ownership
    // -----------------------------------------------
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('user_id, topic_id, course_id')
      .eq('id', sessionId)
      .eq('user_id', user.id) // Security: ensure user owns the session
      .single()

    if (sessionError) {
      console.error('[update-mastery] Session error:', sessionError)
      throw sessionError
    }

    if (!session) {
      throw new Error('Session not found or access denied')
    }

    console.log('[update-mastery] Session found:', session)

    // -----------------------------------------------
    // STEP 2: Fetch all attempts in this session
    // -----------------------------------------------
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select('is_correct, question_id, questions!inner(topic_id)')
      .eq('session_id', sessionId)

    if (attemptsError) {
      console.error('[update-mastery] Attempts error:', attemptsError)
      throw attemptsError
    }

    if (!attempts || attempts.length === 0) {
      console.log(`[${FUNCTION_NAME}] No attempts to process`)
      return successResponse({
        success: true,
        message: 'No attempts to process',
        topicsUpdated: 0
      } as UpdateMasteryResponse)
    }

    console.log('[update-mastery] Processing', attempts.length, 'attempts')

    // -----------------------------------------------
    // STEP 3: Compute stats per topic
    // -----------------------------------------------
    const topicStats = new Map<string, { correct: number; total: number }>()

    for (const attempt of attempts) {
      const topicId = session.topic_id || attempt.questions.topic_id

      const stats = topicStats.get(topicId) || { correct: 0, total: 0 }
      stats.total++
      if (attempt.is_correct) stats.correct++
      topicStats.set(topicId, stats)
    }

    console.log(
      '[update-mastery] Topic stats:',
      Array.from(topicStats.entries()).map(([id, stats]) => ({
        topicId: id,
        correct: stats.correct,
        total: stats.total
      }))
    )

    // -----------------------------------------------
    // STEP 4: Write updates to DB
    // -----------------------------------------------
    for (const [topicId, stats] of topicStats) {
      // Fetch existing mastery record
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
        accuracy: `${(accuracy * 100).toFixed(1)}%`,
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
          mastery_level: masteryLevel,
          last_practiced_at: new Date().toISOString()
        })

      if (upsertError) {
        console.error('[update-mastery] Upsert error for topic', topicId, ':', upsertError)
        throw upsertError
      }

      console.log('[update-mastery] Updated topic', topicId)
    }

    console.log(`[${FUNCTION_NAME}] Success — topics updated:`, topicStats.size)

    return successResponse({
      success: true,
      topicsUpdated: topicStats.size
    } as UpdateMasteryResponse)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
