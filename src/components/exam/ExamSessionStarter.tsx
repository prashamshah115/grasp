/**
 * ExamSessionStarter Component
 *
 * Route: /exam/:examId/start
 *
 * PURPOSE:
 * Intermediate component that creates an exam session via start-exam-session edge function
 * and redirects to the exam simulation with session data.
 *
 * FLOW:
 * 1. User clicks "Start Exam" button → navigates to /exam/:examId/start
 * 2. This component automatically calls createExamSession
 * 3. On success → redirects to /exam-session/:sessionId with session data
 * 4. On error (409 if already active) → shows error with option to resume or go back
 *
 * BACKEND INTEGRATION:
 * - createExamSession() - calls start-exam-session edge function
 * - Handles 409 Conflict error (active session already exists)
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { useCreateExamSession } from '@/hooks/useSessions'
import type { CreateExamSessionResponse } from '@/types/api'

export function ExamSessionStarter() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const createSessionMutation = useCreateExamSession()
  const [error, setError] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<CreateExamSessionResponse | null>(null)

  useEffect(() => {
    if (!examId) {
      navigate('/courses')
      return
    }

    // Automatically start session creation on mount
    startSession()
  }, [examId])

  const startSession = async () => {
    setError(null)

    try {
      const result = await createSessionMutation.mutateAsync({
        exam_id: examId!,
      })

      setSessionData(result)

      // Redirect to exam session with data in state
      navigate(`/exam-session/${result.session_id}`, {
        replace: true,
        state: {
          sessionData: result,
        },
      })
    } catch (err: any) {
      console.error('Failed to create exam session:', err)
      console.error('Error details:', {
        message: err.message,
        context: err.context,
        code: err.code,
        status: err.status,
      })

      // Check if it's a 409 Conflict (active session exists)
      const status = err.context?.status || err.status
      
      // Handle specific error cases
      if (status === 409 || err.message?.includes('409') || err.message?.toLowerCase().includes('conflict')) {
        setError(
          'You already have an active exam session for this exam. Please wait a moment and try again, or contact support if the issue persists.'
        )
      } else if (status === 403 || err.message?.includes('403') || err.message?.toLowerCase().includes('forbidden')) {
        setError(
          'You are not enrolled in this course or do not have permission to take this exam.'
        )
      } else if (status === 404 || err.message?.includes('404') || err.message?.toLowerCase().includes('not found')) {
        setError('This exam could not be found. It may have been deleted.')
      } else {
        // Show the actual error message from the edge function
        const errorMsg = err.message || err.msg || 'Failed to start exam session. Please try again.'
        setError(`Error: ${errorMsg}`)
      }
    }
  }

  // Loading state
  if (createSessionMutation.isLoading && !error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#4F46E5]" />
          <h2 className="text-2xl font-semibold text-[#111827]">Starting Exam Session...</h2>
          <p className="text-[#6B7280]">
            Please wait while we prepare your exam. This will only take a moment.
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-[#111827] mb-4">Cannot Start Exam</h2>
          <p className="text-[#6B7280] mb-8">{error}</p>

          <div className="flex flex-col gap-3">
            {error.includes('active exam session') && (
              <button
                onClick={() => navigate(`/exam/${examId}`)}
                className="w-full px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-all"
              >
                View Exam Details
              </button>
            )}

            <button
              onClick={() => startSession()}
              className="w-full px-6 py-3 border border-[#E5E7EB] text-[#111827] rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-all"
            >
              Try Again
            </button>

            <button
              onClick={() => navigate(`/exam/${examId}`)}
              className="w-full px-6 py-3 text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Success state (should redirect immediately, but show this briefly)
  if (sessionData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#4F46E5]" />
          <p className="text-[#6B7280]">Redirecting to exam...</p>
        </div>
      </div>
    )
  }

  // Default loading state - show a start button if session creation hasn't started
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#4F46E5] mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-[#111827] mb-2">Preparing Exam...</h2>
        <p className="text-[#6B7280] mb-6">
          Please wait while we set up your exam session.
        </p>
        <button
          onClick={() => startSession()}
          className="px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-all"
        >
          Start Exam Now
        </button>
      </div>
    </div>
  )
}
