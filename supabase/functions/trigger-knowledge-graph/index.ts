// Edge Function: /trigger-knowledge-graph
// Purpose: Trigger knowledge graph generation via Trigger.dev worker
// Called by: triggerKnowledgeGraphGeneration API function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  isValidUUID,
} from '../_shared/errors.ts'

interface TriggerKnowledgeGraphRequest {
  course_id: string
}

interface TriggerKnowledgeGraphResponse {
  success: boolean
  courseId: string
  jobId: string
  message: string
}

serve(async (req) => {
  const FUNCTION_NAME = 'trigger-knowledge-graph'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Parse request
    let body: TriggerKnowledgeGraphRequest
    try {
      body = await req.json() as TriggerKnowledgeGraphRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Validate input
    if (!body.course_id || typeof body.course_id !== 'string') {
      throw new ValidationError('course_id is required and must be a string')
    }

    if (!isValidUUID(body.course_id)) {
      throw new ValidationError('course_id must be a valid UUID')
    }

    const { course_id } = body

    console.log(`[${FUNCTION_NAME}] Request:`, { userId: user.id, courseId: course_id })

    // Verify course exists
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, code, name')
      .eq('id', course_id)
      .single()

    if (courseError || !course) {
      throw new NotFoundError('Course not found')
    }

    // Verify user is enrolled in the course
    const { data: enrollment, error: enrollError } = await supabase
      .from('user_courses')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .maybeSingle()

    if (!enrollment) {
      throw new ForbiddenError('You are not enrolled in this course')
    }

    // Get Trigger.dev config
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
    }

    // Trigger the generate-knowledge-graph task
    console.log(`[${FUNCTION_NAME}] Triggering knowledge graph generation for course:`, course_id)

    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/generate-knowledge-graph/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${triggerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          courseId: course_id,
          forceFresh: true,
        },
      }),
    })

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      console.error(`[${FUNCTION_NAME}] Trigger.dev API error:`, triggerResponse.status, errorText)
      throw new Error(`Failed to trigger knowledge graph generation: ${triggerResponse.status}`)
    }

    const triggerData = await triggerResponse.json()
    console.log(`[${FUNCTION_NAME}] Trigger.dev response:`, triggerData)

    return successResponse({
      success: true,
      courseId: course_id,
      jobId: triggerData.id || triggerData.handle?.id || 'unknown',
      message: `Knowledge graph generation started for ${course.code}`,
    } as TriggerKnowledgeGraphResponse)

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})



