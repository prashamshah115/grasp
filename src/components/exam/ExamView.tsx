/**
 * ExamView Component - PHASE 4 INTEGRATED
 * Exam pillar - shows list of available exams for a course
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Uses useParams() to get courseId from URL
 * - Uses useCourse() hook for course data (React Query)
 * - Uses useExams() hook to fetch exams list (React Query)
 * - Fetches user's past exam attempts with scores (React Query)
 * - Navigates to /exam/:examId when user clicks an exam
 * - Shows past exam attempts with scores and click-to-view-results
 * - NO mock data, NO props
 */

import { Trophy, Clock, FileCheck, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCourse } from '@/hooks'
import { useAuth } from '@/components/auth/AuthProvider'
import LoadingScreen from '../LoadingScreen'
import { AIAssistant } from '../shared/AIAssistant'
import { useQuery } from '@tanstack/react-query'
import { fetchExams, fetchUserExamSessions, getActiveExamSessions } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import { useCreateExamSession } from '@/hooks/useSessions'
import { useState, useEffect } from 'react'
import type { CreateExamSessionResponse } from '@/types/api'

export function ExamView() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const createSessionMutation = useCreateExamSession()
  const [startingExamId, setStartingExamId] = useState<string | null>(null)

  // Fetch course data
  const { data: course, isLoading: courseLoading } = useCourse(courseId!)

  // Fetch exams for this course
  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: queryKeys.exams.byCourse(courseId!),
    queryFn: () => fetchExams(courseId!),
    enabled: !!courseId,
  })

  // Fetch user's past exam sessions
  const { data: allSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['userExamSessions', user?.id],
    queryFn: () => fetchUserExamSessions(user!.id),
    enabled: !!user,
  })

  // Fetch active exam sessions for resumption
  const { data: activeSessions, isLoading: activeSessionsLoading, error: activeSessionsError } = useQuery({
    queryKey: ['activeExamSessions', courseId, user?.id],
    queryFn: () => getActiveExamSessions(courseId!),
    enabled: !!courseId && !!user,
    retry: 2,
    staleTime: 0, // Always fetch fresh data
  })

  // Log errors for debugging
  useEffect(() => {
    if (activeSessionsError) {
      console.error('[ExamView] Error fetching active sessions:', activeSessionsError)
    }
  }, [activeSessionsError])

  // Filter sessions for exams in this course
  const pastSessions = allSessions?.filter((session: any) =>
    exams?.some(exam => exam.id === session.exam_id)
  ) || []

  // Create map of exam_id -> active session for quick lookup
  const activeSessionMap = new Map(
    activeSessions?.map((session: any) => [session.exam_id, session]) || []
  )

  // Debug logging
  useEffect(() => {
    console.log('[ExamView] Active sessions:', activeSessions)
    console.log('[ExamView] Active session map:', Array.from(activeSessionMap.entries()))
    console.log('[ExamView] Exams:', exams?.map(e => ({ id: e.id, name: e.name })))
    if (activeSessions && activeSessions.length > 0) {
      console.log('[ExamView] Found', activeSessions.length, 'active sessions')
      activeSessions.forEach((session: any) => {
        console.log('[ExamView] Session:', session.id, 'for exam:', session.exam_id, 'exam data:', session.exams)
      })
    } else {
      console.log('[ExamView] No active sessions found')
    }
  }, [activeSessions, activeSessionMap, exams])

  const isLoading = courseLoading || examsLoading || sessionsLoading || activeSessionsLoading

  if (isLoading) {
    return <LoadingScreen message="Loading exams..." />
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Course not found</p>
      </div>
    )
  }

  const handleStartExam = async (examId: string) => {
    setStartingExamId(examId)
    try {
      const result = await createSessionMutation.mutateAsync({
        exam_id: examId,
      })
      
      // Navigate directly to exam session with data in state
      navigate(`/exam-session/${result.session_id}`, {
        state: {
          sessionData: result,
        },
      })
    } catch (err: any) {
      console.error('Failed to start exam:', err)
      // NEVER navigate to ExamDefinition page - always try to resume or stay on exam view
      const status = err.context?.status || err.status
      
      if (status === 409) {
        // 409 means active session exists - find it and resume
        const activeSession = activeSessions?.find((s: any) => s.exam_id === examId)
        if (activeSession) {
          navigate(`/exam-session/${activeSession.id}`)
          return
        }
        
        // If not found in cache, refetch active sessions
        try {
          const refreshedSessions = await getActiveExamSessions(courseId!)
          const refreshedActiveSession = refreshedSessions?.find((s: any) => s.exam_id === examId)
          if (refreshedActiveSession) {
            navigate(`/exam-session/${refreshedActiveSession.id}`)
            return
          }
        } catch (refetchError) {
          console.error('Failed to refetch active sessions:', refetchError)
        }
      }
      
      // If we can't resume, stay on exam view page (don't navigate anywhere)
      // User can try again or use Resume button if it appears
      console.error('Could not start or resume exam session')
    } finally {
      setStartingExamId(null)
    }
  }

  const handleResumeExam = (sessionId: string) => {
    // Navigate directly to exam session
    navigate(`/exam-session/${sessionId}`)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="text-sm text-[#9CA3AF] mb-2">{course.code}</div>
          <h1 className="text-5xl mb-4 tracking-tight">Exam Simulation</h1>
          <p className="text-[#6B7280] text-lg">
            Full-length practice exams under timed conditions
          </p>
        </div>

        {/* Exams List */}
        {exams && exams.length > 0 ? (
          <div className="space-y-6 mb-12">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-[16px] p-10"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="flex-1">
                    <h2 className="text-3xl text-white mb-3">{exam.name}</h2>
                    <p className="text-[#FDE68A] text-lg mb-6">
                      Simulates real exam conditions with timer and question navigation
                    </p>

                    {/* Exam Stats */}
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">{exam.duration_min} minutes</span>
                      </div>
                      {exam.num_questions && (
                        <div className="flex items-center gap-2 text-white">
                          <FileCheck className="w-5 h-5" />
                          <span className="font-medium">{exam.num_questions} questions</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const activeSession = activeSessionMap.get(exam.id)
                    console.log('[ExamView] Render - Exam:', exam.id, 'Active session:', activeSession)
                    
                    if (activeSession && activeSession.id) {
                      return (
                        <button
                          onClick={() => {
                            console.log('[ExamView] Resume button clicked for session:', activeSession.id)
                            handleResumeExam(activeSession.id)
                          }}
                          className="bg-[#10B981] text-white px-8 py-4 rounded-[12px] font-medium hover:bg-[#059669] transition-all shadow-lg flex items-center gap-2"
                        >
                          <Clock className="w-4 h-4" />
                          Resume Exam
                        </button>
                      )
                    }
                    return (
                      <button
                        onClick={() => handleStartExam(exam.id)}
                        disabled={startingExamId === exam.id || createSessionMutation.isLoading}
                        className="bg-white text-[#F59E0B] px-8 py-4 rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {startingExamId === exam.id && createSessionMutation.isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          'Start Exam'
                        )}
                      </button>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // No exams available
          <div className="bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-[14px] p-12 text-center mb-12">
            <Trophy className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No Exams Available Yet</h3>
            <p className="text-[#6B7280]">
              Exams for this course will be available soon.
            </p>
          </div>
        )}

        {/* Important Notice */}
        <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-[14px] p-6 mb-12 flex gap-4">
          <AlertCircle className="w-6 h-6 text-[#4F46E5] flex-shrink-0" />
          <div>
            <div className="font-medium text-[#4F46E5] mb-1">Exam Support</div>
            <ul className="text-sm text-[#6B7280] space-y-1">
              <li>• Timer starts immediately when you begin</li>
              <li>• AI assistant available anytime - click the floating button for help</li>
              <li>• You can flag questions and return to them later</li>
              <li>• Review all answers before final submission</li>
            </ul>
          </div>
        </div>

        {/* Past Attempts */}
        <div>
          <h3 className="text-xl mb-4">Previous Attempts</h3>
          <div className="space-y-3">
            {pastSessions.length > 0 ? (
              pastSessions.map((session: any) => {
                const score = session.score || 0
                const isCompleted = session.status === 'completed'
                const scoreColor =
                  score >= 80 ? 'text-[#10B981]' :
                  score >= 60 ? 'text-[#F59E0B]' :
                  'text-[#EF4444]'
                const scoreBgColor =
                  score >= 80 ? 'bg-[#D1FAE5]' :
                  score >= 60 ? 'bg-[#FEF3C7]' :
                  'bg-[#FEE2E2]'

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (isCompleted) {
                        navigate(`/exam/${session.exam_id}/results`, {
                          state: { sessionId: session.id }
                        })
                      }
                    }}
                    className={`bg-white border border-[#E5E7EB] rounded-[14px] p-6 ${
                      isCompleted ? 'cursor-pointer hover:border-[#4F46E5] transition-all' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-[#111827]">
                            {session.exams?.name || 'Exam'}
                          </h4>
                          {isCompleted && (
                            <CheckCircle className="w-5 h-5 text-[#10B981]" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                          <span>
                            {new Date(session.started_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {session.exams?.duration_min && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {session.exams.duration_min} min
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {isCompleted ? (
                          <div className={`px-4 py-2 rounded-[10px] ${scoreBgColor}`}>
                            <div className={`text-2xl font-bold ${scoreColor}`}>
                              {score}%
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-2 rounded-[10px] bg-[#F3F4F6]">
                            <div className="text-sm font-medium text-[#6B7280]">
                              In Progress
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-[14px] p-8 text-center">
                <div className="text-[#6B7280]">
                  No previous attempts yet. Take your first practice exam to get started.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant 
        context={`Course: ${course.code} - Exam Mode`}
        courseId={courseId}
        mode="exam"
      />
    </div>
  )
}
