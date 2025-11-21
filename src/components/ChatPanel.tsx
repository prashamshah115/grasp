/**
 * ChatPanel Component - FULLY INTEGRATED
 *
 * Route: /chat/:topicId?
 *
 * FEATURES:
 * ✅ Full RAG chat integration with LLM tutor
 * ✅ Dual-stage retrieval (page → chunk)
 * ✅ Citations from course materials
 * ✅ Topic context support (optional)
 * ✅ Message history with user/assistant messages
 * ✅ Loading states during generation
 * ✅ Error handling
 * ✅ Source page display with links
 *
 * BACKEND INTEGRATION:
 * - ragChat() - Calls rag-chat edge function
 * - Returns: { answer, citations, pages }
 * - Uses BGE embeddings (768d) for retrieval
 */

import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Send, BookOpen, Loader2, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useRAGChat } from '@/hooks/useRAGChat'
import { fetchTopic, fetchCourse } from '@/lib/api'
import type { RAGChatResponse } from '@/types/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
  pages?: Array<{
    id: string
    title: string
    page: number
  }>
  timestamp: Date
}

export default function ChatPanel() {
  const { topicId } = useParams<{ topicId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ==================== QUERIES ====================

  // Fetch topic details if topicId provided
  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => fetchTopic(topicId!),
    enabled: !!topicId,
  })

  // Fetch course for topic
  const { data: course } = useQuery({
    queryKey: ['course', topic?.course_id],
    queryFn: () => fetchCourse(topic!.course_id),
    enabled: !!topic?.course_id,
  })

  // ==================== MUTATIONS ====================

  const chatMutation = useRAGChat()

  // ==================== EFFECTS ====================

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ==================== HANDLERS ====================

  const handleSend = async () => {
    if (!input.trim() || !user) return

    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Call RAG chat
    try {
      const response = await chatMutation.mutateAsync({
        user_id: user.id,
        topic_id: topicId || '', // Empty string if no topic context
        message: userMessage.content,
      })

      // Create assistant message with citations
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        pages: response.pages,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ==================== LOADING STATE ====================

  if (topicLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
          <p className="text-[#6B7280]">Loading chat...</p>
        </div>
      </div>
    )
  }

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-8 py-6">
          <button
            onClick={() => navigate(topic ? `/course/${topic.course_id}/compression` : '/courses')}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#EEF2FF]">
              <BookOpen className="w-6 h-6 text-[#4F46E5]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#111827]">GRASP Tutor</h1>
              <p className="text-[#6B7280]">
                {topic
                  ? `${course?.name || 'Course'} • ${topic.name}`
                  : 'Ask questions about your course materials'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {messages.length === 0 ? (
            // Welcome message
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EEF2FF] mb-4">
                <BookOpen className="w-8 h-8 text-[#4F46E5]" />
              </div>
              <h2 className="text-xl font-semibold text-[#111827] mb-2">
                Ask me anything about your course
              </h2>
              <p className="text-[#6B7280] max-w-md mx-auto">
                I'll search through your course materials and provide answers with citations from
                the source documents.
              </p>

              {/* Example questions */}
              <div className="mt-8 space-y-2 max-w-md mx-auto">
                <p className="text-sm text-[#6B7280] mb-3">Try asking:</p>
                {[
                  'Explain page faults and how they are handled',
                  'What are the differences between processes and threads?',
                  'How does virtual memory work?',
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(example)}
                    className="w-full text-left px-4 py-3 bg-white border border-[#E5E7EB] rounded-[10px] text-sm text-[#6B7280] hover:border-[#4F46E5] hover:text-[#4F46E5] transition-all"
                  >
                    "{example}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Message list
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-[#4F46E5]" />
                    </div>
                  )}

                  <div
                    className={`max-w-3xl ${
                      message.role === 'user'
                        ? 'bg-[#4F46E5] text-white rounded-[16px] px-6 py-4'
                        : 'bg-white border border-[#E5E7EB] rounded-[16px] p-6'
                    }`}
                  >
                    {/* Message content */}
                    <div
                      className={`whitespace-pre-wrap ${
                        message.role === 'user' ? 'text-white' : 'text-[#111827]'
                      }`}
                    >
                      {message.content}
                    </div>

                    {/* Citations (for assistant messages) */}
                    {message.role === 'assistant' && message.pages && message.pages.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                        <div className="text-xs text-[#6B7280] mb-2 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          Sources
                        </div>
                        <div className="space-y-1">
                          {message.pages.map((page, idx) => (
                            <div
                              key={page.id}
                              className="text-sm text-[#4F46E5] hover:underline cursor-pointer"
                            >
                              {page.title} - Page {page.page}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Citations text (if available) */}
                    {message.role === 'assistant' &&
                      message.citations &&
                      message.citations.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                          <div className="text-xs text-[#6B7280] mb-2">Referenced Content:</div>
                          <div className="space-y-2">
                            {message.citations.map((citation, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-[#6B7280] bg-[#F9FAFB] rounded-[8px] p-3 border-l-2 border-[#4F46E5]"
                              >
                                {citation}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Timestamp */}
                    <div
                      className={`text-xs mt-2 ${
                        message.role === 'user' ? 'text-white/70' : 'text-[#9CA3AF]'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D1D5DB] flex items-center justify-center text-sm font-medium text-white">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {chatMutation.isPending && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-[#4F46E5]" />
                  </div>
                  <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-6">
                    <div className="flex items-center gap-2 text-[#6B7280]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching course materials...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-[#E5E7EB] bg-white">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="flex-1 resize-none rounded-[12px] border border-[#E5E7EB] px-4 py-3 text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#4F46E5] transition-colors"
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '200px',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="flex-shrink-0 w-12 h-12 rounded-[12px] bg-[#4F46E5] text-white hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          <p className="text-xs text-[#9CA3AF] mt-3">
            Press Enter to send, Shift+Enter for new line. Answers are generated from your course
            materials.
          </p>
        </div>
      </div>
    </div>
  )
}
