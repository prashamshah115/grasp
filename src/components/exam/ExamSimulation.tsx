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
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  fetchExamSessionWithQuestions,
  submitExamAnswer,
  fetchExamAnswers,
} from '@/lib/api'
import { useSubmitExam } from '@/hooks/useSessions'
import { QuestionCard } from '../shared/QuestionCard'
import { ExamTimer } from './ExamTimer'
import { QuestionNavigator } from './QuestionNavigator'
import { SubmitExamModal } from './SubmitExamModal'
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

  // ==================== QUERIES ====================

  // Try to get session data from router state (if redirected from start exam)
  const sessionFromState = location.state?.sessionData as CreateExamSessionResponse | undefined

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

  // Fetch previously saved answers (for page refresh)
  const { data: savedAnswers } = useQuery({
    queryKey: ['examAnswers', sessionId],
    queryFn: () => fetchExamAnswers(sessionId!),
    enabled: !!sessionId && !!session,
  })

  // Load saved answers into state
  useEffect(() => {
    if (savedAnswers && savedAnswers.length > 0) {
      const answersMap: Record<string, string> = {}
      savedAnswers.forEach((answer: any) => {
        answersMap[answer.question_id] = answer.user_answer
      })
      setAnswers(answersMap)
    }
  }, [savedAnswers])

  // ==================== MUTATIONS ====================

  // Save individual answer
  const saveAnswerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      submitExamAnswer(sessionId!, questionId, answer),
  })

  // Submit exam (server-side scoring)
  const submitExamMutation = useSubmitExam()

  // ==================== HANDLERS ====================

  const handleSelectAnswer = (answerId: string) => {
    if (!session) return

    const currentQuestion = session.questions[currentQuestionIndex]
    const newAnswers = { ...answers, [currentQuestion.id]: answerId }
    setAnswers(newAnswers)

    // Auto-save answer to database
    saveAnswerMutation.mutate({
      questionId: currentQuestion.id,
      answer: answerId,
    })
  }

  const handleToggleFlag = () => {
    if (!session) return

    const currentQuestion = session.questions[currentQuestionIndex]
    const newFlagged = new Set(flagged)

    if (newFlagged.has(currentQuestion.id)) {
      newFlagged.delete(currentQuestion.id)
    } else {
      newFlagged.add(currentQuestion.id)
    }

    setFlagged(newFlagged)
  }

  const handleNext = () => {
    if (!session) return

    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleNavigateToQuestion = (questionNumber: number) => {
    setCurrentQuestionIndex(questionNumber - 1)
  }

  const handleTimeUp = () => {
    // Auto-submit when time runs out
    handleSubmitExam()
  }

  const handleSubmitExam = async () => {
    if (!session || isSubmitting) return

    setIsSubmitting(true)

    try {
      // Submit exam via edge function (server-side scoring)
      const result = await submitExamMutation.mutateAsync({
        session_id: session.session_id,
      })

      // Navigate to results page with data
      navigate(`/exam/${session.exam.id}/results`, {
        state: {
          examResults: result,
        },
      })
    } catch (error) {
      console.error('Failed to submit exam:', error)
      alert('Failed to submit exam. Please try again.')
      setIsSubmitting(false)
    }
  }

  const handleExit = () => {
    const confirmExit = window.confirm(
      'Are you sure you want to exit? Your answers have been saved and you can resume later.'
    )

    if (confirmExit && session) {
      navigate(`/exam/${session.exam.id}`)
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

  const currentQuestion = session.questions[currentQuestionIndex]
  const answeredCount = Object.keys(answers).length

  const questionsWithStatus = session.questions.map((q, index) => ({
    id: q.id,
    number: index + 1,
    isAnswered: !!answers[q.id],
    isFlagged: flagged.has(q.id),
  }))

  // Format options for QuestionCard component
  const formattedOptions =
    currentQuestion.q_type === 'mcq' && currentQuestion.options
      ? Object.entries(currentQuestion.options as Record<string, string>).map(([id, text]) => ({
          id,
          text,
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
                onTimeUp={handleTimeUp}
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
              <div className="text-sm text-[#6B7280] mb-6 pb-4 border-b border-[#E5E7EB]">
                📚 Source: {currentQuestion.source_ref}
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
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full min-h-[200px] p-4 border border-[#E5E7EB] rounded-[12px] text-lg resize-none focus:outline-none focus:border-[#4F46E5] transition-colors"
                />

                {/* Auto-save indicator */}
                {saveAnswerMutation.isLoading && (
                  <div className="text-sm text-[#6B7280] mt-2 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </div>
                )}
                {saveAnswerMutation.isSuccess && !saveAnswerMutation.isLoading && (
                  <div className="text-sm text-[#10B981] mt-2">✓ Saved</div>
                )}
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
    </div>
  )
}
