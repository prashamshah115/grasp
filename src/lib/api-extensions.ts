/**
 * API Extensions - Additional CRUD Operations
 * Phase 5: Complete backend-frontend integration
 *
 * These functions extend api.ts with missing table operations
 */

import { supabase } from './supabase'
import { handleSupabaseError, AuthError } from './errors'

// ==================== AUTH HELPER ====================

async function requireAuth() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new AuthError()
  }

  return user
}

// ==================== DOCUMENTS ====================

/**
 * ✅ NEW: Fetch documents for a course or topic
 */
export async function fetchDocuments(courseId: string, topicId?: string) {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data, error } = await query

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch single document
 */
export async function fetchDocument(documentId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ NEW: Fetch document pages
 */
export async function fetchDocumentPages(documentId: string) {
  const { data, error } = await supabase
    .from('document_pages')
    .select('*')
    .eq('document_id', documentId)
    .order('page_number', { ascending: true })

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch single document page
 */
export async function fetchDocumentPage(pageId: string) {
  const { data, error } = await supabase
    .from('document_pages')
    .select('*')
    .eq('id', pageId)
    .single()

  if (error) handleSupabaseError(error)
  return data
}

// ==================== SESSIONS & HISTORY ====================

/**
 * ✅ NEW: Fetch user's study sessions
 */
export async function fetchUserSessions(userId: string, courseId?: string) {
  let query = supabase
    .from('study_sessions')
    .select('*, courses(code, name)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(50)

  if (courseId) {
    query = query.eq('course_id', courseId)
  }

  const { data, error } = await query

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch session details with attempts
 */
export async function fetchSessionDetails(sessionId: string) {
  const user = await requireAuth()

  const { data: session, error: sessionError } = await supabase
    .from('study_sessions')
    .select('*, courses(code, name), topics(name)')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError) handleSupabaseError(sessionError)

  const { data: attempts, error: attemptsError } = await supabase
    .from('question_attempts')
    .select('*, questions(*)')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (attemptsError) handleSupabaseError(attemptsError)

  return {
    ...session,
    attempts: attempts || [],
  }
}

// ==================== EXAM ANSWERS ====================

/**
 * ✅ NEW: Submit individual exam answer during exam
 */
export async function submitExamAnswer(sessionId: string, questionId: string, answer: string) {
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('exam_answers')
    .upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        question_id: questionId,
        user_answer: answer,
      },
      {
        onConflict: 'session_id,question_id',
      }
    )
    .select()
    .single()

  if (error) handleSupabaseError(error)
  return data
}

/**
 * ✅ NEW: Fetch exam answers for a session
 */
export async function fetchExamAnswers(sessionId: string) {
  const user = await requireAuth()

  const { data, error } = await supabase
    .from('exam_answers')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch user's past exam sessions
 */
export async function fetchUserExamSessions(userId: string, examId?: string) {
  let query = supabase
    .from('exam_sessions')
    .select('*, exams(title, course_id, duration_minutes)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(20)

  if (examId) {
    query = query.eq('exam_id', examId)
  }

  const { data, error } = await query

  if (error) handleSupabaseError(error)
  return data || []
}

// ==================== QUESTION ATTEMPTS ====================

/**
 * ✅ NEW: Fetch question attempts for a user
 */
export async function fetchQuestionAttempts(userId: string, questionId?: string) {
  let query = supabase
    .from('question_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (questionId) {
    query = query.eq('question_id', questionId)
  }

  const { data, error } = await query

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch attempts for a specific topic
 */
export async function fetchTopicAttempts(userId: string, topicId: string) {
  const { data, error } = await supabase
    .from('question_attempts')
    .select('*, questions!inner(*)')
    .eq('user_id', userId)
    .eq('questions.topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) handleSupabaseError(error)
  return data || []
}
