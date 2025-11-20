/**
 * ExamResults Component
 * Shows exam results and performance breakdown
 *
 * ROUTE: /exam/:examId/results
 *
 * INTEGRATION STATUS: Placeholder (will integrate with exam session data)
 */

import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchExam } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import LoadingScreen from './LoadingScreen'

export default function ExamResults() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const { data: exam, isLoading } = useQuery({
    queryKey: queryKeys.exams.detail(examId!),
    queryFn: () => fetchExam(examId!),
    enabled: !!examId,
  })

  // TODO: Fetch actual exam session results
  // const { data: results } = useQuery({
  //   queryKey: queryKeys.sessions.detail(sessionId!),
  //   queryFn: () => fetchSession(sessionId!),
  //   enabled: !!sessionId,
  // })

  if (isLoading) return <LoadingScreen message="Loading results..." />

  // Mock results for now
  const mockScore = 85
  const mockCorrect = 17
  const mockTotal = 20
  const mockTimeSpent = 45 // minutes

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Exam Complete!</h1>
          <p className="text-gray-600">{exam?.title}</p>
        </div>

        {/* Score */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {mockScore}%
            </div>
            <div className="text-gray-600">
              {mockCorrect} out of {mockTotal} correct
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Time Spent</div>
            <div className="text-2xl font-bold">{mockTimeSpent} min</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Accuracy</div>
            <div className="text-2xl font-bold">{mockScore}%</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate(`/exam/${examId}`)}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Review Exam
          </button>
          <button
            onClick={() => navigate(`/course/${exam?.course_id || ''}/exam`)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Exams
          </button>
        </div>
      </div>
    </div>
  )
}
