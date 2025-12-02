"use client";

/**
 * Study Plan Generator Component
 * 
 * Modal/form to generate a new personalized study plan.
 * Validates prerequisites and triggers the backend generation task.
 */

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Target,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { useTriggerStudyPlan } from '@/hooks/useFinals';
import { useStudyPlanPrerequisites, useJobStatusPolling } from '@/hooks/useJobStatus';
import { JobStatusIndicator } from '@/components/shared/JobStatusIndicator';
import { useAuth } from '@/components/auth/AuthProvider';

interface StudyPlanGeneratorProps {
  courseId: string;
  courseCode: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function StudyPlanGenerator({
  courseId,
  courseCode,
  onClose,
  onComplete,
}: StudyPlanGeneratorProps) {
  const { user } = useAuth();
  const [targetDate, setTargetDate] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [focusWeakTopics, setFocusWeakTopics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTriggered, setJobTriggered] = useState(false);

  const triggerStudyPlan = useTriggerStudyPlan();
  const { data: prerequisites, isLoading: prerequisitesLoading } =
    useStudyPlanPrerequisites(user?.id || '', courseId);

  // Job status polling
  const { data: jobStatus } = useJobStatusPolling(
    'study_plan',
    courseId,
    user?.id || null,
    { enabled: jobTriggered }
  );

  // Calculate default target date (14 days from now)
  React.useEffect(() => {
    if (!targetDate) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      setTargetDate(defaultDate.toISOString().split('T')[0]);
    }
  }, [targetDate]);

  // Handle job completion
  React.useEffect(() => {
    if (!jobTriggered) return;
    
    if (jobStatus?.status === 'completed') {
      setJobTriggered(false);
      setError(null);
      if (onComplete) {
        onComplete();
      }
      // Close modal after a brief delay to show success
      setTimeout(() => {
        onClose();
      }, 500);
    } else if (jobStatus?.status === 'failed') {
      setJobTriggered(false);
      setError(jobStatus.error_message || 'Failed to generate study plan. Please try again.');
    }
  }, [jobStatus?.status, jobStatus?.error_message, jobTriggered]);

  const handleGenerate = async () => {
    setError(null);

    if (!user?.id) {
      setError('You must be logged in to generate a study plan.');
      return;
    }

    // Check prerequisites
    if (!prerequisites?.can_generate) {
      const missingItems = prerequisites?.missing_items || [];
      let errorMsg = 'Cannot generate study plan. ';
      if (missingItems.includes('topics')) {
        errorMsg += 'Please add topics to the course first before generating a study plan.';
      } else if (missingItems.length > 0) {
        errorMsg += `Missing: ${missingItems.join(', ')}.`;
      } else {
        errorMsg += 'Prerequisites not met. Please check course setup.';
      }
      setError(errorMsg);
      return;
    }

    if (!targetDate) {
      setError('Please select a target date.');
      return;
    }

    try {
      await triggerStudyPlan.mutateAsync({
        courseId,
        options: {
          targetDate,
          dailyMinutes,
          focusWeakTopics,
        },
      });
      setJobTriggered(true);
    } catch (err: any) {
      console.error('Failed to trigger study plan generation:', err);
      setError(err?.message || 'Failed to generate study plan. Please try again.');
    }
  };

  const daysUntilTarget = targetDate
    ? Math.ceil(
        (new Date(targetDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 14;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[16px] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#4F46E5] text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">
                Generate Study Plan
              </h2>
              <p className="text-sm text-[#6B7280]">{courseCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prerequisites Warning */}
          {prerequisites && !prerequisites.can_generate && (
            <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B]/20 rounded-[12px]">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#92400E] mb-1">
                    Prerequisites Not Met
                  </p>
                  <p className="text-sm text-[#78350F]">
                    {prerequisites.missing_items?.includes('topics')
                      ? 'Please add topics to the course first before generating a study plan.'
                      : `Missing: ${prerequisites.missing_items?.join(', ')}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Job Status Indicator */}
          {jobTriggered && (
            <JobStatusIndicator
              jobType="study_plan"
              courseId={courseId}
              userId={user?.id || null}
              enabled={jobTriggered}
              onComplete={() => {
                setJobTriggered(false);
                if (onComplete) onComplete();
                onClose();
              }}
              onError={(status) => {
                setJobTriggered(false);
                setError(status.error_message || 'Generation failed');
              }}
            />
          )}

          {/* Error Message */}
          {error && !jobTriggered && (
            <div className="p-4 bg-[#FEE2E2] border border-[#EF4444]/20 rounded-[12px]">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#991B1B] mb-1">Error</p>
                  <p className="text-sm text-[#DC2626]">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {!jobTriggered && (
            <div className="space-y-6">
              {/* Target Date */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#111827] mb-2">
                  <Calendar className="w-4 h-4 text-[#6B7280]" />
                  Target Date (Final Exam Date)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                />
                {targetDate && (
                  <p className="mt-2 text-sm text-[#6B7280]">
                    {daysUntilTarget > 0
                      ? `${daysUntilTarget} days until target date`
                      : 'Please select a future date'}
                  </p>
                )}
              </div>

              {/* Daily Minutes */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#111827] mb-2">
                  <Clock className="w-4 h-4 text-[#6B7280]" />
                  Daily Study Time
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="15"
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-[#111827] min-w-[80px]">
                    {dailyMinutes} min
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Total estimated time: ~{Math.round((dailyMinutes * daysUntilTarget) / 60)} hours
                </p>
              </div>

              {/* Focus Weak Topics */}
              <div className="flex items-start gap-3 p-4 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-[12px]">
                <input
                  type="checkbox"
                  id="focusWeakTopics"
                  checked={focusWeakTopics}
                  onChange={(e) => setFocusWeakTopics(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5]"
                />
                <label
                  htmlFor="focusWeakTopics"
                  className="flex-1 text-sm text-[#111827] cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-[#4F46E5]" />
                    <span className="font-medium">Focus on Weak Topics</span>
                  </div>
                  <p className="text-[#6B7280]">
                    Prioritize topics where you need the most improvement based on your mastery data.
                  </p>
                </label>
              </div>

              {/* Preview Info */}
              <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px]">
                <p className="text-sm text-[#6B7280]">
                  Your study plan will include:{' '}
                  <span className="font-medium text-[#111827]">
                    {Math.max(1, Math.min(14, daysUntilTarget))} days
                  </span>{' '}
                  of structured study tasks, scheduled{' '}
                  <span className="font-medium text-[#111827]">{dailyMinutes} minutes</span> per day.
                  Tasks will respect prerequisite ordering and include spaced repetition reviews.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#E5E7EB]">
            <button
              onClick={onClose}
              disabled={jobTriggered}
              className="flex-1 px-4 py-2.5 border border-[#D1D5DB] text-[#111827] rounded-lg hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={
                jobTriggered ||
                triggerStudyPlan.isPending ||
                !targetDate ||
                daysUntilTarget <= 0 ||
                (prerequisites && !prerequisites.can_generate) ||
                prerequisitesLoading
              }
              className="flex-1 px-4 py-2.5 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {triggerStudyPlan.isPending || jobTriggered ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

