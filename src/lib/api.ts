/**
 * API Wrapper Functions
 * All Supabase operations and Edge Function calls
 *
 * IMPLEMENTATION STATUS:
 * ✅ CRUD Operations (Courses, Topics, Questions)
 * ✅ Edge Functions (RAG, Practice, Compression, Mastery)
 * ✅ Error Handling with retry logic
 * ✅ Type-safe with Database types
 */

import { supabase } from './supabase'
import { retryWithBackoff, handleSupabaseError, AuthError, ValidationError } from './errors'
import { safeInvoke } from './safeInvoke'
import type {
  Database,
  RAGChatRequest,
  RAGChatResponse,
  NextGlobalQuestionRequest,
  NextGlobalQuestionResponse,
  UpdateQuestionHistoryRequest,
  UpdateQuestionHistoryResponse,
  GenerateCompressionRequest,
  GenerateCompressionResponse,
  UpdateMasteryRequest,
  UpdateMasteryResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  EndSessionRequest,
  EndSessionResponse,
  CreateExamSessionRequest,
  CreateExamSessionResponse,
  SubmitExamRequest,
  SubmitExamResponse,
} from '@/types'

// ==================== AUTH HELPERS ====================

async function requireAuth() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new AuthError()
  }

  return user
}

// ==================== COURSES ====================

/**
 * ✅ IMPLEMENTED: Fetch all courses
 * Filters out test courses
 */
export async function fetchCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('code', { ascending: true })

  if (error) handleSupabaseError(error)
  
  // Filter out test courses
  const filtered = (data || []).filter((course) => {
    const isTestCourse = 
      course.id === '11111111-1111-1111-1111-111111111111' ||
      course.name?.toLowerCase().includes('test course') ||
      course.code?.toLowerCase().includes('test');
    return !isTestCourse;
  });
  
  return filtered
}

/**
 * ✅ IMPLEMENTED: Fetch single course by ID
 */
export async function fetchCourse(courseId: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ IMPLEMENTED: Fetch admin-defined courses only
 * Used for "Choose from Courses" modal - excludes user-created courses
 */
export async function fetchAdminCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_admin_defined', true)
    .order('code', { ascending: true })

  if (error) handleSupabaseError(error)
  
  // Filter out test courses
  const filtered = (data || []).filter((course) => {
    const isTestCourse = 
      course.id === '11111111-1111-1111-1111-111111111111' ||
      course.name?.toLowerCase().includes('test course') ||
      course.code?.toLowerCase().includes('test');
    return !isTestCourse;
  });
  
  return filtered
}

/**
 * ✅ IMPLEMENTED: Create a new course
 * User-created courses are marked as is_admin_defined = false
 */
