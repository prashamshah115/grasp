// Edge Function: /compute-ksv
// Purpose: Trigger KSV computation for a user/course
// Called by: triggerKSVUpdate API function

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

interface ComputeKSVRequest {
  course_id: string
  user_id: string
}

interface ComputeKSVResponse {
  success: boolean
  courseId: string
  userId: string
  message: string
  recordsUpdated: number
}

serve(async (req) => {
  const FUNCTION_NAME = 'compute-ksv'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Parse request
    let body: ComputeKSVRequest
    try {
      body = await req.json() as ComputeKSVRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Validate input
    if (!body.course_id || typeof body.course_id !== 'string') {
      throw new ValidationError('course_id is required and must be a string')
    }

    if (!body.user_id || typeof body.user_id !== 'string') {
      throw new ValidationError('user_id is required and must be a string')
    }

    if (!isValidUUID(body.course_id)) {
      throw new ValidationError('course_id must be a valid UUID')
    }

    if (!isValidUUID(body.user_id)) {
      throw new ValidationError('user_id must be a valid UUID')
    }

    // Verify the user_id matches the authenticated user
    if (body.user_id !== user.id) {
      throw new ForbiddenError('You can only compute KSV for your own account')
    }

    const { course_id, user_id } = body

    console.log(`[${FUNCTION_NAME}] Request:`, { userId: user_id, courseId: course_id })

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
      .eq('user_id', user_id)
      .eq('course_id', course_id)
      .maybeSingle()

    if (!enrollment) {
      throw new ForbiddenError('You are not enrolled in this course')
    }

    // Call the compute_knowledge_state_vector RPC function
    console.log(`[${FUNCTION_NAME}] Computing KSV for user ${user_id}, course ${course_id}`)

    const { data: ksvRecords, error: computeError } = await supabase
      .rpc('compute_knowledge_state_vector', {
        p_user_id: user_id,
        p_course_id: course_id,
      })

    if (computeError) {
      console.error(`[${FUNCTION_NAME}] RPC error:`, computeError)
      throw new Error(`Failed to compute KSV: ${computeError.message}`)
    }

    const recordsUpdated = Array.isArray(ksvRecords) ? ksvRecords.length : 0

    console.log(`[${FUNCTION_NAME}] Successfully computed KSV: ${recordsUpdated} records`)

    return successResponse({
      success: true,
      courseId: course_id,
      userId: user_id,
      message: `KSV computed successfully for ${course.code}`,
      recordsUpdated,
    } as ComputeKSVResponse)

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})

