/**
 * Knowledge State Vector (KSV) Hooks
 * 
 * Provides hooks for accessing and managing the adaptive finals preparation engine.
 * KSV powers personalized recommendations based on mastery, graph structure, and behavior.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  fetchKnowledgeStateVector,
  fetchRecommendedTopics,
  calculatePredictionScore,
  triggerKSVUpdate,
} from '@/lib/api';

// Types
export interface KnowledgeStateVector {
  user_id: string;
  course_id: string;
  topic_id: string;
  knowledge_strength: number;
  mastery_score: number;
  error_rate: number;
  time_spent_sec: number;
  coverage: number;
  graph_in_degree: number;
  graph_out_degree: number;
  last_reviewed_at: string | null;
  last_attempt_at: string | null;
  engagement_score: number;
  recommendation_score: number;
  priority_rank: number | null;
  updated_at: string;
  created_at: string;
  // Joined topic data
  topic_name?: string;
  topic_slug?: string;
}

export interface RecommendedTopic {
  topic_id: string;
  topic_name: string;
  recommendation_score: number;
  priority_rank: number;
  justification: string;
  knowledge_strength: number;
  weakness_score: number;
  importance_score: number;
}

export interface PredictionScore {
  predicted_score: number;
  confidence: number;
  improvement_potential: number;
  fixable_topics: Array<{
    topic_id: string;
    topic_name: string;
    potential_gain: number;
    current_strength: number;
  }>;
}

/**
 * Fetch all KSV for a course, ranked by recommendation_score
 */
export function useKnowledgeState(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['knowledge-state', user?.id, courseId],
    queryFn: async (): Promise<KnowledgeStateVector[]> => {
      if (!user?.id || !courseId) return [];

      return await fetchKnowledgeStateVector(courseId, user.id);
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Get KSV for a single topic
 */
export function useTopicKnowledgeState(
  courseId: string | undefined,
  topicId: string | undefined
) {
  const { user } = useAuth();
  const { data: allKsv } = useKnowledgeState(courseId);

  return useQuery({
    queryKey: ['knowledge-state', user?.id, courseId, topicId],
    queryFn: async (): Promise<KnowledgeStateVector | null> => {
      if (!topicId || !allKsv) return null;

      return allKsv.find((ksv) => ksv.topic_id === topicId) || null;
    },
    enabled: !!user?.id && !!courseId && !!topicId && !!allKsv,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get top N recommended topics based on recommendation_score
 */
export function useRecommendedTopics(
  courseId: string | undefined,
  limit: number = 3
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recommended-topics', user?.id, courseId, limit],
    queryFn: async (): Promise<RecommendedTopic[]> => {
      if (!user?.id || !courseId) return [];

      return await fetchRecommendedTopics(courseId, user.id, limit);
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 2, // 2 minutes - recommendations should be fresh
    refetchOnWindowFocus: true,
  });
}

/**
 * Compute predicted final exam score
 */
export function usePredictionScore(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['prediction-score', user?.id, courseId],
    queryFn: async (): Promise<PredictionScore | null> => {
      if (!user?.id || !courseId) return null;

      return await calculatePredictionScore(courseId, user.id);
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
}

/**
 * Trigger KSV recalculation for a course
 */
export function useTriggerKSVUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      return await triggerKSVUpdate(courseId, user.id);
    },
    onSuccess: (_, courseId) => {
      // Invalidate all KSV-related queries
      queryClient.invalidateQueries({
        queryKey: ['knowledge-state', user?.id, courseId],
      });
      queryClient.invalidateQueries({
        queryKey: ['recommended-topics', user?.id, courseId],
      });
      queryClient.invalidateQueries({
        queryKey: ['prediction-score', user?.id, courseId],
      });
    },
  });
}

