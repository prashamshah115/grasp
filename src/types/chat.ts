/**
 * Chat Types
 * 
 * TypeScript types for the persistent chat assistant system.
 * Includes threads, messages, and RAG context audit trail.
 */

// ============================================
// DATABASE TYPES
// ============================================

/**
 * Chat thread - represents a conversation session
 */
export interface ChatThread {
  id: string
  user_id: string
  course_id: string | null
  topic_id: string | null
  title: string | null
  model: string
  system_prompt: string | null
  status: 'active' | 'archived'
  last_user_message_at: string
  created_at: string
  updated_at: string
}

/**
 * Chat message - individual message in a thread
 */
export interface ChatMessage {
  id: string
  thread_id: string
  user_id: string | null
  role: 'user' | 'assistant' | 'system' | 'context'
  content: string
  token_count: number | null
  model_used: string | null
  raw_response: unknown | null
  created_at: string
}

/**
 * RAG context - audit trail of context used for a response
 */
export interface ChatRAGContext {
  id: string
  message_id: string
  chunk_id: number | null
  page_id: string | null
  document_id: string | null
  source_type: 'page' | 'chunk' | 'compression_note' | null
  similarity_score: number | null
  content_preview: string | null
  created_at: string
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request to send a message (enhanced with thread support)
 */
export interface SendMessageRequest {
  thread_id?: string
  course_id?: string
  topic_id?: string
  question_id?: string
  message: string
  compression_notes?: string
}

/**
 * Response from sending a message
 */
export interface SendMessageResponse {
  answer: string
  thread_id: string
  message_id: string
  user_message_id: string
  citations: ChatCitation[]
  pages: ChatPage[]
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

/**
 * Citation from RAG retrieval
 */
export interface ChatCitation {
  documentTitle: string
  pageNumber: number
  similarity: number
  docType: string
  publicUrl?: string
}

/**
 * Page content from RAG retrieval
 */
export interface ChatPage {
  doc_title: string
  page_number: number
  content: string
  similarity: number
}

/**
 * Request to create/get a thread
 */
export interface GetOrCreateThreadRequest {
  course_id?: string
  topic_id?: string
  model?: string
}

/**
 * Request to get thread messages
 */
export interface GetThreadMessagesRequest {
  thread_id: string
  limit?: number
  offset?: number
}

// ============================================
// UI STATE TYPES
// ============================================

/**
 * Message displayed in the UI (extends database message)
 */
export interface UIMessage extends Omit<ChatMessage, 'raw_response'> {
  citations?: ChatCitation[]
  pages?: ChatPage[]
  isLoading?: boolean
  error?: string
}

/**
 * Thread with related data for UI display
 */
export interface UIThread extends ChatThread {
  course?: {
    id: string
    code: string
    name: string
  }
  topic?: {
    id: string
    name: string
  }
  messageCount?: number
  lastMessage?: UIMessage
}

/**
 * Chat state for a single thread
 */
export interface ChatState {
  thread: ChatThread | null
  messages: UIMessage[]
  isLoading: boolean
  isSending: boolean
  error: string | null
}

// ============================================
// HOOK RETURN TYPES
// ============================================

/**
 * Return type for useThread hook
 */
export interface UseThreadReturn {
  thread: ChatThread | null
  isLoading: boolean
  error: Error | null
  createThread: (courseId?: string, topicId?: string) => Promise<ChatThread>
}

/**
 * Return type for useThreadMessages hook
 */
export interface UseThreadMessagesReturn {
  messages: UIMessage[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Return type for useSendMessage hook
 */
export interface UseSendMessageReturn {
  sendMessage: (message: string, threadId?: string) => Promise<SendMessageResponse>
  isSending: boolean
  error: Error | null
}

/**
 * Return type for useChat combined hook
 */
export interface UseChatReturn {
  thread: ChatThread | null
  messages: UIMessage[]
  isLoading: boolean
  isSending: boolean
  error: Error | null
  sendMessage: (message: string) => Promise<void>
  clearChat: () => void
}

// ============================================
// LEGACY COMPATIBILITY TYPES
// ============================================

/**
 * Legacy RAG chat request (for backward compatibility)
 * @deprecated Use SendMessageRequest instead
 */
export interface LegacyRAGChatRequest {
  user_id: string
  topic_id?: string
  course_id?: string
  question_id?: string
  message: string
  compression_notes?: string
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

/**
 * Legacy RAG chat response (for backward compatibility)
 * @deprecated Use SendMessageResponse instead
 */
export interface LegacyRAGChatResponse {
  answer: string
  citations: ChatCitation[]
  pages: Array<{
    id: string
    title: string
    page: number
  }>
}

// ============================================
// REALTIME TYPES
// ============================================

/**
 * Realtime message payload for chat_messages subscription
 */
export interface ChatMessageRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: ChatMessage | null
  old: Partial<ChatMessage> | null
}

// ============================================
// MODEL TYPES
// ============================================

/**
 * Supported LLM models
 */
export type SupportedModel =
  | 'gpt-4-turbo-preview'
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.0-pro'

/**
 * Model metadata for UI display
 */
export interface ModelInfo {
  id: SupportedModel
  name: string
  provider: 'openai' | 'gemini'
  description: string
  maxTokens: number
  costPer1kTokens: number
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Most capable OpenAI model',
    maxTokens: 128000,
    costPer1kTokens: 0.01,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective',
    maxTokens: 128000,
    costPer1kTokens: 0.00015,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Fast Google model',
    maxTokens: 1000000,
    costPer1kTokens: 0.000075,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Advanced Google model',
    maxTokens: 2000000,
    costPer1kTokens: 0.00125,
  },
]
