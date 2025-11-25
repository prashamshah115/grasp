/**
 * Finals Hooks
 * React Query hooks for Finals Command Center and related features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

// Types
export interface FinalsDashboardData {
  course_id: string;
  course_code: string;
  course_name: string;
  final_exam_date: string | null;
  final_exam_weight: number;
  days_until_final: number | null;
  mastery_percentage: number;
  weak_topic_count: number;
  total_topic_count: number;
}

export interface UserFinalPreferences {
  id: string;
  user_id: string;
  course_id: string;
  final_exam_date: string | null;
  final_exam_weight: number;
  daily_study_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface FinalPack {
  id: string;
  course_id: string;
  tier: 'essentials' | 'must_solve' | 'drills';
  content: Record<string, unknown>;
  generated_at: string;
  updated_at: string;
}

export interface TaskHistoryEntry {
  id: string;
  user_id: string;
  course_id: string;
  task_type: string;
  topic_id: string | null;
  duration_minutes: number;
  completed_at: string;
}

/**
 * Fetch finals dashboard data for a user
 * Uses the get_finals_dashboard database function
 */
export function useFinalsDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['finals-dashboard', user?.id],
    queryFn: async (): Promise<FinalsDashboardData[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .rpc('get_finals_dashboard', { target_user_id: user.id });

      if (error) {
        console.error('Error fetching finals dashboard:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch user's final preferences for a specific course
 */
export function useUserFinalPreferences(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['final-preferences', user?.id, courseId],
    queryFn: async (): Promise<UserFinalPreferences | null> => {
      if (!user?.id || !courseId) return null;

      const { data, error } = await supabase
        .from('user_final_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching final preferences:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id && !!courseId,
  });
}

/**
 * Update or create user final preferences
 */
export function useUpdateFinalPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      finalExamDate?: string | null;
      finalExamWeight?: number;
      dailyStudyMinutes?: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_final_preferences')
        .upsert({
          user_id: user.id,
          course_id: params.courseId,
          final_exam_date: params.finalExamDate,
          final_exam_weight: params.finalExamWeight ?? 0.3,
          daily_study_minutes: params.dailyStudyMinutes ?? 60,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,course_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating final preferences:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['final-preferences', user?.id, variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ['finals-dashboard', user?.id] });
    },
  });
}

/**
 * Fetch final packs for a course
 */
