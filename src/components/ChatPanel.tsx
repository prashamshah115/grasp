/**
 * ChatPanel Component
 * RAG-powered chat with LLM tutor
 * TODO: Full implementation in Phase 4
 */

import { useParams } from 'react-router-dom'

export default function ChatPanel() {
  const { topicId } = useParams<{ topicId?: string }>()

  return (
    <div className="min-h-screen max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Chat with GRASP Tutor</h1>
        <p className="text-text-secondary">
          Ask questions and get answers with citations from your course materials
        </p>
        {topicId && (
          <p className="text-sm text-text-tertiary mt-1">
            Topic context: {topicId}
          </p>
        )}
      </div>

      <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
        <p className="text-text-tertiary">
          ChatPanel component (Phase 4)
        </p>
        <p className="text-sm text-text-tertiary mt-2">
          Will implement dual-stage RAG + streaming responses
        </p>
      </div>
    </div>
  )
}
