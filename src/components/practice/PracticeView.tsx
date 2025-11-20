/**
 * PracticeView Component - PHASE 4 INTEGRATED
 * Main practice pillar view with mastery stats
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Uses useParams() to get courseId from URL
 * - Uses useCourse() hook for course data (React Query)
 * - Uses useCourseMastery() hook for mastery stats (React Query)
 * - Uses useTopics() hook for topic data (React Query)
 * - Uses useStartSession() mutation to create sessions
 * - Uses useNavigate() to navigate to session
 * - NO mock data, NO props
 */

import { Target, Zap } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCourse, useTopics, useCourseMastery, useStartSession } from '@/hooks'
import { useAppStore } from '@/lib/store'
import LoadingScreen from '../LoadingScreen'
import { AIAssistant } from '../shared/AIAssistant'

export function PracticeView() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user } = useAppStore()

  // Fetch course data with React Query
  const { data: course, isLoading: courseLoading } = useCourse(courseId!)

  // Fetch topics for this course
  const { data: topics, isLoading: topicsLoading } = useTopics(courseId!)

  // Fetch mastery data
  const { data: mastery, isLoading: masteryLoading } = useCourseMastery(
    user?.id || '',
    courseId!
  )

  // Start session mutation
  const startSession = useStartSession()

  const isLoading = courseLoading || topicsLoading || masteryLoading

  if (isLoading) {
    return <LoadingScreen message="Loading practice view..." />
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Course not found</p>
      </div>
    )
  }

  // Calculate mastery percentage from actual data
  const totalAttempts = mastery?.reduce((sum, m) => sum + m.num_attempts, 0) || 0
  const correctAttempts = mastery?.reduce((sum, m) => sum + m.num_correct, 0) || 0
  const masteryPercentage = totalAttempts > 0
    ? Math.round((correctAttempts / totalAttempts) * 100)
    : 0

  // Count weak spots (topics with low mastery)
  const weakSpots = mastery?.filter(m => m.mastery_level === 'weak').length || 0

  const totalTopics = topics?.length || 0

  const handleStartSession = async () => {
    try {
      const session = await startSession.mutateAsync({
        course_id: courseId!,
        mode: 'practice',
      })
      // Navigate to global session route
      navigate(`/session/${session.id}`)
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="text-sm text-[#9CA3AF] mb-2">{course.code}</div>
          <h1 className="text-5xl mb-4 tracking-tight">Practice Mode</h1>
          <p className="text-[#6B7280] text-lg">
            Adaptive questions that target your weak spots and build mastery
          </p>
        </div>

        {/* Mastery Overview */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-8">
            <div className="text-sm text-[#9CA3AF] mb-2">Mastery</div>
            <div className="text-4xl mb-1">{masteryPercentage}%</div>
            <div className="text-sm text-[#6B7280]">Overall Progress</div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-8">
            <div className="text-sm text-[#9CA3AF] mb-2">Topics</div>
            <div className="text-4xl mb-1">{totalTopics}</div>
            <div className="text-sm text-[#6B7280]">Total Covered</div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-8">
            <div className="text-sm text-[#9CA3AF] mb-2">Focus</div>
            <div className="text-4xl mb-1 text-[#EF4444]">{weakSpots}</div>
            <div className="text-sm text-[#6B7280]">Weak Areas</div>
          </div>
        </div>

        {/* Start Practice CTA */}
        <div className="bg-gradient-to-br from-[#4F46E5] to-[#4338CA] rounded-[16px] p-10 mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl text-white mb-3">Start Adaptive Practice</h2>
              <p className="text-[#C7D2FE] text-lg">
                Questions automatically adapt to your mastery level
              </p>
            </div>
            <button
              onClick={handleStartSession}
              disabled={startSession.isPending}
              className="bg-white text-[#4F46E5] px-8 py-4 rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-all shadow-lg disabled:opacity-50"
            >
              {startSession.isPending ? 'Starting...' : 'Begin Session'}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xl mb-4">Quick Start</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 text-left hover:border-[#4F46E5] transition-all group">
              <div className="w-12 h-12 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center mb-4 group-hover:bg-[#FDE68A] transition-colors">
                <Zap className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <h4 className="font-medium mb-2">Quick Warmup</h4>
              <p className="text-sm text-[#6B7280]">5 rapid-fire review questions</p>
            </button>
            
            <button className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 text-left hover:border-[#4F46E5] transition-all group">
              <div className="w-12 h-12 rounded-[12px] bg-[#FEE2E2] flex items-center justify-center mb-4 group-hover:bg-[#FECACA] transition-colors">
                <Target className="w-6 h-6 text-[#EF4444]" />
              </div>
              <h4 className="font-medium mb-2">Weak Spots Only</h4>
              <p className="text-sm text-[#6B7280]">Focus on your {course.weakSpots} weak areas</p>
            </button>
          </div>
        </div>
      </div>
      
      {/* AI Assistant */}
      <AIAssistant context={`Course: ${course.code} - Practice Mode`} />
    </div>
  );
}