export async function createCourse(code: string, name: string, term?: string) {
  const user = await requireAuth()
  
  if (!code || !name) {
    throw new ValidationError('Course code and name are required')
  }
  
  const { data, error } = await supabase
    .from('courses')
    .insert({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      term: term || null,
      is_admin_defined: false, // User-created courses are not admin-defined
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  
  // Auto-enroll user in the course they just created
  try {
    await addUserCourse(data.id)
  } catch (enrollError) {
    console.error('Failed to auto-enroll in created course:', enrollError)
    // Don't throw - course was created successfully
  }
  
  return data
}

/**
 * ✅ IMPLEMENTED: Fetch topics for a course
 */
export async function fetchTopics(courseId: string) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ IMPLEMENTED: Fetch single topic
 */
export async function fetchTopic(topicId: string) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

// ==================== QUESTIONS ====================

/**
 * ✅ IMPLEMENTED: Fetch questions for a topic
 */
export async function fetchQuestions(topicId: string) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ IMPLEMENTED: Fetch single question
 */
export async function fetchQuestion(questionId: string) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

// ==================== MASTERY ====================

/**
 * ✅ IMPLEMENTED: Fetch topic mastery for user
 */
export async function fetchTopicMastery(userId: string, topicId: string) {
  const { data, error } = await supabase
    .from('topic_mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found, which is OK (no mastery yet)
    handleSupabaseError(error)
  }

  return data
}

/**
 * ✅ IMPLEMENTED: Fetch all topic mastery for a course
 */
export async function fetchCourseMastery(userId: string, courseId: string) {
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id')
    .eq('course_id', courseId)

  if (topicsError) handleSupabaseError(topicsError)

  const topicIds = topics?.map((t) => t.id) || []

  const { data, error } = await supabase
    .from('topic_mastery')
    .select('*')
    .eq('user_id', userId)
    .in('topic_id', topicIds)

  if (error) handleSupabaseError(error)
  return data || []
}

// ==================== COMPRESSION NOTES ====================

/**
 * ✅ IMPLEMENTED: Fetch compression notes for a topic
 */
export async function fetchCompressionNotes(userId: string, topicId: string) {
  const { data, error } = await supabase
    .from('compression_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .single()

  if (error && error.code !== 'PGRST116') {
    handleSupabaseError(error)
  }

  return data
}

// ==================== SESSIONS ====================

/**
 * ✅ IMPLEMENTED: Create study session
 */
export async function createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: user.id,
      course_id: request.course_id,
      topic_id: request.topic_id || null,
      exam_id: request.exam_id || null,
      mode: request.mode,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ IMPLEMENTED: Submit answer to question
 */
export async function submitAnswer(request: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
  const user = await requireAuth()

  // Get question to check correct answer
  const question = await fetchQuestion(request.question_id)

  const isCorrect = JSON.stringify(question.correct_answer) === JSON.stringify(request.answer)

  // Insert attempt
  const { error } = await supabase.from('question_attempts').insert({
    session_id: request.session_id,
    user_id: user.id,
    question_id: request.question_id,
    user_answer: request.answer,
    is_correct: isCorrect,
    time_taken_sec: request.time_taken_sec || null,
  })

  if (error) handleSupabaseError(error)

  return {
    is_correct: isCorrect,
    correct_answer: question.correct_answer,
    explanation: question.explanation || undefined,
  }
}

/**
 * ✅ IMPLEMENTED: End study session
 */
export async function endSession(request: EndSessionRequest): Promise<EndSessionResponse> {
  const user = await requireAuth()

  // Update session end time
  const { error: updateError } = await supabase
    .from('study_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', request.session_id)

  if (updateError) handleSupabaseError(updateError)

  // Get session stats
  const { data: attempts, error: attemptsError } = await supabase
    .from('question_attempts')
    .select('is_correct')
    .eq('session_id', request.session_id)

  if (attemptsError) handleSupabaseError(attemptsError)

  const totalQuestions = attempts?.length || 0
  const correctAnswers = attempts?.filter((a) => a.is_correct).length || 0
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0

  return {
    success: true,
    stats: {
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      accuracy,
    },
  }
}

// ==================== EXAMS ====================

/**
 * ✅ IMPLEMENTED: Fetch all exams for a course
 * Includes question count for each exam
 */
export async function fetchExams(courseId: string) {
  const { data, error } = await supabase
    .from('exams')
    .select(`
      *,
      exam_questions(count)
    `)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (error) handleSupabaseError(error)
  
  // Transform the data to add num_questions field
  const examsWithCounts = data?.map(exam => ({
    ...exam,
    num_questions: exam.exam_questions?.[0]?.count || 0
  })) || []

  return examsWithCounts
}

/**
 * ✅ IMPLEMENTED: Fetch single exam by ID
 */
export async function fetchExam(examId: string) {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ IMPLEMENTED: Fetch exam session by ID
 */
export async function fetchExamSession(sessionId: string) {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ NEW: Update time remaining for an exam session
 * Used for saving progress when exiting or periodically
 */
export async function updateExamSessionTimeRemaining(
  sessionId: string,
  timeRemainingSec: number
) {
  // Use event log pattern - write time_update event
  // Snapshot will be updated automatically via database trigger
  const { writeExamEvent } = await import('./api-extensions')
  return writeExamEvent(sessionId, 'time_update', {
    timeRemainingSec: Math.max(0, timeRemainingSec),
  })
}

/**
 * ✅ IMPLEMENTED: Get active exam sessions for a course
 * Used for exam resumption feature
 */
export async function getActiveExamSessions(courseId: string) {
  const user = await requireAuth()

  console.log('[getActiveExamSessions] Fetching active sessions for course:', courseId, 'user:', user.id)

  // First, get all active sessions for the user
  const { data: allActiveSessions, error: sessionsError } = await supabase
    .from('exam_sessions')
    .select(`
      id,
      exam_id,
      started_at,
      time_remaining_sec,
      is_completed
    `)
    .eq('user_id', user.id)
    .eq('is_completed', false)
    .order('started_at', { ascending: false })

  if (sessionsError) {
    console.error('[getActiveExamSessions] Error fetching sessions:', sessionsError)
    handleSupabaseError(sessionsError)
    return []
  }

  if (!allActiveSessions || allActiveSessions.length === 0) {
    console.log('[getActiveExamSessions] No active sessions found')
    return []
  }

  console.log('[getActiveExamSessions] Found', allActiveSessions.length, 'active sessions')

  // Get exam IDs from active sessions
  const examIds = allActiveSessions.map(s => s.exam_id)

  // Fetch exams for these exam IDs and filter by course_id
  const { data: exams, error: examsError } = await supabase
    .from('exams')
    .select('id, name, course_id')
    .in('id', examIds)
    .eq('course_id', courseId)

  if (examsError) {
    console.error('[getActiveExamSessions] Error fetching exams:', examsError)
    handleSupabaseError(examsError)
    return []
  }

  if (!exams || exams.length === 0) {
    console.log('[getActiveExamSessions] No exams found for course:', courseId)
    return []
  }

  // Create set of exam IDs in this course
  const courseExamIds = new Set(exams.map(e => e.id))

  // Filter sessions to only include those for exams in this course
  const filteredSessions = allActiveSessions
    .filter(session => courseExamIds.has(session.exam_id))
    .map(session => {
      const exam = exams.find(e => e.id === session.exam_id)
      return {
        ...session,
        exams: exam ? {
          id: exam.id,
          name: exam.name,
          course_id: exam.course_id
        } : null
      }
    })

  console.log('[getActiveExamSessions] Returning', filteredSessions.length, 'sessions for course')
  return filteredSessions
}

/**
 * ✅ NEW: Fetch full exam session with questions and metadata
 * Used for loading existing exam sessions (e.g., on page refresh)
 * Returns questions WITHOUT correct answers for security
 */
export async function fetchExamSessionWithQuestions(
  sessionId: string
): Promise<CreateExamSessionResponse> {
  const user = await requireAuth()

  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select(`
      id,
      exam_id,
      user_id,
      started_at,
      time_remaining_sec,
      is_completed,
      answers,
      state,
      current_question_index,
      exams!inner(
        id,
        name,
        exam_type,
        duration_min,
        course_id,
        courses!inner(
          id,
          code,
          name
        )
      )
    `)
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    throw new Error('Exam session not found or access denied')
  }

  if (session.is_completed) {
    throw new Error('This exam has already been submitted')
  }

  const exam = session.exams as any
  const course = exam.courses

  // Fetch questions for this exam (WITHOUT correct_answer)
  console.log('[fetchExamSessionWithQuestions] Fetching questions for exam:', session.exam_id)
  const { data: examQuestions, error: questionsError } = await supabase
    .from('exam_questions')
    .select(`
      question_id,
      order_index,
      questions!inner(
        id,
        prompt,
        q_type,
        options,
        difficulty,
        source_ref,
        hint
      )
    `)
    .eq('exam_id', session.exam_id)
    .order('order_index', { ascending: true })

  if (questionsError) {
    console.error('[fetchExamSessionWithQuestions] Error fetching questions:', questionsError)
    console.error('[fetchExamSessionWithQuestions] Error details:', {
      message: questionsError.message,
      details: questionsError.details,
      hint: questionsError.hint,
      code: questionsError.code
    })
    throw questionsError
  }

  console.log('[fetchExamSessionWithQuestions] Fetched', examQuestions?.length || 0, 'questions')

  // Calculate total questions
  const totalQuestions = examQuestions?.length || 0

  // Format questions (without correct_answer)
  const questions = examQuestions?.map((eq: any, index: number) => ({
    id: eq.questions.id,
    question_number: index + 1,
    prompt: eq.questions.prompt,
    q_type: eq.questions.q_type,
    options: eq.questions.options,
    difficulty: eq.questions.difficulty,
    source_ref: eq.questions.source_ref,
    hint: eq.questions.hint,
    // correct_answer intentionally omitted for security
  })) || []

  // Use time_remaining_sec from database (for resuming exams)
  // If not available, calculate from started_at
  const startedAt = new Date(session.started_at)
  let timeRemainingSec = session.time_remaining_sec
  
  if (timeRemainingSec === null || timeRemainingSec === undefined) {
    // Calculate from start time (fallback for new sessions)
    const durationMs = exam.duration_min * 60 * 1000
    const endsAt = new Date(startedAt.getTime() + durationMs)
    const timeRemainingMs = endsAt.getTime() - Date.now()
    timeRemainingSec = Math.max(0, Math.floor(timeRemainingMs / 1000))
  }
  
  //   // Calculate ends_at based on CURRENT time + remaining time (not start time)
  // This ensures time doesn't revert when resuming
  const endsAt = new Date(Date.now() + timeRemainingSec * 1000)

  return {
    session_id: session.id,
    exam: {
      id: exam.id,
      name: exam.name,
      exam_type: exam.exam_type,
      duration_minutes: exam.duration_min,
      total_questions: totalQuestions,
      course_id: exam.course_id,
      course_code: course.code,
      course_name: course.name,
    },
    questions,
    started_at: session.started_at,
    ends_at: endsAt.toISOString(),
    time_remaining_sec: timeRemainingSec,
    // Include snapshot fields for resume capability
    answers: (session as any).answers || {},
    state: (session as any).state || {},
    current_question_index: (session as any).current_question_index || 0,
  }
}

/**
 * ✅ IMPLEMENTED: Create exam session (SERVER-SIDE via edge function)
 * Securely initializes exam session with:
 * - User enrollment validation
 * - Duplicate session prevention
 * - Questions loaded without correct answers
 * - Server-side authorization
 */
export async function createExamSession(
  request: CreateExamSessionRequest
): Promise<CreateExamSessionResponse> {
  const user = await requireAuth()

  console.log('[createExamSession] Starting exam session creation for exam:', request.exam_id)
  console.log('[createExamSession] User ID:', user.id)

  // Don't use retryWithBackoff for this - we want the actual error message
  const { data, error } = await supabase.functions.invoke<CreateExamSessionResponse>(
    'start-exam-session',
    {
      body: {
        exam_id: request.exam_id,
      },
    }
  )

  console.log('[createExamSession] Response received')
  console.log('[createExamSession] Data:', data)
  console.log('[createExamSession] Error:', error)

  if (error) {
    console.error('[createExamSession] Edge function error:', error)
    // Try to extract more details from the error
    const errorDetails = {
      message: error.message,
      context: error.context,
      statusCode: (error as any).statusCode || (error as any).status,
      details: (error as any).details,
    }
    console.error('[createExamSession] Error details:', errorDetails)
    throw error
  }
  if (!data) {
    console.error('[createExamSession] No data returned from edge function')
    throw new Error('No data returned from start-exam-session')
  }

  console.log('[createExamSession] Success! Session ID:', data.session_id)
  return data
}

/**
 * ✅ IMPLEMENTED: Submit exam (SERVER-SIDE via edge function)
 * Securely scores exam with:
 * - Server-side answer validation
 * - Hidden correct answers during exam
 * - Ownership verification
 * - Double submission prevention
 * - Performance tracking by topic
 * - Question attempt recording for spaced repetition
 */
export async function submitExam(request: SubmitExamRequest): Promise<SubmitExamResponse> {
  const user = await requireAuth()

  return safeInvoke<SubmitExamResponse>(
    'submit-exam',
    {
      body: {
        session_id: request.session_id,
      },
    }
  )
}

// ==================== EDGE FUNCTIONS ====================

/**
 * ✅ IMPLEMENTED: Call RAG chat endpoint
 * Uses dual-stage retrieval (page → chunk)
 */
export async function ragChat(request: RAGChatRequest): Promise<RAGChatResponse> {
  const user = await requireAuth()

  console.log('[ragChat] Calling edge function with request:', {
    message: request.message?.substring(0, 50),
    topicId: request.topic_id,
    courseId: request.course_id,
    questionId: request.question_id,
    userId: user.id,
  })

  try {
    // Normalize empty strings to null/undefined for UUID fields
    const normalizedTopicId = request.topic_id && request.topic_id.trim() !== '' ? request.topic_id : undefined
    const normalizedCourseId = request.course_id && request.course_id.trim() !== '' ? request.course_id : undefined
    const normalizedQuestionId = request.question_id && request.question_id.trim() !== '' ? request.question_id : undefined

    const result = await safeInvoke<RAGChatResponse>(
      'rag-chat',
      {
        body: {
          message: request.message,
          topicId: normalizedTopicId,
          courseId: normalizedCourseId,
          questionId: normalizedQuestionId,
          compressionNotes: request.compression_notes,
          conversationHistory: request.conversation_history,
        },
      }
    )
    console.log('[ragChat] Success! Got response:', {
      answerLength: result.answer?.length,
      citationsCount: result.citations?.length,
      pagesCount: result.pages?.length,
    })
    return result
  } catch (error: any) {
    console.error('[ragChat] Edge function call failed:', {
      error: error.message,
      status: error.status,
      code: error.code,
      context: error.context,
      stack: error.stack,
    })
    throw error
  }
}

/**
 * ✅ IMPLEMENTED: Get next global practice question
 * Uses spaced repetition algorithm
 */
export async function getNextGlobalQuestion(
  request: NextGlobalQuestionRequest
): Promise<NextGlobalQuestionResponse> {
  const user = await requireAuth()

  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<NextGlobalQuestionResponse>(
      'next-global-question',
      {
        body: {
          courseId: request.course_id,
          weakOnly: request.weak_only === true,
        },
      }
    )

    if (error) throw error
    if (!data) throw new Error('No question available')
    return data
  })
}

/**
 * ✅ IMPLEMENTED: Update question history
 * Implements SM-2 spaced repetition
 */
export async function updateQuestionHistory(
  request: UpdateQuestionHistoryRequest
): Promise<UpdateQuestionHistoryResponse> {
  const user = await requireAuth()

  return safeInvoke<UpdateQuestionHistoryResponse>(
    'update-question-history',
    {
      body: {
        questionId: request.question_id,
        isCorrect: request.is_correct,
      },
    }
  )
}

/**
 * ✅ IMPLEMENTED: Generate compression notes
 * AI-generated study notes for a topic
 */
export async function generateCompression(
  request: GenerateCompressionRequest
): Promise<GenerateCompressionResponse> {
  const user = await requireAuth()

  console.log('[generateCompression] Calling edge function with request:', {
    topicId: request.topic_id,
    userId: request.user_id,
    actualUserId: user.id,
  })

  try {
    const result = await safeInvoke<GenerateCompressionResponse>(
      'generate-compression',
      {
        body: {
          topicId: request.topic_id,
        },
      }
    )
    console.log('[generateCompression] Success! Got response:', {
      contentLength: result.content?.length,
      topicId: result.topic_id,
    })
    return result
  } catch (error: any) {
    console.error('[generateCompression] Edge function call failed:', {
      error: error.message,
      status: error.status,
      code: error.code,
      context: error.context,
      stack: error.stack,
    })
    throw error
  }
}

/**
 * ✅ IMPLEMENTED: Update topic mastery
 * Calculates mastery level based on session performance
 */
export async function updateMastery(request: UpdateMasteryRequest): Promise<UpdateMasteryResponse> {
  return safeInvoke<UpdateMasteryResponse>(
    'update-mastery',
    {
      body: {
        sessionId: request.session_id,
      },
    }
  )
}

// ==================== DOCUMENT UPLOAD ====================

/**
 * ✅ IMPLEMENTED: Upload document to Supabase Storage
 */
export async function uploadDocument(file: File, courseId: string, topicId: string) {
  const user = await requireAuth()

  // Upload to user-content bucket (private, user-scoped)
  // Path format: {user_id}/courses/{courseId}/{topicId}/{timestamp}_{filename}
  const fileName = `courses/${courseId}/${topicId}/${Date.now()}_${file.name}`
  const filePath = `${user.id}/${fileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('user-content')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false
    })

  if (uploadError) handleSupabaseError(uploadError)

  // Detect document type from filename
  const detectDocType = (filename: string): string => {
    const lower = filename.toLowerCase()
    if (lower.includes('lecture') || lower.includes('slides')) return 'slides'
    if (lower.includes('textbook') || lower.includes('book')) return 'textbook'
    if (lower.includes('homework') || lower.includes('assignment')) return 'homework'
    if (lower.includes('exam') || lower.includes('quiz') || lower.includes('test')) return 'exam'
    if (lower.includes('notes')) return 'notes'
    return 'other'
  }

  // Create document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      course_id: courseId,
      topic_id: topicId,
      doc_type: detectDocType(file.name),
      title: file.name,
      storage_path: uploadData.path,
      total_pages: 0, // Will be updated after ingestion
      has_images: false,
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)

  return data
}

/**
 * ✅ IMPLEMENTED: Trigger document ingestion
 * Calls Edge Function to process PDF
 */
export async function ingestDocument(documentId: string) {
  return safeInvoke(
    'trigger-ingest',
    {
      body: { document_id: documentId },
    }
  )
}

// ==================== USER COURSES ====================

/**
 * Fetch user's enrolled courses
 * Filters out test course enrollments
 */
export async function fetchUserCourses() {
  const user = await requireAuth()
  
  const { data, error } = await supabase
    .from('user_courses')
    .select('course_id, courses(*)')
    .eq('user_id', user.id)

  if (error) handleSupabaseError(error)
  
  // Filter out test course enrollments
  const filtered = (data || []).filter((uc: any) => {
    const course = uc.courses;
    if (!course) return false;
    
    const isTestCourse = 
      course.id === '11111111-1111-1111-1111-111111111111' ||
      course.name?.toLowerCase().includes('test course') ||
      course.code?.toLowerCase().includes('test');
    return !isTestCourse;
  });
  
  return filtered
}

/**
 * Add course to user's enrolled courses
 */
export async function addUserCourse(courseId: string) {
  const user = await requireAuth()
  
  const { data, error } = await supabase
    .from('user_courses')
    .insert({
      user_id: user.id,
      course_id: courseId
    })
    .select()
    .single()

  // Handle duplicate enrollment gracefully
  if (error) {
    // Check if it's a unique constraint violation (23505)
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      // User is already enrolled - return existing enrollment
      const { data: existing } = await supabase
        .from('user_courses')
        .select()
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()
      
      if (existing) {
        return existing // Return existing enrollment (idempotent)
      }
    }
    handleSupabaseError(error)
  }
  
  return data
}

/**
 * Remove course from user's enrolled courses
 */
export async function removeUserCourse(courseId: string) {
  const user = await requireAuth()
  
  const { error } = await supabase
    .from('user_courses')
    .delete()
    .eq('user_id', user.id)
    .eq('course_id', courseId)

  if (error) handleSupabaseError(error)
}

// ==================== PREMIUM USERS ====================

/**
 * Check if user has premium subscription
 */
export async function checkPremiumStatus() {
  const user = await requireAuth()
  
  const { data, error } = await supabase
    .from('premium_users')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    handleSupabaseError(error)
  }
  
  return data || null
}

// ==================== COURSE UPLOADS ====================

/**
 * Upload course material file
 * Uses user-content bucket (private, user-scoped) and creates both course_uploads and documents records
 * Note: courseId is required for course materials (documents table requires course_id)
 */
export async function uploadCourseMaterial(file: File, courseId: string) {
  const user = await requireAuth()
  
  if (!courseId) {
    throw new ValidationError('Course ID is required for course material uploads')
  }
  
  // Generate unique path: {user_id}/{uuid}-{filename}
  const path = `${user.id}/${crypto.randomUUID()}-${file.name}`
  
  // Upload to user-content bucket (private, user-scoped)
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('user-content')
    .upload(path, file, {
      contentType: 'application/pdf',
      upsert: false
    })

  if (uploadError) handleSupabaseError(uploadError)

  // Create document record (required for ingestion pipeline)
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      course_id: courseId,
      topic_id: null,
      doc_type: 'slides',
      title: file.name,
      storage_path: path,
      storage_bucket: 'user-content',
      total_pages: 0,
      has_images: false,
    })
    .select()
    .single()

  if (docError) handleSupabaseError(docError)

  // Create course_uploads record (for tracking user uploads)
  const { data: upload, error: uploadRecordError } = await supabase
    .from('course_uploads')
    .insert({
      user_id: user.id,
      course_id: courseId,
      storage_path: path,
      original_filename: file.name,
      processed: false
    })
    .select()
    .single()

  if (uploadRecordError) {
    // If course_uploads fails, we still have the document, so log and continue
    console.error('Failed to create course_uploads record:', uploadRecordError)
  }

  // Trigger background ingestion
  try {
    await safeInvoke('trigger-ingest', {
      body: {
        document_id: document.id
      }
    })
  } catch (triggerError) {
    console.error('Failed to trigger ingestion:', triggerError)
    // Don't throw - upload succeeded, ingestion can be retried
  }
  
  // Update course_uploads with processed status if upload record exists
  if (upload) {
    await supabase
      .from('course_uploads')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', upload.id)
  }

  return upload || { id: document.id, storage_path: path, original_filename: file.name }
}

// ==================== RELEVANT CONTENT ====================

export interface RelevantContentChunk {
  id: string
  content: string
  doc_title: string
  page_number: number
  doc_type: string
  similarity: number
  document_id: string
}

export interface RelevantContentResponse {
  chunks: RelevantContentChunk[]
  total: number
  source: 'vector' | 'topic' | 'none'
}

export interface GetRelevantContentRequest {
  questionId?: string
  questionText?: string
  topicId?: string
  courseId?: string
}

/**
 * Fetch relevant course content for a question
 * Uses vector search with topic-based fallback
 */
export async function getRelevantContent(
  request: GetRelevantContentRequest
): Promise<RelevantContentResponse> {
  const user = await requireAuth()

  return safeInvoke<RelevantContentResponse>(
    'get-relevant-content',
    {
      body: {
        questionId: request.questionId,
        questionText: request.questionText,
        topicId: request.topicId,
        courseId: request.courseId,
      },
    }
  )
}

// ==================== KNOWLEDGE GRAPH & OBJECTS ====================

/**
 * ✅ NEW: Fetch concepts for a course
 */
export async function fetchConcepts(courseId: string, topicId?: string) {
  let query = supabase
    .from('concepts')
    .select('*')
    .eq('course_id', courseId)
    .order('title', { ascending: true })

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data, error } = await query

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch formulas for a course or topic
 */
export async function fetchFormulas(courseId: string, topicId?: string) {
  let query = supabase
    .from('formulas')
    .select('*, concepts(title)')
    .eq('course_id', courseId)
    .order('name', { ascending: true })

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data, error } = await query

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch knowledge objects for a topic
 */
export async function fetchKnowledgeObjects(topicId: string) {
  const { data, error } = await supabase
    .from('knowledge_objects')
    .select('*')
    .eq('topic_id', topicId)
    .order('object_type', { ascending: true })

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch course knowledge graph (topic relationships)
 */
export async function fetchCourseGraph(courseId: string) {
  const { data, error } = await supabase
    .from('course_graph_edges')
    .select(`
      *,
      topic_a_data:topics!course_graph_edges_topic_a_fkey(id, name, slug),
      topic_b_data:topics!course_graph_edges_topic_b_fkey(id, name, slug)
    `)
    .eq('course_id', courseId)

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch concept relationships
 */
export async function fetchConceptRelationships(courseId: string) {
  // First get all concepts for this course
  const { data: concepts, error: conceptsError } = await supabase
    .from('concepts')
    .select('id')
    .eq('course_id', courseId)

  if (conceptsError) handleSupabaseError(conceptsError)
  
  const conceptIds = concepts?.map(c => c.id) || []
  if (conceptIds.length === 0) return []

  const { data, error } = await supabase
    .from('concept_relationships')
    .select(`
      *,
      concept:concepts!concept_relationships_concept_id_fkey(id, title),
      related:concepts!concept_relationships_related_concept_id_fkey(id, title)
    `)
    .in('concept_id', conceptIds)

  if (error) handleSupabaseError(error)
  return data || []
}

// ==================== FINAL PACKS ====================

/**
 * ✅ NEW: Fetch all final packs for a course
 */
export async function fetchFinalPacks(courseId: string) {
  const { data, error } = await supabase
    .from('final_packs')
    .select('*')
    .eq('course_id', courseId)
    .order('tier', { ascending: true })

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch specific final pack tier
 */
export async function fetchFinalPack(courseId: string, tier: 'essentials' | 'must_solve' | 'drills') {
  const { data, error } = await supabase
    .from('final_packs')
    .select('*')
    .eq('course_id', courseId)
    .eq('tier', tier)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    handleSupabaseError(error)
  }
  return data
}

/**
 * ✅ NEW: Trigger final pack generation via Trigger.dev
 * This calls an edge function that triggers the Trigger.dev task
 */
export async function triggerFinalPackGeneration(courseId: string) {
  const user = await requireAuth()

  return safeInvoke(
    'trigger-final-packs',
    {
      body: { course_id: courseId },
    }
  )
}

/**
 * ✅ NEW: Trigger knowledge graph generation via Trigger.dev
 */
export async function triggerKnowledgeGraphGeneration(courseId: string) {
  const user = await requireAuth()

  return safeInvoke(
    'trigger-knowledge-graph',
    {
      body: { course_id: courseId },
    }
  )
}

// ==================== KNOWLEDGE STATE VECTOR (KSV) ====================

/**
 * Fetch knowledge state vector for a course
 */
export async function fetchKnowledgeStateVector(courseId: string, userId: string) {
  const { data, error } = await supabase
    .from('knowledge_state_vector')
    .select(`
      *,
      topic:topics(id, name, slug)
    `)
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .order('recommendation_score', { ascending: false })

  if (error) {
    console.error('Error fetching knowledge state vector:', error)
    throw error
  }

  // Transform to include topic name and slug
  return (data || []).map((item: any) => ({
    ...item,
    topic_name: item.topic?.name,
    topic_slug: item.topic?.slug,
  }))
}

/**
 * Fetch recommended topics with justifications
 */
export async function fetchRecommendedTopics(
  courseId: string,
  userId: string,
  limit: number = 3
) {
  const { data, error } = await supabase
    .from('knowledge_state_vector')
    .select(`
      *,
      topic:topics(id, name, slug)
    `)
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .order('recommendation_score', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recommended topics:', error)
    throw error
  }

  return (data || []).map((item: any) => {
    const weakness_score = 1 - item.knowledge_strength
    const importance_score = item.graph_out_degree > 0 ? 1 : 0
    
    // Generate justification
    let justification = 'Recommended for review'
    if (weakness_score > 0.7) {
      justification = 'Weak in prerequisites'
    } else if (item.graph_out_degree > 2) {
      justification = 'High importance (many downstream topics)'
    } else if (item.error_rate > 0.5) {
      justification = 'High error rate in recent attempts'
    } else if (!item.last_reviewed_at) {
      justification = 'Not reviewed recently'
    }

    return {
      topic_id: item.topic_id,
      topic_name: item.topic?.name || 'Unknown',
      recommendation_score: item.recommendation_score,
      priority_rank: item.priority_rank,
      justification,
      knowledge_strength: item.knowledge_strength,
      weakness_score,
      importance_score,
    }
  })
}

/**
 * Calculate predicted final exam score
 */
export async function calculatePredictionScore(courseId: string, userId: string) {
  // Get all KSV for the course
  const ksvData = await fetchKnowledgeStateVector(courseId, userId)

  if (ksvData.length === 0) {
    return {
      predicted_score: 0,
      confidence: 0,
      improvement_potential: 0,
      fixable_topics: [],
    }
  }

  // Calculate average knowledge strength (weighted by graph importance)
  const totalStrength = ksvData.reduce((sum, ksv) => {
    const weight = 1 + (ksv.graph_out_degree * 0.1) // More important topics weighted higher
    return sum + (ksv.knowledge_strength * weight)
  }, 0)

  const totalWeight = ksvData.reduce((sum, ksv) => {
    return sum + (1 + (ksv.graph_out_degree * 0.1))
  }, 0)

  const avgStrength = totalWeight > 0 ? totalStrength / totalWeight : 0

  // Convert to predicted score (0-100)
  const predicted_score = Math.round(avgStrength * 100)

  // Calculate confidence based on coverage
  const avgCoverage = ksvData.reduce((sum, ksv) => sum + ksv.coverage, 0) / ksvData.length
  const confidence = Math.round(avgCoverage * 100)

  // Find fixable topics (low strength, high importance)
  const fixable_topics = ksvData
    .filter(ksv => ksv.knowledge_strength < 0.6 && ksv.graph_out_degree > 0)
    .sort((a, b) => {
      // Sort by potential gain (importance * weakness)
      const gainA = (1 - a.knowledge_strength) * (1 + a.graph_out_degree * 0.1)
      const gainB = (1 - b.knowledge_strength) * (1 + b.graph_out_degree * 0.1)
      return gainB - gainA
    })
    .slice(0, 3)
    .map(ksv => ({
      topic_id: ksv.topic_id,
      topic_name: ksv.topic_name || 'Unknown',
      potential_gain: Math.round((1 - ksv.knowledge_strength) * 10), // Estimated points
      current_strength: ksv.knowledge_strength,
    }))

  // Calculate improvement potential
  const improvement_potential = fixable_topics.reduce((sum, topic) => sum + topic.potential_gain, 0)

  return {
    predicted_score,
    confidence,
    improvement_potential,
    fixable_topics,
  }
}

/**
 * Trigger KSV update via edge function
 */
export async function triggerKSVUpdate(courseId: string, userId: string) {
  const user = await requireAuth()

  return safeInvoke(
    'compute-ksv',
    {
      body: {
        course_id: courseId,
        user_id: userId,
      },
    }
  )
}

// ==================== WEB SEARCH ====================

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  score?: number
}

export interface WebSearchResponse {
  results: WebSearchResult[]
  query: string
}

/**
 * ✅ NEW: Search the web using Tavily API
 * Used for RAG enhancement with real-time information
 */
export async function searchWeb(query: string): Promise<WebSearchResponse> {
  const user = await requireAuth()

  return safeInvoke<WebSearchResponse>(
    'search-web',
    {
      body: { query },
    }
  )
}

// ==================== RE-EXPORT EXTENSIONS ====================
// Phase 5: Additional API functions for complete backend coverage
export {
  fetchDocuments,
  fetchDocument,
  fetchDocumentPages,
  fetchDocumentPage,
  fetchUserSessions,
  fetchSessionDetails,
  submitExamAnswer,
  updateExamAnswerFlag,
  fetchExamAnswers,
  fetchUserExamSessions,
  fetchQuestionAttempts,
  fetchTopicAttempts,
} from './api-extensions'
