/**
 * React Query Hooks - RAG Chat (LLM Tutor)
 *
 * IMPLEMENTATION STATUS:
 * ✅ useRAGChat - Send message to RAG tutor (mutation)
 * Note: Uses mutation instead of query because chat is stateful
 */

import { useMutation } from '@tanstack/react-query'
import { ragChat } from '@/lib/api'
import type { RAGChatRequest } from '@/types'

/**
 * ✅ IMPLEMENTED: Send message to RAG chat
 * Returns: { answer: string, citations: string[], pages: PageInfo[] }
 *
 * Usage:
 * ```ts
 * const chatMutation = useRAGChat()
 * chatMutation.mutate({
 *   topic_id: 'uuid',
 *   message: 'Explain page faults'
 * })
 * ```
 */
export function useRAGChat() {
  return useMutation({
    mutationFn: (request: RAGChatRequest) => ragChat(request),
    // No query invalidation needed (chat is ephemeral)
  })
}
