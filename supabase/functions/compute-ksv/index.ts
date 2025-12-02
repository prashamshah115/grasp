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
import {
  logFunctionStart,
  logFunctionEnd,
  logQuery,
  logError,
  logValidationError,
  createTimer,
} from '../_shared/logger.ts'

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
  const timer = createTimer(FUNCTION_NAME)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    logFunctionStart(FUNCTION_NAME)
    
    // Authenticate user
    timer.checkpoint('auth_start')
    const { supabase, user } = await requireAuth(req)
    timer.checkpoint('auth_complete', { userId: user.id })

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
    timer.checkpoint('verify_course_start')
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, code, name')
      .eq('id', course_id)
      .single()

    logQuery(FUNCTION_NAME, 'fetch_course', {
      count: course ? 1 : 0,
      error: courseError,
    }, {
      userId: user_id,
      courseId: course_id,
    })

    if (courseError || !course) {
      logError(FUNCTION_NAME, courseError || new Error('Course not found'), {
        step: 'verify_course',
        userId: user_id,
        courseId: course_id,
      })
      timer.end({ success: false, reason: 'course_not_found' })
      throw new NotFoundError('Course not found')
    }
    timer.checkpoint('verify_course_complete', { courseCode: course.code })

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
    timer.checkpoint('compute_ksv_start')
    const { data: ksvRecords, error: computeError } = await supabase
      .rpc('compute_knowledge_state_vector', {
        p_user_id: user_id,
        p_course_id: course_id,
      })

    logQuery(FUNCTION_NAME, 'compute_knowledge_state_vector', {
      count: Array.isArray(ksvRecords) ? ksvRecords.length : 0,
      error: computeError,
    }, {
      userId: user_id,
      courseId: course_id,
    })

    if (computeError) {
      logError(FUNCTION_NAME, computeError, {
        step: 'compute_ksv',
        userId: user_id,
        courseId: course_id,
      })
      timer.end({ success: false, reason: 'rpc_error' })
      throw new Error(`Failed to compute KSV: ${computeError.message}`)
    }

    const recordsUpdated = Array.isArray(ksvRecords) ? ksvRecords.length : 0
    timer.end({
      success: true,
      recordsUpdated,
      courseCode: course.code,
    })

    return successResponse({
      success: true,
      courseId: course_id,
      userId: user_id,
      message: `KSV computed successfully for ${course.code}`,
      recordsUpdated,
    } as ComputeKSVResponse)

  } catch (error) {
    logError(FUNCTION_NAME, error, {
      step: 'unhandled_error',
      userId: (error as any)?.userId || 'unknown',
    })
    timer.end({ success: false, reason: 'unhandled_error' })
    return handleError(error, FUNCTION_NAME)
  }
})

