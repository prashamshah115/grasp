/**
 * ExamSimulation Component - FULLY INTEGRATED
 *
 * Route: /exam-session/:sessionId
 *
 * FEATURES:
 * ✅ Fetches exam session with questions from backend
 * ✅ Real-time answer persistence to database
 * ✅ Server-side exam scoring (no client-side scoring)
 * ✅ Timer with auto-submit on timeout
 * ✅ Question flagging
 * ✅ Answer auto-save
 * ✅ Question navigator sidebar
 * ✅ Double-submit prevention
 *
 * SECURITY:
 * ✅ Questions loaded WITHOUT correct answers
 * ✅ Scoring done server-side via submit-exam edge function
 * ✅ Session ownership validation
 * ✅ Time limit enforcement
 *
 * BACKEND INTEGRATION:
 * - fetchExamSessionWithQuestions() - Load session + questions (no correct answers)
 * - submitExamAnswer() - Save individual answers in real-time
 * - fetchExamAnswers() - Load previously submitted answers (on refresh)
 * - submitExam() - Server-side scoring via submit-exam edge function
 */

import { useState, useEffect } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, ChevronLeft, ChevronRight, Loader2, AlertCircle, BookOpen } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  fetchExamSessionWithQuestions,
  submitExamAnswer,
  updateExamAnswerFlag,
  fetchExamAnswers,
  updateExamSessionTimeRemaining,
} from '@/lib/api'
import { writeExamEvent } from '@/lib/api-extensions'
import { useSubmitExam } from '@/hooks/useSessions'
import { QuestionCard } from '../shared/QuestionCard'
import { ExamTimer } from './ExamTimer'
import { QuestionNavigator } from './QuestionNavigator'
import { SubmitExamModal } from './SubmitExamModal'
import { PDFViewerModal } from '../shared/PDFViewer'
import { AIAssistant } from '../shared/AIAssistant'
import { RelevantContentButton } from '../shared/RelevantContentButton'
import { RelevantContentViewer } from '../shared/RelevantContentViewer'
import { useRelevantContent } from '@/hooks/useRelevantContent'
import { supabase } from '@/lib/supabase'
import type { CreateExamSessionResponse } from '@/types/api'

