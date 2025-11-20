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
 * ✅ IMPLEMENTED: Create exam session
 */
export async function createExamSession(
  request: CreateExamSessionRequest
): Promise<CreateExamSessionResponse> {
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('exam_sessions')
    .insert({
      user_id: user.id,
      exam_id: request.exam_id,
      started_at: new Date().toISOString(),
      is_completed: false,
    })
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ IMPLEMENTED: Submit exam
 */
export async function submitExam(request: SubmitExamRequest): Promise<SubmitExamResponse> {
  const user = await requireAuth()

  // Get all exam answers
  const { data: answers, error: answersError } = await supabase
    .from('exam_answers')
    .select('question_id, user_answer')
    .eq('session_id', request.session_id)

  if (answersError) handleSupabaseError(answersError)

  // Calculate score
  let correctCount = 0
  const totalQuestions = answers?.length || 0

  for (const answer of answers || []) {
    const question = await fetchQuestion(answer.question_id)
    if (JSON.stringify(question.correct_answer) === JSON.stringify(answer.user_answer)) {
      correctCount++
    }
  }

  const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0

  // Update exam session
  const { error: updateError } = await supabase
    .from('exam_sessions')
    .update({
      submitted_at: new Date().toISOString(),
      is_completed: true,
      score,
    })
    .eq('id', request.session_id)

  if (updateError) handleSupabaseError(updateError)

  return {
    success: true,
    score,
    total_questions: totalQuestions,
  }
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
        user_id: user.id,
        topic_id: request.topic_id,
        question_id: request.question_id,
        message: request.message,
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
          user_id: user.id,
          course_id: request.course_id,
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
          user_id: user.id,
          question_id: request.question_id,
          is_correct: request.is_correct,
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
          user_id: user.id,
          topic_id: request.topic_id,
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
          session_id: request.session_id,
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

  const fileName = `${courseId}/${topicId}/${Date.now()}_${file.name}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('course-docs')
    .upload(fileName, file)

  if (uploadError) handleSupabaseError(uploadError)

  // Create document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      course_id: courseId,
      topic_id: topicId,
      doc_type: 'slides', // TODO: detect from file type
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
    const { data, error } = await supabase.functions.invoke('ingest-document', {
      body: { document_id: documentId },
    })

    if (error) throw error
    return data
  })
}
