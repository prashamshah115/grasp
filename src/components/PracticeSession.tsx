/**
 * PracticeSession Component - FULLY INTEGRATED
 *
 * Route: /session/:sessionId
 *
 * FEATURES:
 * ✅ Fetches session details from backend
 * ✅ Adaptive question loading via spaced repetition
 * ✅ Real-time answer submission and feedback
 * ✅ SM-2 algorithm integration for question history
 * ✅ Session completion with stats
 * ✅ Full React Query integration
 *
 * BACKEND INTEGRATION:
 * - fetchSessionDetails() - Get session metadata
 * - getNextGlobalQuestion() - Spaced repetition question selection
 * - submitAnswer() - Submit answer and get immediate feedback
 * - updateQuestionHistory() - Update SM-2 spaced repetition
 * - endSession() - Complete session and calculate stats
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Lightbulb, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useGlobalQuestion, useUpdateQuestionHistory } from '@/hooks/useGlobalPractice'
import { useSubmitAnswer, useEndSession } from '@/hooks/useSessions'
import { fetchSessionDetails } from '@/lib/api'
import type { Database } from '@/types/database'
import type { SubmitAnswerResponse } from '@/types/api'

type Question = Database['public']['Tables']['questions']['Row']

export function PracticeSession() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // ==================== STATE ====================

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null)
  const [questionsAnswered, setQuestionsAnswered] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())

  // ==================== QUERIES ====================

  // Fetch session details
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSessionDetails(sessionId!),
    enabled: !!sessionId,
  })

  // ==================== MUTATIONS ====================

  // Get next question (spaced repetition)
  const nextQuestionMutation = useGlobalQuestion()

  // Submit answer
  const submitAnswerMutation = useSubmitAnswer()

  // Update question history (SM-2)
  const updateHistoryMutation = useUpdateQuestionHistory()

  // End session
  const endSessionMutation = useEndSession()

  // ==================== EFFECTS ====================

  // Load first question on mount
  useEffect(() => {
    if (session && !currentQuestion && session.course_id) {
      loadNextQuestion()
    }
  }, [session])

  // ==================== HANDLERS ====================

  const loadNextQuestion = async () => {
    if (!session || !user) return

    try {
      const question = await nextQuestionMutation.mutateAsync({
        user_id: user.id,
        course_id: session.course_id,
      })

      setCurrentQuestion(question)
      setUserAnswer('')
      setShowFeedback(false)
      setShowHint(false)
      setFeedback(null)
      setQuestionStartTime(Date.now())
    } catch (error) {
      console.error('Failed to load next question:', error)
      // If no more questions available, end session
      handleEndSession()
    }
  }

  const handleSubmit = async () => {
    if (!currentQuestion || !session || !user) return

    const timeTakenSec = Math.floor((Date.now() - questionStartTime) / 1000)

    try {
      // Submit answer and get feedback
      const result = await submitAnswerMutation.mutateAsync({
        session_id: session.id,
        question_id: currentQuestion.id,
        user_id: user.id,
        answer: userAnswer,
        time_taken_sec: timeTakenSec,
      })

      setFeedback(result)
      setShowFeedback(true)
      setQuestionsAnswered(prev => prev + 1)

      // Update question history for spaced repetition
      await updateHistoryMutation.mutateAsync({
        user_id: user.id,
        question_id: currentQuestion.id,
        is_correct: result.is_correct,
      })
    } catch (error) {
      console.error('Failed to submit answer:', error)
    }
  }

  const handleNext = () => {
    // Configurable session length (default: 10 questions)
    const sessionLength = 10

    if (questionsAnswered >= sessionLength) {
      handleEndSession()
    } else {
      loadNextQuestion()
    }
  }

  const handleEndSession = async () => {
    if (!session) return

    try {
      const result = await endSessionMutation.mutateAsync({
        session_id: session.id,
      })

      // Navigate to course page with success message
      navigate(`/course/${session.course_id}/practice`, {
        state: {
          sessionComplete: true,
          stats: result.stats,
        },
      })
    } catch (error) {
      console.error('Failed to end session:', error)
      // Still navigate back on error
      navigate(`/course/${session.course_id}/practice`)
    }
  }

  const handleExit = () => {
    const confirmExit = window.confirm(
      'Are you sure you want to exit? Your progress will be saved.'
    )

    if (confirmExit) {
      handleEndSession()
    }
  }

  // ==================== LOADING & ERROR STATES ====================

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
          <p className="text-[#6B7280]">Loading session...</p>
        </div>
      </div>
    )
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#111827] mb-4">Session Not Found</h2>
          <p className="text-[#6B7280] mb-6">
            The session you're looking for doesn't exist or you don't have access to it.
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

  if (nextQuestionMutation.isLoading && !currentQuestion) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
          <p className="text-[#6B7280]">Loading question...</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#111827] mb-4">No Questions Available</h2>
          <p className="text-[#6B7280] mb-6">
            There are no questions available for this session right now.
          </p>
          <button
            onClick={() => navigate(`/course/${session.course_id}/practice`)}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-[12px] transition-all"
          >
            Back to Practice
          </button>
        </div>
      </div>
    )
  }

  // ==================== SESSION INFO ====================

  const sessionLength = 10 // Configurable
  const courseInfo = session.courses as any
  const topicInfo = session.topics as any

  const modeTitles = {
    'practice': 'Topic Practice',
    'global': 'Global Practice',
    'compression': 'Compression Practice',
    'exam': 'Exam Practice'
  }

  const modeTitle = modeTitles[session.mode as keyof typeof modeTitles] || 'Practice'

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Exit</span>
          </button>
          <div className="flex items-center gap-8">
            <span className="text-sm text-[#6B7280]">
              {courseInfo?.name || modeTitle}
              {topicInfo?.name && ` • ${topicInfo.name}`}
            </span>
            <span className="text-sm text-[#6B7280]">
              Question {questionsAnswered + 1} of {sessionLength}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[#F9FAFB] h-1">
        <div
          className="bg-[#4F46E5] h-1 transition-all duration-300"
          style={{ width: `${((questionsAnswered + 1) / sessionLength) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-8 py-16">
        {/* Question Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10 mb-8">
          {/* Source Reference (if available) */}
          {currentQuestion.source_ref && (
            <div className="text-sm text-[#6B7280] mb-6 pb-4 border-b border-[#E5E7EB]">
              📚 {currentQuestion.source_ref}
            </div>
          )}

          {/* Difficulty Badge */}
          <div className="flex items-center gap-3 mb-6">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              currentQuestion.difficulty === 1
                ? 'bg-green-100 text-green-700'
                : currentQuestion.difficulty === 2
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {currentQuestion.difficulty === 1 ? 'Easy' : currentQuestion.difficulty === 2 ? 'Medium' : 'Hard'}
            </span>
            <span className="text-xs text-[#6B7280]">
              {currentQuestion.q_type === 'mcq' ? 'Multiple Choice' : 'Free Response'}
            </span>
          </div>

          {/* Question Prompt */}
          <div className="text-2xl mb-8 leading-relaxed">
            {currentQuestion.prompt}
          </div>

          {/* MCQ Options (if applicable) */}
          {currentQuestion.q_type === 'mcq' && currentQuestion.options && !showFeedback && (
            <div className="space-y-3 mb-8">
              {Object.entries(currentQuestion.options as Record<string, string>).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setUserAnswer(key)}
                  className={`w-full text-left p-4 border-2 rounded-[12px] transition-all ${
                    userAnswer === key
                      ? 'border-[#4F46E5] bg-[#EEF2FF]'
                      : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                  }`}
                >
                  <span className="font-medium text-[#4F46E5] mr-3">{key}.</span>
                  <span className="text-[#111827]">{value}</span>
                </button>
              ))}
            </div>
          )}

          {/* Free Response Input */}
          {currentQuestion.q_type !== 'mcq' && !showFeedback && (
            <div className="space-y-4">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full min-h-[120px] p-4 border border-[#E5E7EB] rounded-[12px] text-lg resize-none focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
            </div>
          )}

          {/* Answer Controls */}
          {!showFeedback && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSubmit}
                disabled={!userAnswer.trim() || submitAnswerMutation.isLoading}
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-[12px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitAnswerMutation.isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Check Answer
              </button>
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-2 text-[#6B7280] hover:text-[#4F46E5] transition-colors px-4 py-3"
              >
                <Lightbulb className="w-5 h-5" />
                <span className="text-sm">{showHint ? 'Hide' : 'Show'} Hint</span>
              </button>
            </div>
          )}

          {/* Hint */}
          {showHint && currentQuestion.hint && !showFeedback && (
            <div className="bg-[#FEF3C7] border border-[#FDE047] rounded-[12px] p-4 text-sm mt-4">
              <div className="text-[#92400E] mb-1">💡 Hint</div>
              <div className="text-[#92400E]">{currentQuestion.hint}</div>
            </div>
          )}

          {/* Feedback */}
          {showFeedback && feedback && (
            <div className="space-y-6">
              {/* Result Banner */}
              <div className={`${
                feedback.is_correct
                  ? 'bg-[#F0FDF4] border-[#22C55E]'
                  : 'bg-[#FEF2F2] border-[#EF4444]'
              } border rounded-[12px] p-6`}>
                <div className={`text-sm mb-2 font-medium ${
                  feedback.is_correct ? 'text-[#166534]' : 'text-[#991B1B]'
                }`}>
                  {feedback.is_correct ? '✓ Correct!' : '✗ Incorrect'}
                </div>
                <div className={feedback.is_correct ? 'text-[#166534]' : 'text-[#991B1B]'}>
                  Your answer: <strong>{userAnswer}</strong>
                </div>
              </div>

              {/* Correct Answer (if incorrect) */}
              {!feedback.is_correct && (
                <div className="bg-[#F0FDF4] border border-[#22C55E] rounded-[12px] p-6">
                  <div className="text-sm text-[#166534] mb-2">✓ Correct Answer</div>
                  <div className="text-[#166534]">
                    {currentQuestion.q_type === 'mcq' && currentQuestion.options
                      ? `${feedback.correct_answer}. ${(currentQuestion.options as any)[feedback.correct_answer]}`
                      : feedback.correct_answer
                    }
                  </div>
                </div>
              )}

              {/* Explanation */}
              {feedback.explanation && (
                <div className="bg-[#F9FAFB] rounded-[12px] p-6">
                  <div className="text-sm text-[#6B7280] mb-2">📖 Explanation</div>
                  <div className="text-[#111827]">{feedback.explanation}</div>
                </div>
              )}

              {/* Next Button */}
              <button
                onClick={handleNext}
                disabled={nextQuestionMutation.isLoading}
                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-4 rounded-[12px] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {nextQuestionMutation.isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading Next Question...
                  </>
                ) : questionsAnswered >= sessionLength - 1 ? (
                  <>
                    Complete Session
                    <ChevronRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    Next Question
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Session Progress */}
        <div className="text-center text-sm text-[#6B7280]">
          <p>Progress will be saved automatically</p>
        </div>
      </main>
    </div>
  )
}
