import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJobStatus, checkFinalPacksPrerequisites, checkStudyPlanPrerequisites } from '../lib/api';

export type JobType = 'final_packs' | 'study_plan' | 'knowledge_graph';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobStatusData {
  id: string;
  job_type: JobType;
  course_id: string;
  user_id: string | null;
  trigger_job_id: string | null;
  status: JobStatus;
  progress_percent: number;
  metadata: Record<string, any>;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface PrerequisitesResult {
  can_generate: boolean;
  missing_items: string[];
  [key: string]: any;
}

/**
 * Fetch latest job status for a specific job type (no polling)
 */
export function useLatestJobStatus(
  jobType: JobType,
  courseId: string,
  userId?: string | null
) {
  return useQuery({
    queryKey: ['jobStatus', jobType, courseId, userId],
    queryFn: () => fetchJobStatus(jobType, courseId, userId),
    staleTime: 5000, // Consider data fresh for 5 seconds
    enabled: !!courseId,
  });
}

/**
 * Poll job status with exponential backoff
 * Stops polling when status is 'completed' or 'failed'
 */
export function useJobStatusPolling(
  jobType: JobType,
  courseId: string,
  userId?: string | null,
  options?: {
    enabled?: boolean;
    maxPollingDuration?: number; // in milliseconds, default 30 minutes
  }
) {
  const { enabled = true, maxPollingDuration = 30 * 60 * 1000 } = options || {};
  const startTime = Date.now();

  return useQuery({
    queryKey: ['jobStatus', jobType, courseId, userId, 'polling'],
    queryFn: async () => {
      const status = await fetchJobStatus(jobType, courseId, userId);
      
      // Stop polling if job is done or max duration exceeded
      if (status?.status === 'completed' || status?.status === 'failed') {
        return status;
      }
      
      if (Date.now() - startTime > maxPollingDuration) {
        // Return timeout status but don't throw error
        return status;
      }
      
      return status;
    },
    enabled: enabled && !!courseId,
    refetchInterval: (query) => {
      const data = query.state.data as JobStatusData | null;
      
      // Stop polling if completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
      const attemptCount = query.state.fetchFailureCount || 0;
      const intervals = [1000, 2000, 4000, 8000, 10000];
      const interval = intervals[Math.min(attemptCount, intervals.length - 1)];
      
      // Check max duration
      if (Date.now() - startTime > maxPollingDuration) {
        return false;
      }
      
      return interval;
    },
    refetchIntervalInBackground: false,
    staleTime: 0, // Always consider stale for polling
  });
}

/**
 * Hook to check final packs prerequisites
 */
export function useFinalPacksPrerequisites(courseId: string) {
  return useQuery({
    queryKey: ['finalPacksPrerequisites', courseId],
    queryFn: () => checkFinalPacksPrerequisites(courseId),
    enabled: !!courseId,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Hook to check study plan prerequisites
 */
export function useStudyPlanPrerequisites(userId: string, courseId: string) {
  return useQuery({
    queryKey: ['studyPlanPrerequisites', userId, courseId],
    queryFn: () => checkStudyPlanPrerequisites(userId, courseId),
    enabled: !!userId && !!courseId,
    staleTime: 60000, // Cache for 1 minute
  });
}

