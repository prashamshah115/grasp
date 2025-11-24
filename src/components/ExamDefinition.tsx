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
import { fetchExam } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import LoadingScreen from './LoadingScreen'

export default function ExamDefinition() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()

  const { data: exam, isLoading } = useQuery({
    queryKey: queryKeys.exams.detail(examId!),
    queryFn: () => fetchExam(examId!),
    enabled: !!examId,
  })

  if (isLoading) return <LoadingScreen message="Loading exam..." />

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

  const handleStartExam = () => {
    // Navigate to start route (loader will create session)
    navigate(`/exam/${examId}/start`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-4">{exam.name}</h1>

        <div className="mb-6 space-y-2">
          <p className="text-gray-600">
            <strong>Duration:</strong> {exam.duration_min} minutes
          </p>
          <p className="text-gray-600">
            <strong>Questions:</strong> {exam.num_questions || 'TBD'}
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Instructions</h2>
          <p className="text-gray-700">
            This exam will test your knowledge on the course material.
            You will have {exam.duration_min} minutes to complete all questions.
            Once you start, the timer cannot be paused.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStartExam}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Start Exam
          </button>
        </div>
      </div>
    </div>
  )
}
