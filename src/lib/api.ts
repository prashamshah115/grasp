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
 */
export async function fetchCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('code', { ascending: true })

  if (error) handleSupabaseError(error)
  return data || []
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
 */
export async function fetchExams(courseId: string) {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (error) handleSupabaseError(error)
  return data || []
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
      exams!inner(
        id,
        name,
        exam_type,
        duration_min,
        course_id,
        courses!inner(
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
  const { data: examQuestions, error: questionsError } = await supabase
    .from('exam_questions')
    .select(`
      question_id,
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
    .order('question_number', { ascending: true })

  if (questionsError) {
    throw questionsError
  }

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

  // Calculate time remaining
  const startedAt = new Date(session.started_at)
  const durationMs = exam.duration_min * 60 * 1000
  const endsAt = new Date(startedAt.getTime() + durationMs)
  const timeRemainingMs = endsAt.getTime() - Date.now()
  const timeRemainingSec = Math.max(0, Math.floor(timeRemainingMs / 1000))

  return {
    session_id: session.id,
    exam: {
      id: exam.id,
      name: exam.name,
      exam_type: exam.exam_type,
      duration_minutes: exam.duration_min,
      total_questions: totalQuestions,
      course_code: course.code,
      course_name: course.name,
    },
    questions,
    started_at: session.started_at,
    ends_at: endsAt.toISOString(),
    time_remaining_sec: timeRemainingSec,
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

  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<CreateExamSessionResponse>(
      'start-exam-session',
      {
        body: {
          exam_id: request.exam_id,
        },
      }
    )

    if (error) throw error
    if (!data) throw new Error('No data returned from start-exam-session')

    return data
  })
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

  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<SubmitExamResponse>(
      'submit-exam',
      {
        body: {
          session_id: request.session_id,
        },
      }
    )

    if (error) throw error
    if (!data) throw new Error('No data returned from submit-exam')

    return data
  })
}

// ==================== EDGE FUNCTIONS ====================

/**
 * ✅ IMPLEMENTED: Call RAG chat endpoint
 * Uses dual-stage retrieval (page → chunk)
 */
export async function ragChat(request: RAGChatRequest): Promise<RAGChatResponse> {
  const user = await requireAuth()

  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<RAGChatResponse>('rag-chat', {
      body: {
        message: request.message,
        topicId: request.topic_id,
        courseId: request.course_id,
        questionId: request.question_id,
      },
    })

    if (error) throw error
    if (!data) throw new Error('No data returned from rag-chat')

    return data
  })
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

  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<UpdateQuestionHistoryResponse>(
      'update-question-history',
      {
        body: {
          questionId: request.question_id,
          isCorrect: request.is_correct,
        },
      }
    )

    if (error) throw error
    if (!data) throw new Error('Failed to update question history')

    return data
  })
}

/**
 * ✅ IMPLEMENTED: Generate compression notes
 * AI-generated study notes for a topic
 */
export async function generateCompression(
  request: GenerateCompressionRequest
): Promise<GenerateCompressionResponse> {
  const user = await requireAuth()

  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<GenerateCompressionResponse>(
      'generate-compression',
      {
        body: {
          topicId: request.topic_id,
        },
      }
    )

    if (error) throw error
    if (!data) throw new Error('Failed to generate compression')

    return data
  })
}

/**
 * ✅ IMPLEMENTED: Update topic mastery
 * Calculates mastery level based on session performance
 */
export async function updateMastery(request: UpdateMasteryRequest): Promise<UpdateMasteryResponse> {
  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke<UpdateMasteryResponse>(
      'update-mastery',
      {
        body: {
          sessionId: request.session_id,
        },
      }
    )

    if (error) throw error
    if (!data) throw new Error('Failed to update mastery')

    return data
  })
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
  return retryWithBackoff(async () => {
    const { data, error } = await supabase.functions.invoke('trigger-ingest', {
      body: { document_id: documentId },
    })

    if (error) throw error
    return data
  })
}

// ==================== USER COURSES ====================

/**
 * Fetch user's enrolled courses
 */
export async function fetchUserCourses() {
  const user = await requireAuth()
  
  const { data, error } = await supabase
    .from('user_courses')
    .select('course_id, courses(*)')
    .eq('user_id', user.id)

  if (error) handleSupabaseError(error)
  return data
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

  if (error) handleSupabaseError(error)
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
 * Uses course-materials bucket and creates both course_uploads and documents records
 * Note: courseId is required for course materials (documents table requires course_id)
 */
export async function uploadCourseMaterial(file: File, courseId: string) {
  const user = await requireAuth()
  
  if (!courseId) {
    throw new ValidationError('Course ID is required for course material uploads')
  }
  
  // Generate unique path: {user_id}/{uuid}-{filename}
  const path = `${user.id}/${crypto.randomUUID()}-${file.name}`
  
  // Upload to course-materials bucket
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('course-materials')
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
  const { error: triggerError } = await supabase.functions.invoke('trigger-ingest', {
    body: {
      document_id: document.id
    }
  })

  if (triggerError) {
    console.error('Failed to trigger ingestion:', triggerError)
    // Don't throw - upload succeeded, ingestion can be retried
  } else if (upload) {
    // Update course_uploads with processed status
    await supabase
      .from('course_uploads')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', upload.id)
  }

  return upload || { id: document.id, storage_path: path, original_filename: file.name }
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
  fetchExamAnswers,
  fetchUserExamSessions,
  fetchQuestionAttempts,
  fetchTopicAttempts,
} from './api-extensions'
