/**
 * ExamView Component - PHASE 4 INTEGRATED
 * Exam pillar - shows list of available exams for a course
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Uses useParams() to get courseId from URL
 * - Uses useCourse() hook for course data (React Query)
 * - Uses useExams() hook to fetch exams list (React Query)
 * - Navigates to /exam/:examId when user clicks an exam
 * - Shows past exam attempts (placeholder for now)
 * - NO mock data, NO props
 */

import { Trophy, Clock, FileCheck, AlertCircle } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCourse } from '@/hooks'
import LoadingScreen from '../LoadingScreen'
import { AIAssistant } from '../shared/AIAssistant'
import { useQuery } from '@tanstack/react-query'
import { fetchExams } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'

export function ExamView() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  // Fetch course data
  const { data: course, isLoading: courseLoading } = useCourse(courseId!)

  // Fetch exams for this course
  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: queryKeys.exams.byCourse(courseId!),
    queryFn: () => fetchExams(courseId!),
    enabled: !!courseId,
  })

  const isLoading = courseLoading || examsLoading

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

  const handleStartExam = (examId: string) => {
    // Navigate to exam definition page
    navigate(`/exam/${examId}`)
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
                    <h2 className="text-3xl text-white mb-3">{exam.title}</h2>
                    <p className="text-[#FDE68A] text-lg mb-6">
                      Simulates real exam conditions with timer and question navigation
                    </p>

                    {/* Exam Stats */}
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">{exam.duration_minutes} minutes</span>
                      </div>
                      {exam.num_questions && (
                        <div className="flex items-center gap-2 text-white">
                          <FileCheck className="w-5 h-5" />
                          <span className="font-medium">{exam.num_questions} questions</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartExam(exam.id)}
                    className="bg-white text-[#F59E0B] px-8 py-4 rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-all shadow-lg"
                  >
                    Start Exam
                  </button>
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

        {/* Past Attempts - Placeholder */}
        <div>
          <h3 className="text-xl mb-4">Previous Attempts</h3>
          <div className="space-y-3">
            {/* TODO: Fetch and display real past attempts */}
            <div className="bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-[14px] p-8 text-center">
              <div className="text-[#6B7280]">
                No previous attempts yet. Take your first practice exam to get started.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant context={`Course: ${course.code} - Exam Mode`} />
    </div>
  )
}
