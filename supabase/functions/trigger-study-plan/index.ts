// Edge Function: /trigger-study-plan
// Purpose: Trigger study plan generation via Trigger.dev worker
// Called by: triggerStudyPlanGeneration API function

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

interface TriggerStudyPlanRequest {
  course_id: string
  user_id: string
  target_date?: string
  daily_minutes?: number
  focus_weak_topics?: boolean
}

interface TriggerStudyPlanResponse {
  success: boolean
  courseId: string
  userId: string
  jobId: string
  message: string
}

serve(async (req) => {
  const FUNCTION_NAME = 'trigger-study-plan'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Parse request
    let body: TriggerStudyPlanRequest
    try {
      body = await req.json() as TriggerStudyPlanRequest
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

    // Use authenticated user's ID (security: users can only create plans for themselves)
    const userId = user.id
    const { course_id } = body

    console.log(`[${FUNCTION_NAME}] Request:`, { userId, courseId: course_id })

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
      .eq('user_id', userId)
      .eq('course_id', course_id)
      .maybeSingle()

    if (!enrollment) {
      throw new ForbiddenError('You are not enrolled in this course')
    }

    // Check prerequisites before triggering
    const { data: prereqData, error: prereqError } = await supabase
      .rpc('check_study_plan_prerequisites', { 
        p_user_id: userId,
        p_course_id: course_id 
      })

    if (prereqError) {
      console.error(`[${FUNCTION_NAME}] Prerequisites check failed:`, prereqError)
      throw new Error('Failed to check prerequisites')
    }

    if (!prereqData || !prereqData.can_generate) {
      const missingItems = prereqData?.missing_items || ['unknown']
      throw new ValidationError(
        `Cannot generate study plan. Missing: ${missingItems.join(', ')}. ` +
        `Please add topics to the course first.`
      )
    }

    // Fetch user final preferences if not provided in request
    let targetDate = body.target_date
    let dailyMinutes = body.daily_minutes || 60
    
    if (!targetDate) {
      const { data: preferences } = await supabase
        .from('user_final_preferences')
        .select('final_exam_date, daily_study_minutes')
        .eq('user_id', userId)
        .eq('course_id', course_id)
        .maybeSingle()
      
      if (preferences?.final_exam_date) {
        targetDate = preferences.final_exam_date
      }
      if (preferences?.daily_study_minutes) {
        dailyMinutes = preferences.daily_study_minutes
      }
    }

    // Get Trigger.dev config
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
    }

    // Create job_status record (pending state)
    const { data: jobStatus, error: jobStatusError } = await supabase
      .from('job_status')
      .insert({
        job_type: 'study_plan',
        course_id: course_id,
        user_id: userId,
        status: 'pending',
        progress_percent: 0,
          metadata: {
            triggered_by: userId,
            course_code: course.code,
            target_date: targetDate,
            daily_minutes: dailyMinutes,
            focus_weak_topics: body.focus_weak_topics !== false,
          },
      })
      .select('id')
      .single()

    if (jobStatusError || !jobStatus) {
      console.error(`[${FUNCTION_NAME}] Failed to create job_status:`, jobStatusError)
      // Continue anyway - task will create it if needed
    }

    // Trigger the generate-study-plan task
    console.log(`[${FUNCTION_NAME}] Triggering study plan generation for course:`, course_id)

    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/generate-study-plan/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${triggerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          userId: userId,
          courseId: course_id,
          targetDate: targetDate,
          dailyMinutes: dailyMinutes,
          focusWeakTopics: body.focus_weak_topics !== false,
          jobStatusId: jobStatus?.id, // Pass job_status ID to task
        },
      }),
    })

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      console.error(`[${FUNCTION_NAME}] Trigger.dev API error:`, triggerResponse.status, errorText)
      
      // Update job_status to failed
      if (jobStatus?.id) {
        await supabase
          .from('job_status')
          .update({
            status: 'failed',
            error_message: `Failed to trigger job: ${triggerResponse.status}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobStatus.id)
      }
      
      throw new Error(`Failed to trigger study plan generation: ${triggerResponse.status}`)
    }

    const triggerData = await triggerResponse.json()
    const runId = triggerData.id || triggerData.handle?.id
    console.log(`[${FUNCTION_NAME}] Trigger.dev response:`, triggerData)

    // Update job_status with trigger_job_id
    if (jobStatus?.id && runId) {
      await supabase
        .from('job_status')
        .update({
          trigger_job_id: runId,
          status: 'running',
        })
        .eq('id', jobStatus.id)
    }

    return successResponse({
      success: true,
      courseId: course_id,
      userId: userId,
      jobId: runId || 'unknown',
      message: `Study plan generation started for ${course.code}`,
    } as TriggerStudyPlanResponse)

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})

