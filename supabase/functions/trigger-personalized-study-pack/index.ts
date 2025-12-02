// Edge Function: /trigger-personalized-study-pack
// Purpose: Trigger personalized study pack generation for a user
// Called by: Frontend when user wants personalized pack

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
} from '../_shared/errors.ts'

interface TriggerPersonalizedPackRequest {
  course_id: string
}

serve(async (req) => {
  const FUNCTION_NAME = 'trigger-personalized-study-pack'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    console.log(`[${FUNCTION_NAME}] Request received`)

    // Authenticate user
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Parse request body
    let body: TriggerPersonalizedPackRequest
    try {
      const rawBody = await req.text()
      body = JSON.parse(rawBody) as TriggerPersonalizedPackRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    const { course_id } = body

    if (!course_id) {
      throw new ValidationError('course_id is required')
    }

    // Verify user is enrolled in course
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('user_courses')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .maybeSingle()

    if (enrollmentError || !enrollment) {
      throw new ValidationError('User is not enrolled in this course')
    }

    // Get Trigger.dev config
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
    }

    console.log(`[${FUNCTION_NAME}] Triggering personalized study pack generation for user ${user.id}, course ${course_id}`)

    // Trigger the generate-personalized-study-pack task
    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/generate-personalized-study-pack/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${triggerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          userId: user.id,
          courseId: course_id,
        },
      }),
    })

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      console.error(`[${FUNCTION_NAME}] Trigger.dev API error:`, triggerResponse.status, errorText)
      throw new Error(`Failed to trigger personalized study pack generation: ${triggerResponse.status} ${errorText}`)
    }

    const result = await triggerResponse.json()
    console.log(`[${FUNCTION_NAME}] ✅ Personalized study pack generation triggered:`, result.id)

    return successResponse({
      success: true,
      message: 'Personalized study pack generation started',
      runId: result.id,
    })

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})

