/**
 * Chat and RAG Message Types
 * Following 2025 best practices for LLM streaming responses
 */

export interface Citation {
  pageId: string
  docTitle: string
  docType: 'slides' | 'textbook'
  pageNumber: number
  chunkText: string
  relevanceScore?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
  timestamp: string
  isStreaming?: boolean
  error?: string
}

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

export interface ChatConversation {
  id: string
  topicId: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}
