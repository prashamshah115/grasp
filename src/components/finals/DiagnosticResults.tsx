/**
 * DiagnosticResults Component
 * 
 * Shows diagnostic exam results with:
 * - Overall mastery score
 * - Topic breakdown with weak areas highlighted
 * - CTA to generate personalized study plan
 */

import { useNavigate } from 'react-router-dom'
import { TrendingDown, Sparkles, Trophy, AlertCircle, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DiagnosticResultsProps {
  score: number // 0-1 normalized score
  topicMastery: Record<string, number> // topicId -> score (0-1)
  courseId: string
  topicNames: Record<string, string> // topicId -> name
}

export function DiagnosticResults({ 
  score, 
  topicMastery, 
  courseId, 
  topicNames 
}: DiagnosticResultsProps) {
  const navigate = useNavigate()
  
  // Sort topics by mastery (weakest first)
  const sortedTopics = Object.entries(topicMastery)
    .map(([id, scoreValue]) => ({ 
      id, 
      score: scoreValue, 
      name: topicNames[id] || 'Unknown Topic' 
    }))
    .sort((a, b) => a.score - b.score)
  
  const weakTopics = sortedTopics.slice(0, 3)
  const percentageScore = Math.round(score * 100)
  
  // Determine performance level
  const performanceLevel = percentageScore >= 80 ? 'excellent' 
    : percentageScore >= 60 ? 'good' 
    : percentageScore >= 40 ? 'fair' 
    : 'needs-work'
  
  const performanceColors = {
    excellent: { bg: 'from-[#10B981] to-[#059669]', text: 'Excellent' },
    good: { bg: 'from-[#4F46E5] to-[#6366F1]', text: 'Good' },
    fair: { bg: 'from-[#F59E0B] to-[#D97706]', text: 'Fair' },
    'needs-work': { bg: 'from-[#EF4444] to-[#DC2626]', text: 'Needs Work' }
  }
  
  const perf = performanceColors[performanceLevel]
  
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Overall Score Card */}
      <div className={`bg-gradient-to-r ${perf.bg} rounded-[16px] p-8 text-white text-center shadow-xl`}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Trophy className="w-8 h-8" />
          <h2 className="text-3xl font-bold">Diagnostic Complete!</h2>
        </div>
        <div className="text-7xl font-bold my-6">{percentageScore}%</div>
        <p className="text-white/90 text-lg">Overall Mastery • {perf.text}</p>
      </div>
      
      {/* Performance Message */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6">
        {performanceLevel === 'excellent' ? (
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">Strong Foundation!</h3>
              <p className="text-sm text-[#6B7280]">
                You have a solid understanding of the material. Focus on maintaining your knowledge and 
                reviewing any weaker areas identified below.
              </p>
            </div>
          </div>
        ) : performanceLevel === 'good' ? (
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">Good Progress!</h3>
              <p className="text-sm text-[#6B7280]">
                You're on the right track. Focus your study time on the weak areas below to 
                improve your final exam performance.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-[#111827] mb-1">Focus Needed</h3>
              <p className="text-sm text-[#6B7280]">
                You have significant room for improvement. Don't worry - we'll create a focused 
                study plan targeting your weak areas.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Weak Topics */}
      {weakTopics.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-[#EF4444]" />
            <h3 className="text-lg font-semibold text-[#111827]">Priority Focus Areas</h3>
          </div>
          <div className="space-y-3">
            {weakTopics.map((topic, idx) => (
              <div 
                key={topic.id} 
                className="flex items-center justify-between p-4 bg-[#FEF2F2] border border-[#FEE2E2] rounded-[10px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#EF4444] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    {idx + 1}
                  </div>
                  <span className="text-[#111827] font-medium">{topic.name}</span>
                </div>
                <span className="text-sm font-semibold text-[#EF4444]">
                  {Math.round(topic.score * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* All Topics Performance */}
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6">
        <h3 className="text-lg font-semibold text-[#111827] mb-4">Full Topic Breakdown</h3>
        <div className="space-y-2">
          {sortedTopics.map(topic => {
            const topicPercent = Math.round(topic.score * 100)
            const isWeak = topicPercent < 60
            
            return (
              <div key={topic.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#111827]">{topic.name}</span>
                    <span className={`text-sm font-medium ${isWeak ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                      {topicPercent}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        isWeak ? 'bg-[#EF4444]' : 'bg-[#10B981]'
                      }`}
                      style={{ width: `${topicPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* CTA Button */}
      <Button
        onClick={() => navigate(`/course/${courseId}/finals/plan`)}
        className="w-full bg-[#10B981] hover:bg-[#059669] text-white py-6 text-lg rounded-[12px] shadow-lg hover:shadow-xl transition-all"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        Generate My Study Plan
      </Button>
      
      {/* Helpful Tip */}
      <div className="text-center text-sm text-[#6B7280]">
        <p>Your study plan will prioritize your weakest topics and ensure you're ready for the final.</p>
      </div>
    </div>
  )
}