export function useFinalPacks(courseId: string | undefined) {
  return useQuery({
    queryKey: ['final-packs', courseId],
    queryFn: async (): Promise<FinalPack[]> => {
      if (!courseId) return [];

      const { data, error } = await supabase
        .from('final_packs')
        .select('*')
        .eq('course_id', courseId)
        .order('tier');

      if (error) {
        console.error('Error fetching final packs:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 30, // 30 minutes (precomputed data)
  });
}

/**
 * Fetch a specific final pack tier
 */
export function useFinalPack(courseId: string | undefined, tier: 'essentials' | 'must_solve' | 'drills') {
  return useQuery({
    queryKey: ['final-pack', courseId, tier],
    queryFn: async (): Promise<FinalPack | null> => {
      if (!courseId) return null;

      const { data, error } = await supabase
        .from('final_packs')
        .select('*')
        .eq('course_id', courseId)
        .eq('tier', tier)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching final pack:', error);
        throw error;
      }

      return data;
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Fetch recent task history for task compression
 */
export function useRecentTasks(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-tasks', user?.id, courseId],
    queryFn: async (): Promise<TaskHistoryEntry[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('user_task_history')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (courseId) {
        query = query.eq('course_id', courseId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recent tasks:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Record a completed task
 */
export function useRecordTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      taskType: string;
      topicId?: string | null;
      durationMinutes: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_task_history')
        .insert({
          user_id: user.id,
          course_id: params.courseId,
          task_type: params.taskType,
          topic_id: params.topicId || null,
          duration_minutes: params.durationMinutes,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording task:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recent-tasks', user?.id, variables.courseId] });
    },
  });
}

/**
 * Fetch weak topics for a course (for task compression)
 */
export function useWeakTopics(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weak-topics', user?.id, courseId],
    queryFn: async () => {
      if (!user?.id || !courseId) return [];

      // Get all topics for the course
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('id, name')
        .eq('course_id', courseId);

      if (topicsError) throw topicsError;

      const topicIds = topics?.map(t => t.id) || [];
      if (topicIds.length === 0) return [];

      // Get mastery for these topics
      const { data: mastery, error: masteryError } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', user.id)
        .in('topic_id', topicIds);

      if (masteryError) throw masteryError;

      // Combine topics with mastery data
      return topics?.map(topic => {
        const m = mastery?.find(m => m.topic_id === topic.id);
        return {
          topic_id: topic.id,
          topic_name: topic.name,
          mastery_level: m?.mastery_level || null,
          num_attempts: m?.num_attempts || 0,
          num_correct: m?.num_correct || 0,
          last_practiced_at: m?.last_practiced_at || null,
        };
      }) || [];
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 5,
  });
}

// Types for Must-Solve Topics
export interface MustSolveTopic {
  id: string;
  topic: string;
  questions: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  priority: 'Critical' | 'High' | 'Medium';
}

export interface MustSolveData {
  importantTopics: MustSolveTopic[];
  totalQuestions: number;
}

/**
 * Fetch must-solve topics for finals preparation
 * Combines topics with question counts and mastery-based priority
 */
export function useMustSolveTopics(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['must-solve-topics', user?.id, courseId],
    queryFn: async (): Promise<MustSolveData> => {
      if (!courseId) return { importantTopics: [], totalQuestions: 0 };

      // Get all topics for the course with order
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('id, name, order_index')
        .eq('course_id', courseId)
        .order('order_index');

      if (topicsError) throw topicsError;
      if (!topics || topics.length === 0) return { importantTopics: [], totalQuestions: 0 };

      const topicIds = topics.map(t => t.id);

      // Get question counts per topic
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id, topic_id, difficulty')
        .eq('course_id', courseId)
        .in('topic_id', topicIds);

      if (questionsError) throw questionsError;

      // Get mastery data if user is logged in
      let mastery: Array<{ topic_id: string; mastery_level: string | null }> = [];
      if (user?.id) {
        const { data: masteryData, error: masteryError } = await supabase
          .from('topic_mastery')
          .select('topic_id, mastery_level')
          .eq('user_id', user.id)
          .in('topic_id', topicIds);

        if (masteryError) throw masteryError;
        mastery = masteryData || [];
      }

      // Calculate question counts and avg difficulty per topic
      const questionsByTopic = new Map<string, { count: number; avgDifficulty: number }>();
      
      for (const q of questions || []) {
        const existing = questionsByTopic.get(q.topic_id) || { count: 0, avgDifficulty: 0 };
        existing.count += 1;
        existing.avgDifficulty = (existing.avgDifficulty * (existing.count - 1) + (q.difficulty || 2)) / existing.count;
        questionsByTopic.set(q.topic_id, existing);
      }

      // Build must-solve topics list
      const importantTopics: MustSolveTopic[] = topics
        .map(topic => {
          const m = mastery.find(m => m.topic_id === topic.id);
          const qData = questionsByTopic.get(topic.id) || { count: 0, avgDifficulty: 2 };

          // Calculate priority based on mastery level
          let priority: 'Critical' | 'High' | 'Medium' = 'Medium';
          if (m?.mastery_level === 'weak') {
            priority = 'Critical';
          } else if (m?.mastery_level === 'moderate') {
            priority = 'High';
          }

          // Calculate difficulty label based on avg difficulty
          let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
          if (qData.avgDifficulty >= 2.5) {
            difficulty = 'Hard';
          } else if (qData.avgDifficulty <= 1.5) {
            difficulty = 'Easy';
          }

          return {
            id: topic.id,
            topic: topic.name,
            questions: qData.count,
            difficulty,
            priority,
          };
        })
        .filter(t => t.questions > 0) // Only include topics with questions
        .sort((a, b) => {
          // Sort by priority: Critical > High > Medium
          const priorityOrder = { Critical: 0, High: 1, Medium: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

      const totalQuestions = importantTopics.reduce((sum, t) => sum + t.questions, 0);

      return { importantTopics, totalQuestions };
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 5,
  });
}

