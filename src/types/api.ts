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
  question_id?: string
  message: string
}

export interface RAGChatResponse {
  answer: string
  citations: string[]
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
export interface CreateExamSessionRequest {
  user_id: string
  exam_id: string
}

export type CreateExamSessionResponse = Database['public']['Tables']['exam_sessions']['Row']

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

export interface SubmitExamRequest {
  session_id: string
}

export interface SubmitExamResponse {
  success: boolean
  score: number
  total_questions: number
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
