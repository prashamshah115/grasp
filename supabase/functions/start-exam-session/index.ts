/**
 * Edge Function: start-exam-session
 * Purpose: Securely initialize an exam session with validation
 *
 * Features:
 * - Validates user enrollment in course
 * - Checks for existing active sessions
 * - Loads exam questions in order
 * - Strips correct answers for security
 * - Calculates end time based on duration
 * - Supports storage bucket integration (course-materials/[COURSE]/exams/)
 *
 * Security:
 * - Requires user authentication
 * - Enforces course enrollment
 * - Prevents duplicate active sessions
 * - Never exposes correct answers to client
 *
 * Created: 2025-11-21
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  validateRequired,
  isValidUUID,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../_shared/errors.ts'

// ==================== TYPES ====================

interface StartExamSessionRequest {
  exam_id: string
}

interface StartExamSessionResponse {
  session_id: string
  exam: {
    id: string
    name: string
    exam_type: string
    duration_minutes: number
    total_questions: number
    course_code: string
    course_name: string
  }
  questions: Array<{
    id: string
    question_number: number
    prompt: string
    q_type: string
    options?: any
    difficulty: number
    source_ref?: string
    // NOTE: correct_answer intentionally omitted for security
  }>
  started_at: string
  ends_at: string
  time_remaining_sec: number
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  const FUNCTION_NAME = 'start-exam-session'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    console.log(`[${FUNCTION_NAME}] Request received`)

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Authenticate user
    const { user } = await requireAuth(req, supabase)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Parse and validate request body
    const body = await req.json() as StartExamSessionRequest
    validateRequired(body, ['exam_id'])

    const { exam_id } = body

    // Validate UUID format
    if (!isValidUUID(exam_id)) {
      throw new ValidationError('Invalid exam_id format')
    }

    console.log(`[${FUNCTION_NAME}] Processing exam:`, exam_id)

    // ==================== STEP 1: Validate Exam Exists ====================

    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select(`
        id,
        course_id,
        name,
        exam_type,
        duration_min,
        courses!inner(
          id,
          code,
          name
        )
      `)
      .eq('id', exam_id)
      .single()

    if (examError || !exam) {
      console.error(`[${FUNCTION_NAME}] Exam not found:`, examError)
      throw new NotFoundError('Exam not found')
    }

    console.log(`[${FUNCTION_NAME}] Exam found:`, exam.name)

    // ==================== STEP 2: Check User Enrollment ====================

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('user_courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', exam.course_id)
      .maybeSingle()

    if (enrollmentError) {
      console.error(`[${FUNCTION_NAME}] Enrollment check error:`, enrollmentError)
      throw enrollmentError
    }

    if (!enrollment) {
      console.warn(`[${FUNCTION_NAME}] User not enrolled in course:`, exam.course_id)
      throw new ForbiddenError(
        `You must be enrolled in ${exam.courses.code} to take this exam`
      )
    }

    console.log(`[${FUNCTION_NAME}] User enrollment confirmed`)

    // ==================== STEP 3: Check for Existing Active Session ====================

    const { data: activeSession, error: activeSessionError } = await supabase
      .from('exam_sessions')
      .select('id, started_at, time_remaining_sec')
      .eq('user_id', user.id)
      .eq('exam_id', exam_id)
      .eq('is_completed', false)
      .maybeSingle()

    if (activeSessionError) {
      console.error(`[${FUNCTION_NAME}] Active session check error:`, activeSessionError)
      throw activeSessionError
    }

    if (activeSession) {
      console.warn(`[${FUNCTION_NAME}] Active session already exists:`, activeSession.id)
      throw new ConflictError(
        `You already have an active session for this exam. Session ID: ${activeSession.id}`
      )
    }

    console.log(`[${FUNCTION_NAME}] No active sessions found, proceeding...`)

    // ==================== STEP 4: Load Exam Questions ====================

    // Load exam questions with full question details
    const { data: examQuestions, error: questionsError } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        order_index,
        points,
        questions!inner(
          id,
          prompt,
          q_type,
          options,
          difficulty,
          source_ref,
          correct_answer
        )
      `)
      .eq('exam_id', exam_id)
      .order('order_index', { ascending: true })

    if (questionsError) {
      console.error(`[${FUNCTION_NAME}] Questions load error:`, questionsError)
      throw questionsError
    }

    if (!examQuestions || examQuestions.length === 0) {
      console.error(`[${FUNCTION_NAME}] No questions found for exam:`, exam_id)
      throw new NotFoundError('This exam has no questions configured')
    }

    console.log(`[${FUNCTION_NAME}] Loaded ${examQuestions.length} questions`)

    // ==================== STEP 5: Create Exam Session ====================

    const startedAt = new Date()
    const durationMs = exam.duration_min * 60 * 1000
    const endsAt = new Date(startedAt.getTime() + durationMs)
    const timeRemainingSec = exam.duration_min * 60

    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .insert({
        user_id: user.id,
        exam_id: exam_id,
        started_at: startedAt.toISOString(),
        time_remaining_sec: timeRemainingSec,
        is_completed: false,
        score: null,
        submitted_at: null,
      })
      .select()
      .single()

    if (sessionError) {
      console.error(`[${FUNCTION_NAME}] Session creation error:`, sessionError)
      throw sessionError
    }

    console.log(`[${FUNCTION_NAME}] Session created:`, session.id)

    // ==================== STEP 6: Format Questions (Strip Correct Answers) ====================

    // SECURITY: Remove correct_answer from questions sent to client
    const sanitizedQuestions = examQuestions.map((eq, index) => ({
      id: eq.questions.id,
      question_number: index + 1,
      prompt: eq.questions.prompt,
      q_type: eq.questions.q_type,
      options: eq.questions.options,
      difficulty: eq.questions.difficulty,
      source_ref: eq.questions.source_ref,
      // correct_answer intentionally omitted
    }))

    // ==================== STEP 7: Build Response ====================

    const response: StartExamSessionResponse = {
      session_id: session.id,
      exam: {
        id: exam.id,
        name: exam.name,
        exam_type: exam.exam_type,
        duration_minutes: exam.duration_min,
        total_questions: examQuestions.length,
        course_code: exam.courses.code,
        course_name: exam.courses.name,
      },
      questions: sanitizedQuestions,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      time_remaining_sec: timeRemainingSec,
    }

    console.log(`[${FUNCTION_NAME}] Success - returning ${sanitizedQuestions.length} questions`)

    return successResponse(response, 200)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