export function ExamSimulation() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // ==================== STATE ====================

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSourceMaterials, setShowSourceMaterials] = useState(false)
  const [selectedPdf, setSelectedPdf] = useState<{
    url: string
    title: string
    page?: number
  } | null>(null)
  const [timeRemainingSec, setTimeRemainingSec] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<{
    questionId: string | null
    status: 'saving' | 'saved' | 'error'
  }>({ questionId: null, status: 'saved' })
  const [failedSaves, setFailedSaves] = useState<Set<string>>(new Set())
  const [showRelevantContent, setShowRelevantContent] = useState(false)

  // ==================== QUERIES ====================

  // Try to get session data from router state (if redirected from start exam)
  const sessionFromState = location.state?.sessionData as CreateExamSessionResponse | undefined

  // Read diagnostic flag from route state (immediate)
  const isDiagnosticFromState = location.state?.isDiagnostic === true

  // Fetch exam session with questions (fallback for page refresh)
  const {
    data: sessionData,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery({
    queryKey: ['examSession', sessionId],
    queryFn: () => fetchExamSessionWithQuestions(sessionId!),
    enabled: !!sessionId && !sessionFromState,
    staleTime: 0, // Always fetch fresh data
  })

  // Use session from state if available, otherwise from query
  const session = sessionFromState || sessionData

  // Determine if this is a diagnostic exam (from route state or database)
  const isDiagnostic = isDiagnosticFromState || (sessionData as any)?.is_diagnostic === true

  // Fetch previously saved answers (for page refresh)
  const { data: savedAnswers } = useQuery({
    queryKey: ['examAnswers', sessionId],
    queryFn: () => fetchExamAnswers(sessionId!),
    enabled: !!sessionId && !!session,
  })

  // Fetch source documents for current question's topic
  const currentQuestion = session?.questions[currentQuestionIndex]
  const { data: sourceDocuments } = useQuery({
    queryKey: ['sourceDocuments', currentQuestion?.topic_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('topic_id', currentQuestion!.topic_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!currentQuestion?.topic_id,
  })

  // Fetch relevant content for current question
  const {
    data: relevantContent,
    isLoading: relevantContentLoading,
    error: relevantContentError,
  } = useRelevantContent({
    questionId: currentQuestion?.id,
    questionText: currentQuestion?.prompt,
    topicId: currentQuestion?.topic_id,
    courseId: session?.exam?.course_id,
    enabled: showRelevantContent && !!currentQuestion,
  })

  // Load saved answers and flags from snapshot (faster resume)
  useEffect(() => {
    if (session && (session as any).answers && (session as any).state) {
      const snapshotAnswers = (session as any).answers || {}
      const snapshotState = (session as any).state || {}
      const snapshotFlags = snapshotState.flags || {}
      
      // Convert snapshot to state
      const answersMap: Record<string, string> = {}
      const flaggedSet = new Set<string>()
      
      Object.entries(snapshotAnswers).forEach(([questionId, answer]) => {
        if (answer && typeof answer === 'string') {
          answersMap[questionId] = answer
        }
      })
      
      Object.entries(snapshotFlags).forEach(([questionId, isFlagged]) => {
        if (isFlagged === true) {
          flaggedSet.add(questionId)
        }
      })
      
      setAnswers(answersMap)
      setFlagged(flaggedSet)
      
      // Resume to saved current_question_index or last answered question
      const savedIndex = (session as any).current_question_index ?? 0
      if (savedIndex >= 0 && savedIndex < session.questions.length) {
        setCurrentQuestionIndex(savedIndex)
      } else {
        // Fallback: find last answered question
        let lastAnsweredIndex = 0
        session.questions.forEach((q, idx) => {
          if (answersMap[q.id]) {
            lastAnsweredIndex = idx
          }
        })
        setCurrentQuestionIndex(lastAnsweredIndex)
      }
    } else if (savedAnswers && savedAnswers.length > 0) {
      // Fallback to old method if snapshot not available
      const answersMap: Record<string, string> = {}
      const flaggedSet = new Set<string>()
      let lastAnsweredIndex = 0
      
      savedAnswers.forEach((answer: any) => {
        if (answer.user_answer) {
          answersMap[answer.question_id] = answer.user_answer
          const questionIndex = session?.questions.findIndex(q => q.id === answer.question_id) ?? -1
          if (questionIndex > lastAnsweredIndex) {
            lastAnsweredIndex = questionIndex
          }
        }
        if (answer.is_flagged) {
          flaggedSet.add(answer.question_id)
        }
      })
      
      setAnswers(answersMap)
      setFlagged(flaggedSet)
      setCurrentQuestionIndex(lastAnsweredIndex)
    }
  }, [savedAnswers, session])

  // ==================== MUTATIONS ====================

  // Save individual answer with retry logic
  const saveAnswerMutation = useMutation({
    mutationFn: ({ questionId, answer, isFlagged }: { questionId: string; answer: string; isFlagged?: boolean }) =>
      submitExamAnswer(sessionId!, questionId, answer, isFlagged),
    retry: 3, // Increased retries
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    onSuccess: (data, variables) => {
      setSaveStatus({ questionId: variables.questionId, status: 'saved' })
      setFailedSaves((prev) => {
        const next = new Set(prev)
        next.delete(variables.questionId)
        return next
      })
      // Clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus((prev) => 
          prev.questionId === variables.questionId && prev.status === 'saved'
            ? { questionId: null, status: 'saved' }
            : prev
        )
      }, 2000)
    },
    onError: (error, variables) => {
      setSaveStatus({ questionId: variables.questionId, status: 'error' })
      setFailedSaves((prev) => new Set(prev).add(variables.questionId))
    },
  })

  // Debounced save answer function (10s debounce if staying on question)
  const debouncedSaveAnswer = useDebouncedCallback(
    (questionId: string, answer: string, isFlagged: boolean) => {
      setSaveStatus({ questionId, status: 'saving' })
      saveAnswerMutation.mutate(
        { questionId, answer, isFlagged },
        {
          onError: () => {
            // Retry once more after error
            setTimeout(() => {
              saveAnswerMutation.mutate({ questionId, answer, isFlagged })
            }, 2000)
          },
        }
      )
    },
    10000 // 10s debounce (reduced write frequency for cost optimization)
  )
  
  // Immediate save on navigate (no debounce)
  const immediateSaveAnswer = (questionId: string, answer: string, isFlagged: boolean) => {
    setSaveStatus({ questionId, status: 'saving' })
    saveAnswerMutation.mutate({ questionId, answer, isFlagged })
  }

  // Save flag status
  const saveFlagMutation = useMutation({
    mutationFn: ({ questionId, isFlagged }: { questionId: string; isFlagged: boolean }) =>
      updateExamAnswerFlag(sessionId!, questionId, isFlagged),
  })

  // Submit exam (server-side scoring)
  const submitExamMutation = useSubmitExam()
  
  // Update time remaining mutation
  const updateTimeMutation = useMutation({
    mutationFn: (timeRemainingSec: number) =>
      updateExamSessionTimeRemaining(sessionId!, timeRemainingSec),
  })

  // Initialize time remaining from session or localStorage backup
  useEffect(() => {
    if (session && sessionId) {
      // Check localStorage for backup time first
      try {
        const backupData = localStorage.getItem(`exam_time_${sessionId}`)
        if (backupData) {
          const backup = JSON.parse(backupData)
          // Use backup if it's recent (within 5 minutes) and session time is null or older
          if (Date.now() - backup.timestamp < 5 * 60 * 1000) {
            if (session.time_remaining_sec === null || backup.time_remaining_sec < session.time_remaining_sec) {
              setTimeRemainingSec(backup.time_remaining_sec)
              // Update database with backup time
              updateTimeMutation.mutate(backup.time_remaining_sec)
              localStorage.removeItem(`exam_time_${sessionId}`)
              return
            }
          } else {
            localStorage.removeItem(`exam_time_${sessionId}`)
          }
        }
      } catch (error) {
        console.error('[ExamSimulation] Failed to read localStorage backup:', error)
      }
      
      // Use session time_remaining_sec
      if (session.time_remaining_sec !== undefined && timeRemainingSec === null) {
        setTimeRemainingSec(session.time_remaining_sec)
      }
    }
  }, [session, sessionId, timeRemainingSec, updateTimeMutation])
  
  // Save time remaining on page unload (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timeRemainingSec !== null && timeRemainingSec > 0 && session) {
        // Use localStorage as backup since sendBeacon requires endpoint
        try {
          localStorage.setItem(`exam_time_${sessionId}`, JSON.stringify({
            session_id: sessionId,
            time_remaining_sec: timeRemainingSec,
            timestamp: Date.now()
          }))
        } catch (error) {
          // Silent fail for localStorage backup
        }
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionId, timeRemainingSec, session])

  // ==================== HANDLERS ====================

  const handleSelectAnswer = (answerId: string) => {
    if (!session || !session.questions || !Array.isArray(session.questions)) return

    const currentQuestion = session.questions[currentQuestionIndex]
    if (!currentQuestion || !currentQuestion.id) return
    
    const newAnswers = { ...answers, [currentQuestion.id]: answerId }
    setAnswers(newAnswers)

    // Auto-save answer to database (include current flag status) - debounced
    const isCurrentlyFlagged = flagged.has(currentQuestion.id)
    debouncedSaveAnswer(currentQuestion.id, answerId, isCurrentlyFlagged)
  }
  
  // Retry failed saves on window focus/blur
  useEffect(() => {
    const handleFocus = () => {
      if (failedSaves.size > 0) {
        // Retry all failed saves
        failedSaves.forEach((questionId) => {
          const answer = answers[questionId]
          if (answer) {
            const isFlagged = flagged.has(questionId)
            saveAnswerMutation.mutate({ questionId, answer, isFlagged })
          }
        })
      }
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [failedSaves, answers, flagged, saveAnswerMutation])

  const handleToggleFlag = () => {
    if (!session || !session.questions || !Array.isArray(session.questions)) return

    const currentQuestion = session.questions[currentQuestionIndex]
    if (!currentQuestion || !currentQuestion.id) return
    
    const newFlagged = new Set(flagged)
    const isCurrentlyFlagged = newFlagged.has(currentQuestion.id)

    if (isCurrentlyFlagged) {
      newFlagged.delete(currentQuestion.id)
    } else {
      newFlagged.add(currentQuestion.id)
    }

    setFlagged(newFlagged)

    // Save flag status to database
    saveFlagMutation.mutate({
      questionId: currentQuestion.id,
      isFlagged: !isCurrentlyFlagged,
    })
  }

  const handleNext = () => {
    if (!session) return

    if (currentQuestionIndex < session.questions.length - 1) {
      const fromIndex = currentQuestionIndex
      const toIndex = currentQuestionIndex + 1
      
      // Save current answer immediately before navigating
      const currentQuestion = session.questions[fromIndex]
      const currentAnswer = answers[currentQuestion.id]
      if (currentAnswer) {
        const isFlagged = flagged.has(currentQuestion.id)
        immediateSaveAnswer(currentQuestion.id, currentAnswer, isFlagged)
      }
      
      // Write navigate event
      writeExamEvent(sessionId!, 'navigate', {
        fromIndex,
        toIndex,
      }).catch(() => {}) // Silent fail for event logging
      
      setCurrentQuestionIndex(toIndex)
    }
  }

  const handlePrevious = () => {
    if (!session) return
    
    if (currentQuestionIndex > 0) {
      const fromIndex = currentQuestionIndex
      const toIndex = currentQuestionIndex - 1
      
      // Save current answer immediately before navigating
      const currentQuestion = session.questions[fromIndex]
      const currentAnswer = answers[currentQuestion.id]
      if (currentAnswer) {
        const isFlagged = flagged.has(currentQuestion.id)
        immediateSaveAnswer(currentQuestion.id, currentAnswer, isFlagged)
      }
      
      // Write navigate event
      writeExamEvent(sessionId!, 'navigate', {
        fromIndex,
        toIndex,
      }).catch(() => {}) // Silent fail for event logging
      
      setCurrentQuestionIndex(toIndex)
    }
  }

  const handleNavigateToQuestion = (questionNumber: number) => {
    if (!session) return
    
    // Validate question number is within bounds
    if (questionNumber < 1 || questionNumber > session.questions.length) {
      return
    }
    
    const fromIndex = currentQuestionIndex
    const toIndex = questionNumber - 1
    
    // Save current answer immediately before navigating
    const currentQuestion = session.questions[fromIndex]
    if (currentQuestion) {
      const currentAnswer = answers[currentQuestion.id]
      if (currentAnswer) {
        const isFlagged = flagged.has(currentQuestion.id)
        immediateSaveAnswer(currentQuestion.id, currentAnswer, isFlagged)
      }
    }
    
    // Write navigate event (allow navigation to any question)
    writeExamEvent(sessionId!, 'navigate', {
      fromIndex,
      toIndex,
    }).catch((err: any) => console.error('[ExamSimulation] Failed to write navigate event:', err))
    
    // Navigate to the selected question
    setCurrentQuestionIndex(toIndex)
  }

  const handleTimeUp = () => {
    // Auto-submit when time runs out
    handleSubmitExam()
  }

  const handleSubmitExam = async () => {
    if (!session || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Save current answer immediately (no debounce)
      const currentQuestion = session.questions[currentQuestionIndex]
      if (currentQuestion && answers[currentQuestion.id]) {
        const isFlagged = flagged.has(currentQuestion.id)
        await new Promise<void>((resolve) => {
          immediateSaveAnswer(currentQuestion.id, answers[currentQuestion.id], isFlagged)
          // Wait a bit for the save to initiate
          setTimeout(resolve, 500)
        })
      }

      // Step 2: Save all other answers that haven't been saved yet
      const savePromises: Promise<void>[] = []
      for (const question of session.questions) {
        if (answers[question.id] && question.id !== currentQuestion?.id) {
          const isFlagged = flagged.has(question.id)
          savePromises.push(
            new Promise<void>((resolve, reject) => {
              saveAnswerMutation.mutate(
                { questionId: question.id, answer: answers[question.id], isFlagged },
                {
                  onSuccess: () => resolve(),
                  onError: () => {
                    // Don't reject - continue with submission even if some saves fail
                    resolve()
                  },
                }
              )
            })
          )
        }
      }

      // Step 3: Retry failed saves
      if (failedSaves.size > 0) {
        for (const questionId of failedSaves) {
          if (answers[questionId]) {
            const question = session.questions.find((q) => q.id === questionId)
            if (question) {
              const isFlagged = flagged.has(questionId)
              savePromises.push(
                new Promise<void>((resolve) => {
                  saveAnswerMutation.mutate(
                    { questionId, answer: answers[questionId], isFlagged },
                    {
                      onSuccess: () => {
                        setFailedSaves((prev) => {
                          const next = new Set(prev)
                          next.delete(questionId)
                          return next
                        })
                        resolve()
                      },
                      onError: () => resolve(), // Continue even if retry fails
                    }
                  )
                })
              )
            }
          }
        }
      }

      // Wait for all saves to complete (with timeout)
      await Promise.allSettled(savePromises)

      // Step 4: Write submit event
      await writeExamEvent(sessionId!, 'submit', {
        submittedAt: new Date().toISOString(),
      }).catch(() => {
        // Non-blocking: continue with submission even if event write fails
      })
      
      // Step 5: Submit exam via edge function (server-side scoring)
      // Use sessionId from URL params (more reliable than session.session_id)
      const sessionIdToSubmit = sessionId || session?.session_id
      if (!sessionIdToSubmit) {
        throw new Error('Cannot submit: Session ID is missing')
      }
      
      const result = await submitExamMutation.mutateAsync({
        session_id: sessionIdToSubmit,
      })

      // Validate submission response before navigating
      if (!result) {
        throw new Error('Exam submission failed: No response from server')
      }

      // Note: result.success is always true in SubmitExamResponse type, but check anyway
      if (result.success === false) {
        throw new Error(result?.error || 'Exam submission failed: Server returned error')
      }

      if (!result.session_id || !result.exam_name) {
        throw new Error('Exam submission failed: Missing required data in response')
      }

      // Navigate to results page with data (only if submission succeeded)
      navigate(`/exam/${session.exam.id}/results`, {
        state: {
          examResults: result,
          isDiagnostic: isDiagnostic, // Pass diagnostic flag to results
          courseId: session.exam.course_id, // Pass courseId for ExamResults
        },
      })
    } catch (error: any) {
      // Always reset submitting state on error
      setIsSubmitting(false)
      
      // Extract error message from various possible locations
      const errorMessage = 
        error?.message || 
        error?.error?.message || 
        error?.originalError?.message ||
        error?.context?.message ||
        error?.error ||
        'Failed to submit exam. Please check your connection and try again.'
      
      alert(`Failed to submit exam: ${errorMessage}\n\nIf this problem persists, please contact support.`)
    }
  }

  const handleExit = async () => {
    const confirmExit = window.confirm(
      'Are you sure you want to exit? Your answers have been saved and you can resume later.'
    )

    if (confirmExit && session && timeRemainingSec !== null) {
      // Save current time remaining before exiting
      try {
        await updateTimeMutation.mutateAsync(timeRemainingSec)
      } catch (error) {
        // Show error but still allow exit
        alert('Warning: Time remaining may not have been saved. Your answers are saved.')
      }
      
      // Navigate back to exam landing page (/course/:courseId/exam) - ExamView component
      // Try multiple ways to get course_id
      let courseId = session.exam.course_id || 
                     (session.exam as any).course_id ||
                     (sessionFromState?.exam as any)?.course_id ||
                     (sessionData?.exam as any)?.course_id
      
      if (courseId) {
        // Navigate to exam landing page (ExamView component) - shows list of exams
        navigate(`/course/${courseId}/exam`, { replace: true })
      } else {
        // Fallback: navigate to courses page
        navigate('/courses', { replace: true })
      }
    }
  }
  
  // Periodic save of time remaining (every 10 seconds) - Optimized for event log pattern
  useEffect(() => {
    if (!session || timeRemainingSec === null || timeRemainingSec <= 0) return
    
    const interval = setInterval(() => {
      // Use current state value, not stale closure
      setTimeRemainingSec((current) => {
        if (current > 0 && !isSubmitting) {
          updateTimeMutation.mutate(current, {
            onError: () => {
              // Retry once after 2 seconds
              setTimeout(() => {
                setTimeRemainingSec((retryValue) => {
                  if (retryValue > 0) {
                    updateTimeMutation.mutate(retryValue)
                  }
                  return retryValue
                })
              }, 2000)
            }
          })
        }
        return current
      })
    }, 10000) // Every 10 seconds (reduced from 30s for better resume capability)
    
    return () => clearInterval(interval)
  }, [session, isSubmitting, updateTimeMutation]) // Remove timeRemainingSec from deps

  const handleOpenPdf = (documentId: string, title: string, page?: number) => {
    try {
      const doc = sourceDocuments?.find(d => d && d.id === documentId)
      if (!doc) {
        return
      }

      const storagePath = doc.storage_path || doc.file_path || ''
      if (!storagePath) {
        return
      }

      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(storagePath)

      if (!data?.publicUrl) {
        return
      }

      setSelectedPdf({
        url: data.publicUrl,
        title: title || doc.title || 'Document',
        page,
      })
      setShowSourceMaterials(false)
    } catch (error) {
      // Silent fail for PDF opening
    }
  }

  // ==================== LOADING & ERROR STATES ====================

  if (sessionLoading && !sessionFromState) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
          <p className="text-[#6B7280]">Loading exam session...</p>
        </div>
      </div>
    )
  }

  if (sessionError || (!session && !sessionLoading)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-[#111827] mb-4">Session Unavailable</h2>
          <p className="text-[#6B7280] mb-6">
            {sessionError
              ? 'This exam session could not be loaded or has already been completed.'
              : 'The exam session you are looking for does not exist.'}
          </p>
          <button
            onClick={() => navigate('/courses')}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-[12px] transition-all"
          >
            Back to Courses
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // ==================== RENDER ====================

  // Count only valid, non-empty answers for questions that exist in the session
  const answeredCount = session.questions.filter(q => 
    q?.id && answers[q.id] && answers[q.id].trim() !== ''
  ).length

  // Guard: if no current question, show loading or error
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
          <p className="text-[#6B7280]">Loading question...</p>
        </div>
      </div>
    )
  }

  const questionsWithStatus = (session?.questions && Array.isArray(session.questions) ? session.questions : []).map((q, index) => ({
    id: q?.id || String(index),
    number: index + 1,
    isAnswered: !!(q?.id && answers[q.id]),
    isFlagged: !!(q?.id && flagged.has(q.id)),
  }))

  // Format options for QuestionCard component
  const formattedOptions =
    currentQuestion?.q_type === 'mcq' && currentQuestion?.options
      ? Object.entries(currentQuestion.options as Record<string, any>)
          .filter(([id, value]) => id && value)
          .map(([id, value]) => ({
            id,
            text: typeof value === 'string' ? value : (value?.text || value || ''),
          }))
      : []

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#9CA3AF] mb-1">
                {session.exam.exam_type} • {session.exam.course_code}
              </div>
              <h1 className="text-2xl font-medium">{session.exam.name}</h1>
            </div>
            <div className="flex items-center gap-4">
              <ExamTimer
                durationMinutes={session.exam.duration_minutes}
                startTime={new Date(session.started_at)}
                timeRemainingSec={timeRemainingSec ?? session.time_remaining_sec}
                onTimeUp={handleTimeUp}
                onTick={(remainingSec) => setTimeRemainingSec(remainingSec)}
              />
              <button
                onClick={handleExit}
                className="px-4 py-2 text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Saves Warning */}
      {failedSaves.size > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-yellow-800 text-sm">
                Some answers failed to save. Failed questions: {Array.from(failedSaves).map((qId) => {
                  const question = session.questions.find((q) => q.id === qId)
                  return question ? session.questions.indexOf(question) + 1 : qId
                }).join(', ')}. These will be retried on submission.
              </p>
            </div>
            <button
              onClick={() => {
                // Retry all failed saves
                const retryPromises: Promise<void>[] = []
                for (const questionId of failedSaves) {
                  if (answers[questionId]) {
                    const question = session.questions.find((q) => q.id === questionId)
                    if (question) {
                      const isFlagged = flagged.has(questionId)
                      retryPromises.push(
                        new Promise<void>((resolve) => {
                          saveAnswerMutation.mutate(
                            { questionId, answer: answers[questionId], isFlagged },
                            {
                              onSuccess: () => {
                                setFailedSaves((prev) => {
                                  const next = new Set(prev)
                                  next.delete(questionId)
                                  return next
                                })
                                resolve()
                              },
                              onError: () => resolve(), // Continue even if retry fails
                            }
                          )
                        })
                      )
                    }
                  }
                }
                Promise.allSettled(retryPromises)
              }}
              className="px-4 py-2 text-sm font-medium bg-yellow-600 text-white rounded-[8px] hover:bg-yellow-700 transition-colors"
            >
              Retry Failed Saves
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Question Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-12">
            {/* Flag Button */}
            <div className="flex justify-end mb-6">
              <button
                onClick={handleToggleFlag}
                className={`flex items-center gap-2 px-4 py-2 rounded-[10px] border transition-all ${
                  flagged.has(currentQuestion.id)
                    ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#F59E0B]'
                    : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#F59E0B]'
                }`}
              >
                <Flag
                  className="w-4 h-4"
                  fill={flagged.has(currentQuestion.id) ? 'currentColor' : 'none'}
                />
                <span className="text-sm font-medium">
                  {flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag for review'}
                </span>
              </button>
            </div>

            {/* Source Reference (if available) */}
            {currentQuestion.source_ref && (
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E5E7EB]">
                <div className="text-sm text-[#6B7280]">
                  📚 Source: {currentQuestion.source_ref}
                </div>
                {sourceDocuments && sourceDocuments.length > 0 && (
                  <button
                    onClick={() => setShowSourceMaterials(true)}
                    className="flex items-center gap-2 text-sm text-[#4F46E5] hover:text-[#4338CA] transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    View Materials
                  </button>
                )}
              </div>
            )}

            {/* Question Card */}
            {currentQuestion.q_type === 'mcq' ? (
              <QuestionCard
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={session.questions.length}
                question={currentQuestion.prompt}
                options={formattedOptions}
                selectedAnswer={answers[currentQuestion.id] || null}
                onSelectAnswer={handleSelectAnswer}
                difficulty={
                  currentQuestion.difficulty === 1
                    ? 'easy'
                    : currentQuestion.difficulty === 2
                    ? 'medium'
                    : 'hard'
                }
              />
            ) : (
              <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10">
                {/* Question Number */}
                <div className="text-sm text-[#6B7280] mb-4">
                  Question {currentQuestionIndex + 1} of {session.questions.length}
                </div>

                {/* Question Prompt */}
                <div className="text-2xl mb-8 leading-relaxed">{currentQuestion.prompt}</div>

                {/* Free Response Input */}
                <div className="space-y-2">
                  <textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleSelectAnswer(e.target.value)}
                    placeholder="Type your answer here... Be thorough and explain your reasoning."
                    className="w-full min-h-[200px] p-4 border border-[#E5E7EB] rounded-[12px] text-lg resize-none focus:outline-none focus:border-[#4F46E5] transition-colors"
                  />
                  
                  {/* Character count and guidance */}
                  <div className="flex items-center justify-between text-sm text-[#6B7280]">
                    <span>{(answers[currentQuestion.id] || '').length} characters</span>
                    {(currentQuestion as any).frq_ideal_answer && (
                      <span className="text-[#9CA3AF]">
                        Expected: ~{Math.round(((currentQuestion as any).frq_ideal_answer.split(' ').length) * 0.8)}-
                        {Math.round(((currentQuestion as any).frq_ideal_answer.split(' ').length) * 1.2)} words
                      </span>
                    )}
                  </div>

                  {/* Auto-save indicator */}
                  {saveAnswerMutation.isLoading && (
                    <div className="text-sm text-[#6B7280] flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </div>
                  )}
                  {saveAnswerMutation.isSuccess && !saveAnswerMutation.isLoading && (
                    <div className="text-sm text-[#10B981]">✓ Saved</div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-[12px] border border-[#E5E7EB] font-medium hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {currentQuestionIndex === session.questions.length - 1 ? (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-[#10B981] text-white rounded-[12px] font-medium hover:bg-[#059669] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Question Navigator Sidebar */}
        <QuestionNavigator
          questions={questionsWithStatus}
          currentQuestionNumber={currentQuestionIndex + 1}
          onNavigateToQuestion={handleNavigateToQuestion}
        />
      </div>

      {/* Submit Modal */}
      <SubmitExamModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitExam}
        totalQuestions={session.questions.length}
        answeredQuestions={answeredCount}
        flaggedQuestions={flagged.size}
      />

      {/* Source Materials Modal */}
      {showSourceMaterials && sourceDocuments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSourceMaterials(false)}
          />
          <div className="relative bg-white rounded-[16px] p-8 max-w-2xl w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold mb-6">Source Materials</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sourceDocuments && Array.isArray(sourceDocuments) && sourceDocuments.length > 0 ? (
                sourceDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleOpenPdf(doc.id, doc.title || 'Document')}
                    className="w-full flex items-center gap-4 p-4 border border-[#E5E7EB] rounded-[12px] hover:border-[#4F46E5] hover:bg-[#F9FAFB] transition-all text-left"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-[10px] bg-[#FEE2E2] flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-[#EF4444]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#111827] truncate mb-1">
                        {doc.title || 'Untitled Document'}
                      </div>
                      <div className="text-sm text-[#6B7280]">
                        {doc.doc_type || 'Document'} • {doc.total_pages || '?'} pages
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-[#6B7280]">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No source materials available for this question.</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSourceMaterials(false)}
              className="mt-6 w-full px-4 py-3 bg-[#F3F4F6] text-[#111827] rounded-[12px] hover:bg-[#E5E7EB] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <PDFViewerModal
          isOpen={!!selectedPdf}
          url={selectedPdf.url}
          documentTitle={selectedPdf.title}
          initialPage={selectedPdf.page || 1}
          onClose={() => setSelectedPdf(null)}
        />
      )}

      {/* Relevant Content Button - Above AI Assistant */}
      {session && currentQuestion && (
        <RelevantContentButton
          onClick={() => setShowRelevantContent(true)}
          hasContent={!relevantContentLoading && (relevantContent?.total ?? 0) > 0}
          isLoading={relevantContentLoading}
        />
      )}

      {/* Relevant Content Viewer */}
      <RelevantContentViewer
        isOpen={showRelevantContent}
        onClose={() => setShowRelevantContent(false)}
        data={relevantContent}
        question={currentQuestion}
        isLoading={relevantContentLoading}
        error={relevantContentError}
        courseName={session?.exam?.course_name || 'Course Materials'}
      />

      {/* AI Assistant - Always Available */}
      {session && currentQuestion && (
        <AIAssistant 
          context={currentQuestion.prompt}
          questionId={currentQuestion.id}
          courseId={session.exam.course_id}
          mode="exam"
          placeholder="Ask about this question..."
        />
      )}
    </div>
  )
}
