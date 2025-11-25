/**
 * ExamDefinition Component
 * Shows exam instructions and metadata before starting
 *
 * ROUTE: /exam/:examId
 *
 * INTEGRATION STATUS: Placeholder (will integrate with ExamView)
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchExam, getActiveExamSessions } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useCreateExamSession } from '../hooks/useSessions'
import { useAuth } from './auth/AuthProvider'
import LoadingScreen from './LoadingScreen'

export default function ExamDefinition() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const createSessionMutation = useCreateExamSession()

  const { data: exam, isLoading } = useQuery({
    queryKey: queryKeys.exams.detail(examId!),
    queryFn: () => fetchExam(examId!),
    enabled: !!examId,
  })

  // Check for active sessions
  const { data: activeSessions } = useQuery({
    queryKey: ['activeExamSessions', exam?.course_id, user?.id],
    queryFn: () => getActiveExamSessions(exam!.course_id),
    enabled: !!exam && !!user,
  })

  // Auto-start exam session on mount - never show this screen
  useEffect(() => {
    if (!exam || !user) return

    const startExam = async () => {
      // Check for active session first
      const activeSession = activeSessions?.find((s: any) => s.exam_id === examId)
      if (activeSession) {
        navigate(`/exam-session/${activeSession.id}`, { replace: true })
        return
      }

      // Create new session
      try {
        const result = await createSessionMutation.mutateAsync({
          exam_id: examId!,
        })
        navigate(`/exam-session/${result.session_id}`, {
          replace: true,
          state: {
            sessionData: result,
          },
        })
      } catch (err: any) {
        console.error('Failed to start exam:', err)
        // If error, redirect back to exam view
        navigate(`/course/${exam.course_id}/exam`, { replace: true })
      }
    }

    startExam()
  }, [exam, user, activeSessions, examId, navigate, createSessionMutation])

  if (isLoading) return <LoadingScreen message="Starting exam..." />

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Exam Not Found</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Show loading while starting exam (should auto-redirect before this shows)
  return <LoadingScreen message="Starting exam session..." />
}
