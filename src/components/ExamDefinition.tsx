/**
 * ExamDefinition Component - FULLY FUNCTIONAL
 * Shows exam instructions and metadata before starting (like Khan Academy)
 *
 * ROUTE: /exam/:examId
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Clock, FileCheck, AlertCircle, CheckCircle, Play, ArrowLeft, Loader2 } from 'lucide-react'
import { fetchExam, getActiveExamSessions } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { useCreateExamSession } from '../hooks/useSessions'
import { useAuth } from './auth/AuthProvider'
import { useCourse } from '../hooks'
import LoadingScreen from './LoadingScreen'

export default function ExamDefinition() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const createSessionMutation = useCreateExamSession()
  const [isStarting, setIsStarting] = useState(false)

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: queryKeys.exams.detail(examId!),
    queryFn: () => fetchExam(examId!),
    enabled: !!examId,
  })

  // Fetch course info
  const { data: course } = useCourse(exam?.course_id || '')

  // Check for active sessions
  const { data: activeSessions } = useQuery({
    queryKey: ['activeExamSessions', exam?.course_id, user?.id],
    queryFn: () => getActiveExamSessions(exam!.course_id),
    enabled: !!exam && !!user,
  })

  const activeSession = activeSessions?.find((s: any) => s.exam_id === examId)

  const handleStartExam = async () => {
    if (!exam || !user || isStarting) return

    setIsStarting(true)

    try {
      // Check for active session first
      if (activeSession) {
        navigate(`/exam-session/${activeSession.id}`)
        return
      }

      // Create new session
      const result = await createSessionMutation.mutateAsync({
        exam_id: examId!,
      })
      
      navigate(`/exam-session/${result.session_id}`, {
        state: {
          sessionData: result,
        },
      })
    } catch (err: any) {
      console.error('Failed to start exam:', err)
      setIsStarting(false)
      alert(err?.message || 'Failed to start exam. Please try again.')
    }
  }

  if (examLoading) {
    return <LoadingScreen message="Loading exam..." />
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-[#111827] mb-2">Exam Not Found</h1>
          <p className="text-[#6B7280] mb-6">
            The exam you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-[12px] transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <button
            onClick={() => navigate(`/course/${exam.course_id}/exam`)}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Exams</span>
          </button>
          <div className="text-sm text-[#6B7280] mb-2">{course?.code || 'Course'}</div>
          <h1 className="text-4xl font-semibold tracking-tight text-[#111827]">{exam.name}</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Exam Info Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-10 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Exam Instructions</h2>
          
          <div className="space-y-6 mb-8">
            {/* Duration */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#4F46E5]" />
              </div>
              <div>
                <div className="text-sm text-[#6B7280] mb-1">Time Limit</div>
                <div className="text-lg font-medium text-[#111827]">
                  {exam.duration_min} minutes
                </div>
              </div>
            </div>

            {/* Questions */}
            {exam.num_questions && (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-[#F0FDF4] flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-[#10B981]" />
                </div>
                <div>
                  <div className="text-sm text-[#6B7280] mb-1">Total Questions</div>
                  <div className="text-lg font-medium text-[#111827]">
                    {exam.num_questions} questions
                  </div>
                </div>
              </div>
            )}

            {/* Active Session Warning */}
            {activeSession && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-[12px] p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-yellow-900 mb-1">Active Session Found</div>
                  <div className="text-sm text-yellow-700">
                    You have an exam in progress. You can resume where you left off.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="border-t border-[#E5E7EB] pt-6">
            <h3 className="font-semibold text-[#111827] mb-3">Before You Begin</h3>
            <ul className="space-y-2 text-[#6B7280]">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>Make sure you have a stable internet connection</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>You can flag questions and return to them later</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>Your answers are saved automatically as you work</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>You can review all answers before submitting</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>The timer starts when you begin the exam</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-center">
          <button
            onClick={handleStartExam}
            disabled={isStarting || createSessionMutation.isPending}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-12 py-4 rounded-[12px] font-medium text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
          >
            {isStarting || createSessionMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting Exam...
              </>
            ) : activeSession ? (
              <>
                <Play className="w-5 h-5" />
                Resume Exam
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Exam
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
