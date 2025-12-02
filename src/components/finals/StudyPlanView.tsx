"use client";

/**
 * Study Plan View Component
 * 
 * Displays the backend-generated multi-day study plan from study_plans table.
 * Users can view their plan, mark tasks as complete, and track progress.
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  BookOpen,
  Target,
  Brain,
  RotateCw,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Trophy,
  TrendingUp,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useStudyPlan, useUpdateStudyPlanProgress, useArchiveStudyPlan, useFinalsFlow, type StudyPlan } from '@/hooks/useFinals';
import { useCourse } from '@/hooks';
import { useAuth } from '@/components/auth/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { EmptyStateCtaCard } from './EmptyStateCtaCard';
import { DiagnosticCard } from './DiagnosticCard';

interface StudyPlanViewProps {
  courseId?: string;
  courseCode?: string;
}

const TASK_TYPE_ICONS = {
  read: BookOpen,
  practice: Target,
  review: Brain,
  quiz: RotateCw,
  rest: Trophy,
};

const TASK_TYPE_COLORS = {
  read: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', border: 'border-[#3B82F6]' },
  practice: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', border: 'border-[#F59E0B]' },
  review: { bg: 'bg-[#E9D5FF]', text: 'text-[#6B21A8]', border: 'border-[#A855F7]' },
  quiz: { bg: 'bg-[#D1FAE5]', text: 'text-[#065F46]', border: 'border-[#10B981]' },
  rest: { bg: 'bg-[#F3F4F6]', text: 'text-[#4B5563]', border: 'border-[#6B7280]' },
};

const PRIORITY_COLORS = {
  1: 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]',
  2: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]',
  3: 'bg-[#DBEAFE] text-[#1E40AF] border-[#3B82F6]',
};

export function StudyPlanView({ courseId: propCourseId, courseCode: propCourseCode }: StudyPlanViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { courseId: paramCourseId } = useParams<{ courseId: string }>();
  
  // Support both props (from component usage) and params (from route)
  const courseId = propCourseId || paramCourseId || '';
  const { data: course, isLoading: courseLoading } = useCourse(courseId);
  const courseCode = propCourseCode || course?.code || '';
  
  const { data: plan, isLoading: planLoading, refetch } = useStudyPlan(courseId);
  const { flowStep } = useFinalsFlow(courseId);
  const isLoading = courseLoading || planLoading;
  const updateProgress = useUpdateStudyPlanProgress();
  const archivePlan = useArchiveStudyPlan();

  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1])); // Expand first day by default

  const toggleDay = (day: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  const handleTaskToggle = async (day: number, taskIndex: number, currentCompleted: boolean) => {
    if (!plan) return;

    try {
      await updateProgress.mutateAsync({
        planId: plan.id,
        taskDay: day,
        taskIndex,
        completed: !currentCompleted,
        courseId,
      });
      // Refetch to get updated progress
      await refetch();
    } catch (error: any) {
      console.error('[StudyPlanView] Failed to update task:', error);
      // Show error to user
      alert(`Failed to update task: ${error?.message || 'Please try again.'}`);
    }
  };

  const handleArchive = async () => {
    if (!plan) return;
    if (!confirm('Are you sure you want to archive this study plan? You can view archived plans later.')) return;

    try {
      await archivePlan.mutateAsync({
        planId: plan.id,
        courseId,
      });
      // Refetch to update the plan status
      await refetch();
    } catch (error: any) {
      console.error('[StudyPlanView] Failed to archive plan:', error);
      alert(`Failed to archive plan: ${error?.message || 'Please try again.'}`);
    }
  };

  const handleTaskClick = (task: any) => {
    if (task.type === 'rest') return;
    if (!courseId) {
      console.error('[StudyPlanView] Cannot navigate: courseId is missing');
      return;
    }

    try {
      // Navigate to appropriate route based on task type
      if (task.topic_id) {
        if (task.type === 'practice' || task.type === 'quiz') {
          navigate(`/course/${courseId}/practice?topic=${task.topic_id}`);
        } else if (task.type === 'read' || task.type === 'review') {
          navigate(`/course/${courseId}/compression?topic=${task.topic_id}`);
        }
      } else {
        // Global task - navigate to general practice or compression
        if (task.type === 'practice' || task.type === 'quiz') {
          navigate(`/course/${courseId}/practice`);
        } else if (task.type === 'read' || task.type === 'review') {
          navigate(`/course/${courseId}/compression`);
        }
      }
    } catch (error) {
      console.error('[StudyPlanView] Navigation error:', error);
      alert('Failed to navigate to task. Please try again.');
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading study plan..." />;
  }

  // Gate by finals flow state
  if (flowStep === 'NEED_EXAM_DATE') {
    return (
      <div className="w-full max-w-xl mx-auto">
        <EmptyStateCtaCard
          title="Set Your Final Exam Date"
          description="Choose your exam date on the Finals Pack card to unlock your personalized study plan."
          ctaLabel="Go to Finals Pack"
          onClick={() => {
            // Reuse the FinalsSection helper via dynamic import to avoid circular deps
            import('./FinalsSection').then((mod) => {
              if (typeof mod.scrollToFinalsPackDatePicker === 'function') {
                mod.scrollToFinalsPackDatePicker();
              }
            });
          }}
        />
      </div>
    );
  }

  if (flowStep === 'NEED_DIAGNOSTIC') {
    return (
      <div className="w-full max-w-xl mx-auto">
        <DiagnosticCard courseId={courseId} hasExamDate />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="w-full p-8 text-center">
        <AlertCircle className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[#111827] mb-2">No Active Study Plan</h3>
        <p className="text-sm text-[#6B7280] mb-2">
          Your diagnostic is complete and you&apos;re ready for a personalized plan.
        </p>
        <p className="text-xs text-[#9CA3AF]">
          If a plan doesn&apos;t appear shortly, try regenerating it from the Finals Command Center.
        </p>
      </div>
    );
  }

  const planContent = plan.plan_content || [];
  const totalTasks = planContent.reduce(
    (sum, day) => sum + (day.tasks?.length || 0),
    0
  );
  const completedTasks = planContent.reduce(
    (sum, day) =>
      sum + (day.tasks?.filter((t: any) => t.completed)?.length || 0),
    0
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#4F46E5] to-[#6366F1] rounded-[16px] p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6" />
              <h2 className="text-2xl font-bold">{plan.title}</h2>
            </div>
            {plan.weak_topics && plan.weak_topics.length > 0 && (
              <p className="text-sm text-white/80 mb-3">
                Focusing on: {plan.weak_topics.slice(0, 3).join(', ')}
                {plan.weak_topics.length > 3 && ` +${plan.weak_topics.length - 3} more`}
              </p>
            )}
          </div>
          <button
            onClick={handleArchive}
            className="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            Archive
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/90">Progress</span>
            <span className="font-medium">
              {completedTasks} / {totalTasks} tasks
            </span>
          </div>
          <Progress value={plan.progress_percent} className="h-3 bg-white/20" />
        </div>
      </div>

      {/* Overview */}
      {plan.weak_topics && plan.weak_topics.length > 0 && (
        <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B]/20 rounded-[12px]">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#92400E] mb-1">Study Focus</p>
              <p className="text-sm text-[#78350F]">
                This plan prioritizes your weak topics and ensures prerequisite topics are covered first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Plan */}
      <div className="space-y-4">
        {planContent.map((dayPlan: any) => {
          const dayTasks = dayPlan.tasks || [];
          const dayCompleted = dayTasks.filter((t: any) => t.completed).length;
          const isExpanded = expandedDays.has(dayPlan.day);

          return (
            <div
              key={dayPlan.day}
              className="border border-[#E5E7EB] rounded-[14px] overflow-hidden bg-white"
            >
              {/* Day Header */}
              <button
                onClick={() => toggleDay(dayPlan.day)}
                className="w-full p-5 bg-[#FAFAFA] hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-[10px] bg-[#4F46E5] text-white flex items-center justify-center font-semibold">
                    {dayPlan.day}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-1">
                      <Calendar className="w-4 h-4 text-[#6B7280]" />
                      <span className="font-medium text-[#111827]">
                        Day {dayPlan.day} • {dayPlan.date || 'Not set'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dayPlan.estimated_minutes || 0} min
                      </span>
                      <span>
                        {dayCompleted} / {dayTasks.length} tasks
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-[#6B7280] transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* Day Tasks */}
              {isExpanded && (
                <div className="p-5 space-y-3 border-t border-[#E5E7EB]">
                  {dayTasks.length === 0 ? (
                    <p className="text-sm text-[#6B7280] text-center py-4">
                      No tasks scheduled for this day.
                    </p>
                  ) : (
                    dayTasks.map((task: any, taskIdx: number) => {
                      const TaskIcon = TASK_TYPE_ICONS[task.type as keyof typeof TASK_TYPE_ICONS] || BookOpen;
                      const taskColors = TASK_TYPE_COLORS[task.type as keyof typeof TASK_TYPE_COLORS] || TASK_TYPE_COLORS.read;
                      const isCompleted = task.completed || false;

                      return (
                        <div
                          key={taskIdx}
                          className={`p-4 rounded-[12px] border transition-all ${
                            isCompleted
                              ? 'bg-[#F9FAFB] border-[#D1D5DB] opacity-75'
                              : `${taskColors.bg} ${taskColors.border}`
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleTaskToggle(dayPlan.day, taskIdx, isCompleted)}
                              className="mt-0.5 flex-shrink-0"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                              ) : (
                                <Circle className="w-5 h-5 text-[#9CA3AF]" />
                              )}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className={`w-8 h-8 rounded-[8px] flex items-center justify-center ${taskColors.bg}`}
                                >
                                  <TaskIcon className={`w-4 h-4 ${taskColors.text}`} />
                                </div>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[3]}`}>
                                  Priority {task.priority}
                                </span>
                                {task.topic_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {task.topic_name}
                                  </Badge>
                                )}
                                <span className="text-xs text-[#6B7280] ml-auto">
                                  {task.duration_minutes} min
                                </span>
                              </div>
                              <p
                                className={`text-sm mb-2 ${
                                  isCompleted ? 'text-[#6B7280] line-through' : 'text-[#111827]'
                                }`}
                              >
                                {task.description}
                              </p>
                              {!isCompleted && task.type !== 'rest' && (
                                <button
                                  onClick={() => handleTaskClick(task)}
                                  className="text-xs text-[#4F46E5] hover:text-[#4338CA] font-medium"
                                >
                                  Start →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tips */}
      {planContent.length > 0 && (
        <div className="p-5 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-[12px]">
          <h3 className="text-sm font-medium text-[#111827] mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4F46E5]" />
            Study Tips
          </h3>
          <ul className="space-y-2">
            {[
              'Focus on understanding concepts, not just memorizing',
              'Review previous days\' material regularly',
              'Take breaks between study sessions',
              'Practice problems actively rather than just reading',
            ].map((tip, idx) => (
              <li key={idx} className="text-sm text-[#6B7280] flex items-start gap-2">
                <span className="text-[#4F46E5] mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

