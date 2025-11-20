import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface GlobalQuestionRequest {
  courseId: string
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

    const { courseId } = await req.json() as GlobalQuestionRequest

    console.log('[next-global-question] Request:', { userId: user.id, courseId })

    // STEP 1: Find weak topics (mastery < 60%)
    const { data: weakTopics } = await supabase
      .from('topic_mastery')
      .select('topic_id, num_attempts, num_correct')
      .eq('user_id', user.id)
      .order('last_practiced_at', { ascending: true, nullsFirst: true })

    const weakTopicIds = weakTopics
      ?.filter(t => t.num_attempts === 0 || (t.num_correct / t.num_attempts) < 0.6)
      .map(t => t.topic_id) || []

    console.log('[next-global-question] Weak topics:', weakTopicIds.length)

    // If no weak topics, get all topics for this course
    let targetTopicIds = weakTopicIds
    if (targetTopicIds.length === 0) {
      const { data: allTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('course_id', courseId)
      targetTopicIds = allTopics?.map(t => t.id) || []
    }

    if (targetTopicIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No topics found for this course' }),
        { status: 404 }
      )
    }

    // STEP 2: Get next question using spaced repetition
    const { data: question, error: questionError } = await supabase
      .rpc('get_next_spaced_question', {
        target_user_id: user.id,
        target_topic_ids: targetTopicIds
      })

    if (questionError) {
      console.error('[next-global-question] Error:', questionError)
      throw questionError
    }

    if (!question || question.length === 0) {
      // Fallback: random question from weak topics
      const { data: fallbackQuestion } = await supabase
        .from('questions')
        .select('*')
        .in('topic_id', targetTopicIds)
        .limit(1)
        .single()

      if (!fallbackQuestion) {
        return new Response(
          JSON.stringify({ error: 'No questions available' }),
          { status: 404 }
        )
      }

      console.log('[next-global-question] Using fallback question')

      return new Response(
        JSON.stringify(fallbackQuestion),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[next-global-question] Success, question ID:', question[0].id)

    return new Response(
      JSON.stringify(question[0]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[next-global-question] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
