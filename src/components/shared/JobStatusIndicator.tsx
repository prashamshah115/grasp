"use client";

import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useJobStatusPolling, type JobStatus, type JobStatusData } from '@/hooks/useJobStatus';
import { cn } from '@/lib/utils';

interface JobStatusIndicatorProps {
  jobType: 'final_packs' | 'study_plan' | 'knowledge_graph';
  courseId: string;
  userId?: string | null;
  enabled?: boolean;
  onComplete?: (status: JobStatusData) => void;
  onError?: (status: JobStatusData) => void;
  className?: string;
}

export function JobStatusIndicator({
  jobType,
  courseId,
  userId,
  enabled = true,
  onComplete,
  onError,
  className,
}: JobStatusIndicatorProps) {
  const { data: status, isLoading, error } = useJobStatusPolling(
    jobType,
    courseId,
    userId,
    { enabled, maxPollingDuration: 30 * 60 * 1000 } // 30 minutes max
  );

  React.useEffect(() => {
    if (status?.status === 'completed' && onComplete) {
      onComplete(status);
    } else if (status?.status === 'failed' && onError) {
      onError(status);
    }
  }, [status?.status, onComplete, onError, status]);

  if (!enabled || (!status && !isLoading && !error)) {
    return null;
  }

  if (error) {
    return (
      <div className={cn("p-4 bg-[#FEE2E2] border border-[#EF4444]/20 rounded-[12px]", className)}>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#991B1B]">
              Failed to check job status
            </p>
            <p className="text-xs text-[#DC2626] mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !status) {
    return (
      <div className={cn("p-4 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-[12px]", className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#4F46E5] animate-spin flex-shrink-0" />
          <p className="text-sm text-[#6B7280]">Checking job status...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const statusConfig = {
    pending: {
      icon: Loader2,
      color: 'text-[#6B7280]',
      bgColor: 'bg-[#F3F4F6]',
      borderColor: 'border-[#D1D5DB]/20',
      label: 'Queued',
    },
    running: {
      icon: Loader2,
      color: 'text-[#4F46E5]',
      bgColor: 'bg-[#F5F3FF]',
      borderColor: 'border-[#4F46E5]/10',
      label: 'Running',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-[#10B981]',
      bgColor: 'bg-[#D1FAE5]',
      borderColor: 'border-[#10B981]/20',
      label: 'Completed',
    },
    failed: {
      icon: XCircle,
      color: 'text-[#EF4444]',
      bgColor: 'bg-[#FEE2E2]',
      borderColor: 'border-[#EF4444]/20',
      label: 'Failed',
    },
  };

  const config = statusConfig[status.status];
  const Icon = config.icon;
  const isAnimated = status.status === 'pending' || status.status === 'running';

  return (
    <div className={cn(
      "p-4 border rounded-[12px] transition-colors",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="space-y-3">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon
              className={cn(
                "w-5 h-5 flex-shrink-0",
                config.color,
                isAnimated && "animate-spin"
              )}
            />
            <div>
              <p className={cn("text-sm font-medium", config.color)}>
                {config.label}
              </p>
              {status.metadata?.courseCode && (
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {status.metadata.courseCode}
                </p>
              )}
            </div>
          </div>
          {status.status === 'running' && (
            <span className="text-xs text-[#6B7280]">
              {status.progress_percent}%
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {(status.status === 'running' || status.status === 'pending') && (
          <div className="space-y-1">
            <Progress value={status.progress_percent} className="h-2" />
            <p className="text-xs text-[#6B7280]">
              {getStatusMessage(status)}
            </p>
          </div>
        )}

        {/* Error Message */}
        {status.status === 'failed' && status.error_message && (
          <div className="mt-2">
            <p className="text-sm text-[#991B1B] font-medium">Error:</p>
            <p className="text-xs text-[#DC2626] mt-1">
              {status.error_message}
            </p>
          </div>
        )}

        {/* Success Message */}
        {status.status === 'completed' && status.metadata && (
          <div className="mt-2">
            {status.job_type === 'final_packs' && (
              <p className="text-xs text-[#065F46]">
                Generated {status.metadata.essentials || 0} essentials,{' '}
                {status.metadata.mustSolve || 0} must-solve, and{' '}
                {status.metadata.drills || 0} drills.
              </p>
            )}
            {status.job_type === 'study_plan' && (
              <p className="text-xs text-[#065F46]">
                Created {status.metadata.total_days || 0}-day study plan with{' '}
                {status.metadata.total_tasks || 0} tasks.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusMessage(status: JobStatusData): string {
  const stage = status.metadata?.stage;
  if (!stage) {
    return 'Processing...';
  }

  const messages: Record<string, string> = {
    initializing: 'Initializing...',
    fetching_data: 'Fetching course data...',
    fetching_questions: 'Loading questions...',
    web_search: 'Searching web resources...',
    llm_inference: 'Generating content...',
    llm_generation: 'Generating plan...',
    database_update: 'Saving to database...',
    completed: 'Complete!',
  };

  return messages[stage] || 'Processing...';
}

