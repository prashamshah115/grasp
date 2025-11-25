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

// ==================== EXAM ANSWERS (Event Log Pattern) ====================

/**
 * ✅ NEW: Write exam event (Event Log + Snapshot Pattern)
 * This is the core function that implements the event sourcing pattern.
 * Writes event to append-only log, snapshot is updated via database trigger.
 */
export async function writeExamEvent(
  sessionId: string,
  eventType: 'answer' | 'flag' | 'navigate' | 'time_update' | 'start' | 'submit',
  payload: Record<string, any>
) {
  const user = await requireAuth()

  console.log('[writeExamEvent] Writing event:', { sessionId, eventType, payload })

  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    console.error('[writeExamEvent] Session verification failed:', sessionError)
    throw new Error('Exam session not found or access denied')
  }

  // Insert event into append-only log
  // Snapshot will be updated automatically via database trigger
  const { data, error } = await supabase
    .from('events_exam_progress')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      event_type: eventType,
      payload: payload,
    })
    .select()
    .single()

  if (error) {
    console.error('[writeExamEvent] Database error:', error)
    handleSupabaseError(error)
  } else {
    console.log('[writeExamEvent] Event written successfully:', data)
  }
  return data
}

/**
 * ✅ NEW: Submit individual exam answer during exam (uses event log)
 * Legacy function maintained for backward compatibility
 */
export async function submitExamAnswer(
  sessionId: string, 
  questionId: string, 
  answer: string,
  isFlagged?: boolean
) {
  return writeExamEvent(sessionId, 'answer', {
    questionId,
    answer,
    isFlagged: isFlagged ?? false,
  })
}

/**
 * ✅ NEW: Update flag status for an exam answer (uses event log)
 * Legacy function maintained for backward compatibility
 */
export async function updateExamAnswerFlag(
  sessionId: string,
  questionId: string,
  isFlagged: boolean
) {
  return writeExamEvent(sessionId, 'flag', {
    questionId,
    isFlagged,
  })
}

/**
 * ✅ NEW: Fetch exam answers for a session
 * Note: RLS policy ensures user can only see answers for their own sessions
 */
export async function fetchExamAnswers(sessionId: string) {
  const user = await requireAuth()

  // Verify session belongs to user (RLS will enforce this)
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    throw new Error('Exam session not found or access denied')
  }

  const { data, error } = await supabase
    .from('exam_answers')
    .select('*')
    .eq('session_id', sessionId)

  if (error) handleSupabaseError(error)
  return data || []
}

/**
 * ✅ NEW: Fetch user's past exam sessions
 */
export async function fetchUserExamSessions(userId: string, examId?: string) {
  let query = supabase
    .from('exam_sessions')
    .select('*, exams(name, course_id, duration_min)')
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
