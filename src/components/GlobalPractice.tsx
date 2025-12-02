/**
 * GlobalPractice Component
 * Adaptive question practice using spaced repetition across all courses
 * Allows users to practice questions from all enrolled courses
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Target, BookOpen, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useStartSession } from '@/hooks'
import { useCourses } from '@/hooks/useCourses'
import LoadingScreen from './LoadingScreen'
import { AIAssistant } from './shared/AIAssistant'

export default function GlobalPractice() {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const [startError, setStartError] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  // Fetch all enrolled courses
  const { data: courses, isLoading: coursesLoading } = useCourses()
  const startSession = useStartSession()

  const isLoading = authLoading || coursesLoading

  if (isLoading) {
    return <LoadingScreen message="Loading global practice..." />
  }

  const handleStartSession = async (
    courseId: string | null = selectedCourseId,
    weakOnly: boolean = false
  ) => {
    if (!user) return

    if (!courseId && courses && courses.length > 0) {
      // If no course selected, use first course
      courseId = courses[0].id
    }

    if (!courseId) {
      setStartError('Please select a course to practice')
      return
    }

    try {
      const session = await startSession.mutateAsync({
        user_id: user.id,
        course_id: courseId,
        mode: 'global',
      })
      // Navigate with weakOnly flag in route state
      navigate(`/session/${session.id}`, { state: { weakOnly } })
    } catch (error) {
      console.error('Failed to start session:', error)
      setStartError(
        error instanceof Error ? error.message : 'Failed to start session'
      )
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl mb-4 tracking-tight">Global Practice</h1>
          <p className="text-[#6B7280] text-lg">
            Adaptive questions that target your weak spots across all courses
          </p>
        </div>

        {/* Course Selection */}
        {courses && courses.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-[#6B7280] mb-2">
              Select Course (optional)
            </label>
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(e.target.value || null)}
              className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
            >
              <option value="">All Courses (will use first available)</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Start Practice CTA */}
        <div className="bg-gradient-to-br from-[#4F46E5] to-[#4338CA] rounded-[16px] p-10 mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl text-white mb-3">Start Adaptive Practice</h2>
              <p className="text-[#C7D2FE] text-lg">
                Questions automatically adapt to your mastery level
              </p>
              {startError && (
                <p className="mt-3 text-sm text-red-200">{startError}</p>
              )}
            </div>
            <button
              onClick={() => handleStartSession(null, false)}
              disabled={startSession.isPending || !courses || courses.length === 0}
              className="bg-white text-[#4F46E5] px-8 py-4 rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startSession.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </span>
              ) : (
                'Begin Session'
              )}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xl mb-4">Quick Start</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleStartSession(null, false)}
              disabled={startSession.isPending || !courses || courses.length === 0}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 text-left hover:border-[#4F46E5] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center mb-4 group-hover:bg-[#FDE68A] transition-colors">
                <Zap className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <h4 className="font-medium mb-2">Quick Warmup</h4>
              <p className="text-sm text-[#6B7280]">Adaptive questions from all courses</p>
            </button>

            <button
              onClick={() => handleStartSession(null, true)}
              disabled={startSession.isPending || !courses || courses.length === 0}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 text-left hover:border-[#4F46E5] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#FEE2E2] flex items-center justify-center mb-4 group-hover:bg-[#FECACA] transition-colors">
                <Target className="w-6 h-6 text-[#EF4444]" />
              </div>
              <h4 className="font-medium mb-2">Weak Spots Only</h4>
              <p className="text-sm text-[#6B7280]">Focus on areas that need improvement</p>
            </button>
          </div>
        </div>

        {/* Info Section */}
        {(!courses || courses.length === 0) && (
          <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 mb-1">No Courses Available</h4>
                <p className="text-sm text-yellow-700">
                  You need to be enrolled in at least one course to use Global Practice.
                  Visit the Course Catalog to enroll in a course.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* AI Assistant */}
      <AIAssistant 
        context="Global Practice Mode"
        mode="practice"
      />
    </div>
  )
}
