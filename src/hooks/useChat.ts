/**
 * Chat Hooks
 * 
 * React Query hooks for the persistent chat assistant system.
 * Handles thread management, message history, and realtime subscriptions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useAuth } from '@/components/auth/AuthProvider'
import type {
  ChatThread,
  ChatMessage,
  UIMessage,
  SendMessageRequest,
  SendMessageResponse,
  ChatCitation,
} from '@/types/chat'

// ============================================
// QUERY KEYS
// ============================================

export const chatKeys = {
  all: ['chat'] as const,
  threads: () => [...chatKeys.all, 'threads'] as const,
  thread: (id: string) => [...chatKeys.threads(), id] as const,
  threadByTopic: (topicId: string) => [...chatKeys.threads(), 'topic', topicId] as const,
  messages: (threadId: string) => [...chatKeys.all, 'messages', threadId] as const,
}

// ============================================
// useThread - Get or create thread for a topic
// ============================================

export function useThread(topicId?: string | null, courseId?: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: topicId ? chatKeys.threadByTopic(topicId) : ['chat', 'no-topic'],
    queryFn: async (): Promise<ChatThread | null> => {
      if (!user || !topicId) return null

      // Try to find existing thread
      const { data: existingThread, error: findError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingThread && !findError) {
        return existingThread as ChatThread
      }

      // Create new thread
      const { data: newThread, error: createError } = await supabase
        .from('chat_threads')
        .insert({
          user_id: user.id,
          course_id: courseId || null,
          topic_id: topicId,
          model: 'gpt-4-turbo-preview',
        })
        .select()
        .single()

      if (createError) {
        console.error('[useThread] Failed to create thread:', createError)
        throw new Error(`Failed to create thread: ${createError.message}`)
      }

      return newThread as ChatThread
    },
    enabled: !!user && !!topicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

// ============================================
// useThreadMessages - Get messages for a thread
// ============================================

export function useThreadMessages(threadId?: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: threadId ? chatKeys.messages(threadId) : ['chat', 'no-messages'],
    queryFn: async (): Promise<UIMessage[]> => {
      if (!user || !threadId) return []

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[useThreadMessages] Failed to fetch messages:', error)
        throw new Error(`Failed to fetch messages: ${error.message}`)
      }

      return (data || []).map(msg => ({
        ...msg,
        citations: undefined,
        pages: undefined,
      } as UIMessage))
    },
    enabled: !!user && !!threadId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ============================================
// useSendMessage - Send a message mutation
// ============================================

export function useSendMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: SendMessageRequest): Promise<SendMessageResponse> => {
      if (!user) {
        throw new Error('User not authenticated')
      }

      const response = await safeInvoke<SendMessageResponse>('rag-chat', {
        body: {
          thread_id: request.thread_id,
          course_id: request.course_id,
          topic_id: request.topic_id,
          questionId: request.question_id,
          message: request.message,
          compressionNotes: request.compression_notes,
        },
      })

      return response
    },
    onSuccess: (data) => {
      // Invalidate messages for this thread
      if (data.thread_id) {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(data.thread_id) })
      }
    },
  })
}

// ============================================
// useChat - Combined hook for chat functionality
// ============================================

export interface UseChatOptions {
  topicId?: string | null
  courseId?: string | null
  questionId?: string | null
  compressionNotes?: string | null
  onNewMessage?: (message: UIMessage) => void
}

export function useChat(options: UseChatOptions = {}) {
  const { topicId, courseId, questionId, compressionNotes, onNewMessage } = options
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // Local state for optimistic updates
  const [localMessages, setLocalMessages] = useState<UIMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Ref to track if we've loaded initial messages
  const initialLoadDone = useRef(false)

  // Get or create thread
  const {
    data: thread,
    isLoading: threadLoading,
    error: threadError,
  } = useThread(topicId, courseId)

  // Get existing messages
  const {
    data: dbMessages,
    isLoading: messagesLoading,
    error: messagesError,
  } = useThreadMessages(thread?.id)

  // Sync database messages to local state
  useEffect(() => {
    if (dbMessages && !initialLoadDone.current) {
      setLocalMessages(dbMessages)
      initialLoadDone.current = true
    }
  }, [dbMessages])

  // Reset when topic changes
  useEffect(() => {
    setLocalMessages([])
    initialLoadDone.current = false
  }, [topicId])

  // Send message mutation
  const sendMessageMutation = useSendMessage()

  // Subscribe to realtime updates
  useEffect(() => {
    if (!thread?.id || !user) return

    const channel = supabase
      .channel(`chat-messages-${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          
          // Only add if it's not already in local state (avoid duplicates from optimistic updates)
          setLocalMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id)
            if (exists) return prev
            
            const uiMessage: UIMessage = {
              ...newMessage,
              citations: undefined,
              pages: undefined,
            }
            
            onNewMessage?.(uiMessage)
            return [...prev, uiMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [thread?.id, user, onNewMessage])

  // Send message function
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user) return

    setIsSending(true)
    setError(null)

    // Create optimistic user message
    const optimisticUserMessage: UIMessage = {
      id: `temp-${Date.now()}`,
      thread_id: thread?.id || '',
      user_id: user.id,
      role: 'user',
      content: content.trim(),
      token_count: null,
      model_used: null,
      raw_response: null,
      created_at: new Date().toISOString(),
    }

    // Add optimistic message
    setLocalMessages(prev => [...prev, optimisticUserMessage])

    try {
      const response = await sendMessageMutation.mutateAsync({
        thread_id: thread?.id,
        course_id: courseId || undefined,
        topic_id: topicId || undefined,
        question_id: questionId || undefined,
        message: content.trim(),
        compression_notes: compressionNotes || undefined,
      })

      // Keep the user message and add assistant message
      setLocalMessages(prev => {
        // Create assistant message from response
        // Support both old API (no thread_id/message_id) and new API
        const assistantMessage: UIMessage = {
          id: response.message_id || `assistant-${Date.now()}`,
          thread_id: response.thread_id || thread?.id || '',
          user_id: null,
          role: 'assistant',
          content: response.answer,
          token_count: response.usage?.total_tokens || null,
          model_used: null,
          raw_response: null,
          created_at: new Date().toISOString(),
          citations: response.citations,
          pages: response.pages,
        }

        // Keep all existing messages (including user message) and add assistant
        return [...prev, assistantMessage]
      })

      // Update thread in cache if it was just created
      if (response.thread_id && !thread?.id) {
        queryClient.invalidateQueries({ queryKey: chatKeys.threadByTopic(topicId!) })
      }
    } catch (err) {
      console.error('[useChat] Send message error:', err)
      
      // Remove optimistic message on error
      setLocalMessages(prev => prev.filter(m => m.id !== optimisticUserMessage.id))
      
      // Set error state
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      
      // Add error message to chat
      const errorUIMessage: UIMessage = {
        id: `error-${Date.now()}`,
        thread_id: thread?.id || '',
        user_id: null,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        token_count: null,
        model_used: null,
        raw_response: null,
        created_at: new Date().toISOString(),
        error: errorMessage,
      }
      setLocalMessages(prev => [...prev, errorUIMessage])
    } finally {
      setIsSending(false)
    }
  }, [thread?.id, user, courseId, topicId, compressionNotes, sendMessageMutation, queryClient])

  // Clear chat function
  const clearChat = useCallback(() => {
    setLocalMessages([])
    setError(null)
    initialLoadDone.current = false
  }, [])

  return {
    thread,
    messages: localMessages,
    isLoading: threadLoading || messagesLoading,
    isSending,
    error: error || threadError?.message || messagesError?.message || null,
    sendMessage,
    clearChat,
  }
}

// ============================================
// useAllThreads - Get all threads for user
// ============================================

export function useAllThreads() {
  const { user } = useAuth()

  return useQuery({
    queryKey: chatKeys.threads(),
    queryFn: async (): Promise<ChatThread[]> => {
      if (!user) return []

      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('last_user_message_at', { ascending: false })

      if (error) {
        console.error('[useAllThreads] Failed to fetch threads:', error)
        throw new Error(`Failed to fetch threads: ${error.message}`)
      }

      return data as ChatThread[]
    },
    enabled: !!user,
  })
}

// ============================================
// useArchiveThread - Archive a thread
// ============================================

export function useArchiveThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('chat_threads')
        .update({ status: 'archived' })
        .eq('id', threadId)

      if (error) {
        throw new Error(`Failed to archive thread: ${error.message}`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.threads() })
    },
  })
}

// ============================================
// Legacy compatibility - useRAGChat wrapper
// ============================================

/**
 * Legacy hook for backward compatibility
 * @deprecated Use useChat instead
 */
export function useRAGChat() {
  const sendMessageMutation = useSendMessage()

  return {
    mutate: (request: {
      user_id: string
      topic_id?: string
      course_id?: string
      question_id?: string
      message: string
      compression_notes?: string
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
    }) => {
      sendMessageMutation.mutate({
        topic_id: request.topic_id,
        course_id: request.course_id,
        message: request.message,
        compression_notes: request.compression_notes,
      })
    },
    mutateAsync: async (request: {
      user_id: string
      topic_id?: string
      course_id?: string
      question_id?: string
      message: string
      compression_notes?: string
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
    }) => {
      const response = await sendMessageMutation.mutateAsync({
        topic_id: request.topic_id,
        course_id: request.course_id,
        message: request.message,
        compression_notes: request.compression_notes,
      })
      
      // Convert to legacy response format
      return {
        answer: response.answer,
        citations: response.citations,
        pages: response.pages.map(p => ({
          id: p.doc_title,
          title: p.doc_title,
          page: p.page_number,
        })),
      }
    },
    isPending: sendMessageMutation.isPending,
    isError: sendMessageMutation.isError,
    error: sendMessageMutation.error,
  }
}

