/**
 * API Request/Response Types for Edge Functions
 * All Supabase Edge Function contracts
 */

import { Database } from './database'
import { Citation } from './chat'

// ==================== INGEST DOCUMENT ====================
export interface IngestDocumentRequest {
  document_id: string
}

export interface IngestDocumentResponse {
  success: boolean
  pages_processed: number
}

// ==================== RAG CHAT ====================
export interface RAGChatRequest {
  user_id: string
  topic_id: string
  course_id?: string
  question_id?: string
  message: string
}

export interface RAGChatResponse {
  answer: string
  citations: Array<{
    documentTitle: string
    pageNumber: number
    similarity: number
    docType: string
    publicUrl?: string
  }>
  pages: Array<{
    id: string
    title: string
    page: number
  }>
}

// ==================== GLOBAL PRACTICE ====================
export interface NextGlobalQuestionRequest {
  user_id: string
  course_id: string
  weak_only?: boolean
}

export type NextGlobalQuestionResponse = Database['public']['Tables']['questions']['Row']

// ==================== QUESTION HISTORY ====================
export interface UpdateQuestionHistoryRequest {
  user_id: string
  question_id: string
  is_correct: boolean
}

export interface UpdateQuestionHistoryResponse {
  success: boolean
  next_review: string
}

// ==================== GENERATE COMPRESSION ====================
export interface GenerateCompressionRequest {
  user_id: string
  topic_id: string
}

export interface GenerateCompressionResponse {
  success: boolean
  content: string
}

// ==================== UPDATE MASTERY ====================
export interface UpdateMasteryRequest {
  session_id: string
}

export interface UpdateMasteryResponse {
  success: boolean
}

// ==================== CREATE SESSION ====================
export interface CreateSessionRequest {
  user_id: string
  course_id: string
  topic_id?: string
  exam_id?: string
  mode: 'practice' | 'global' | 'compression' | 'exam'
}

export type CreateSessionResponse = Database['public']['Tables']['study_sessions']['Row']

// ==================== SUBMIT ANSWER ====================
export interface SubmitAnswerRequest {
  session_id: string
  question_id: string
  user_id: string
  answer: string
  time_taken_sec?: number
}

export interface SubmitAnswerResponse {
  is_correct: boolean
  correct_answer: any
  explanation?: string
}

// ==================== END SESSION ====================
export interface EndSessionRequest {
  session_id: string
}

export interface EndSessionResponse {
  success: boolean
  stats: {
    total_questions: number
    correct_answers: number
    accuracy: number
  }
}

// ==================== EXAM SESSION ====================

/**
 * Request to start a new exam session (via start-exam-session edge function)
 */
export interface CreateExamSessionRequest {
  exam_id: string // User ID inferred from auth token
}

/**
 * Response from start-exam-session edge function
 * Includes exam metadata and questions WITHOUT correct answers
 */
export interface CreateExamSessionResponse {
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

export interface SaveExamAnswerRequest {
  session_id: string
  question_id: string
  user_answer: any
  is_flagged?: boolean
}

export interface SaveExamAnswerResponse {
  success: boolean
  time_remaining_sec: number
}

/**
 * Request to submit exam (via submit-exam edge function)
 */
export interface SubmitExamRequest {
  session_id: string // User ID inferred from auth token
}

/**
 * Response from submit-exam edge function
 * Includes detailed breakdown with correct answers (now safe to show)
 */
export interface SubmitExamResponse {
  success: true
  session_id: string
  exam_name: string
  score: number // 0-100 percentage
  points_earned: number
  points_possible: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  time_taken_sec: number
  breakdown: Array<{
    question_id: string
    question_number: number
    prompt: string
    q_type: string
    is_correct: boolean
    user_answer: any
    correct_answer: any // NOW included after submission
    explanation: string | null
    topic_id: string
    points_earned: number
    points_possible: number
  }>
  performance_by_topic: Array<{
    topic_id: string
    topic_name: string
    correct: number
    total: number
    percentage: number
  }>
}

// ==================== UPLOAD DOCUMENT ====================
export interface UploadDocumentRequest {
  course_id: string
  topic_id: string
  doc_type: 'slides' | 'textbook'
  title: string
  file: File
}

export interface UploadDocumentResponse {
  success: boolean
  document_id: string
  storage_path: string
}

// ==================== ERROR TYPES ====================
export interface APIError {
  error: string
  message: string
  code?: string
  context?: any
}

// ==================== GENERIC API RESPONSE ====================
export type APIResponse<T> =
  | { success: true; data: T }
  | { success: false; error: APIError }

// Helper type guards
export function isAPIError(response: any): response is { success: false; error: APIError } {
  return response.success === false && 'error' in response
}

export function isAPISuccess<T>(response: any): response is { success: true; data: T } {
  return response.success === true && 'data' in response
}
