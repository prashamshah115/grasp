/**
 * Finals Hooks
 * React Query hooks for Finals Command Center and related features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  triggerFinalPackGeneration,
  triggerPersonalizedStudyPackGeneration,
  fetchStudyPlan,
  fetchStudyPlans,
  triggerStudyPlanGeneration,
  updateStudyPlanProgress,
  archiveStudyPlan,
} from '@/lib/api';

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
        // Handle 404 (RPC function doesn't exist) gracefully
        const is404 = error.code === 'PGRST301' || error.code === 'PGRST116' || (error as any).status === 404 || (error as any).code === '42883';
        if (is404) {
          console.debug('Finals dashboard RPC not available, returning empty data');
          return [];
        }
        // For other errors, log but don't throw - return empty array
        console.warn('Error fetching finals dashboard (non-critical):', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry on 404
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
        .maybeSingle(); // Use maybeSingle instead of single to handle 406 gracefully

      // Handle missing table (406) or not found (PGRST116) gracefully
      // PGRST116 = not found, 406 = table doesn't exist or RLS issue
      if (error) {
        const isNotFound = error.code === 'PGRST116';
        const isTableMissing = (error as any).status === 406 || error.message?.includes('406');
        
        if (!isNotFound && !isTableMissing) {
          console.error('Error fetching final preferences:', error);
          throw error;
        }
        // Return null for missing table or not found - this is expected
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

      // Handle missing table gracefully (406 error)
      if (error) {
        const isTableMissing = (error as any).status === 406 || error.message?.includes('406') || error.code === 'PGRST301';
        if (isTableMissing) {
          console.warn('user_final_preferences table does not exist. Preferences will not be saved.');
          // Return a mock response so the UI doesn't break
          return {
            id: 'temp',
            user_id: user.id,
            course_id: params.courseId,
            final_exam_date: params.finalExamDate,
            final_exam_weight: params.finalExamWeight ?? 0.3,
            daily_study_minutes: params.dailyStudyMinutes ?? 60,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as UserFinalPreferences;
        }
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
 * Prioritizes personalized packs, falls back to course-level packs
 */
export function useFinalPacks(courseId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['final-packs', courseId, user?.id],
    queryFn: async (): Promise<FinalPack[]> => {
      if (!courseId) return [];

      // First, try to get personalized packs for this user
      if (user?.id) {
        const { data: personalizedPacks, error: personalizedError } = await supabase
          .from('final_packs')
          .select('*')
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .eq('is_personalized', true)
          .order('tier');

        if (!personalizedError && personalizedPacks && personalizedPacks.length > 0) {
          console.log(`[useFinalPacks] Found ${personalizedPacks.length} personalized packs`);
          return personalizedPacks;
        }
      }

      // Fallback to course-level packs
      const { data, error } = await supabase
        .from('final_packs')
        .select('*')
        .eq('course_id', courseId)
        .is('user_id', null) // Course-level packs have null user_id
        .order('tier');

      if (error) {
        // Treat missing table / RLS / not configured as "no packs yet"
        const isTableOrRlsIssue =
          (error as any).status === 406 ||
          error.code === 'PGRST301' ||
          error.code === 'PGRST116' ||
          error.message?.includes('final_packs') ||
          error.message?.includes('permission denied');

        if (isTableOrRlsIssue) {
          console.warn('Final packs table not available or blocked by RLS. Returning empty packs.', error);
          return [];
        }

        // For unexpected errors, log and rethrow so React Query can surface `error`
        console.error('Unexpected error fetching final packs:', error);
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
 * Trigger final pack generation via Trigger.dev
 */
export function useTriggerFinalPacks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: string) => triggerFinalPackGeneration(courseId),
    onSuccess: (_, courseId) => {
      // Invalidate final packs queries after triggering generation
      queryClient.invalidateQueries({ queryKey: ['final-packs', courseId] });
      queryClient.invalidateQueries({ queryKey: ['final-pack', courseId] });
    },
  });
}

/**
 * Trigger personalized study pack generation via Trigger.dev
 */
export function useTriggerPersonalizedStudyPack() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (courseId: string) => triggerPersonalizedStudyPackGeneration(courseId),
    onSuccess: (_, courseId) => {
      // Invalidate final packs queries after triggering generation
      queryClient.invalidateQueries({ queryKey: ['final-packs', courseId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['final-pack', courseId] });
    },
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

// ==================== STUDY PLANS ====================

export interface StudyPlan {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  target_date: string;
  daily_minutes: number;
  plan_content: Array<{
    day: number;
    date: string;
    focus_topics: string[];
    tasks: Array<{
      type: 'read' | 'practice' | 'review' | 'quiz' | 'rest';
      description: string;
      duration_minutes: number;
      topic_id: string | null;
      topic_name: string;
      priority: 1 | 2 | 3;
      completed?: boolean;
    }>;
    estimated_minutes: number;
  }>;
  weak_topics: string[];
  priority_order: string[];
  model_used: string;
  generated_at: string;
  status: 'active' | 'archived';
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch active study plan for a course
 */
export function useStudyPlan(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['study-plan', user?.id, courseId],
    queryFn: async (): Promise<StudyPlan | null> => {
      if (!user?.id || !courseId) return null;
      return await fetchStudyPlan(courseId, user.id);
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch all study plans (including archived)
 */
export function useStudyPlans(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['study-plans', user?.id, courseId],
    queryFn: async (): Promise<StudyPlan[]> => {
      if (!user?.id || !courseId) return [];
      return await fetchStudyPlans(courseId, user.id);
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 5,
  });
}

// ==================== DIAGNOSTIC & FINALS FLOW ====================

export type FinalsFlowStep = 'NEED_EXAM_DATE' | 'NEED_DIAGNOSTIC' | 'READY';

interface DiagnosticStatusResult {
  hasCompletedDiagnostic: boolean;
  score: number | null;
  completedAt: string | null;
}

/**
 * Fetch diagnostic completion status for a user and course.
 */
export function useDiagnosticStatus(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['diagnostic-status', user?.id, courseId],
    queryFn: async (): Promise<DiagnosticStatusResult> => {
      if (!user?.id || !courseId) {
        return {
          hasCompletedDiagnostic: false,
          score: null,
          completedAt: null,
        };
      }

      const { data, error } = await supabase
        .from('diagnostic_status')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (error) {
        // Treat missing table / function / RLS issues as \"no diagnostic yet\"
        const isTableOrRlsIssue =
          (error as any).status === 406 ||
          error.code === 'PGRST301' ||
          error.code === 'PGRST116' ||
          error.message?.includes('diagnostic_status') ||
          error.message?.includes('permission denied');

        if (!isTableOrRlsIssue) {
          console.warn('Error fetching diagnostic_status (non-fatal):', error);
        }

        return {
          hasCompletedDiagnostic: false,
          score: null,
          completedAt: null,
        };
      }

      return {
        hasCompletedDiagnostic: !!data?.completed,
        score: data?.score ?? null,
        completedAt: data?.completed_at ?? null,
      };
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Centralized finals flow state: decides whether we need
 * an exam date, a diagnostic, or are ready to show the study plan.
 */
export function useFinalsFlow(courseId: string | undefined) {
  const { data: preferences } = useUserFinalPreferences(courseId);
  const { data: diagnosticStatus } = useDiagnosticStatus(courseId);
  const { data: studyPlan } = useStudyPlan(courseId);

  const hasExamDate = !!preferences?.final_exam_date;
  const hasCompletedDiagnostic = !!diagnosticStatus?.hasCompletedDiagnostic;
  const hasStudyPlan = !!studyPlan;

  let flowStep: FinalsFlowStep = 'READY';

  if (!hasExamDate) {
    flowStep = 'NEED_EXAM_DATE';
  } else if (!hasCompletedDiagnostic) {
    flowStep = 'NEED_DIAGNOSTIC';
  } else {
    flowStep = 'READY';
  }

  return {
    hasExamDate,
    hasCompletedDiagnostic,
    hasStudyPlan,
    flowStep,
  };
}

/**
 * Trigger study plan generation
 */
export function useTriggerStudyPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      options?: {
        targetDate?: string;
        dailyMinutes?: number;
        focusWeakTopics?: boolean;
      };
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      return await triggerStudyPlanGeneration(
        params.courseId,
        user.id,
        params.options
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate study plan queries
      queryClient.invalidateQueries({
        queryKey: ['study-plan', user?.id, variables.courseId],
      });
      queryClient.invalidateQueries({
        queryKey: ['study-plans', user?.id, variables.courseId],
      });
    },
  });
}

/**
 * Update study plan progress (mark tasks as complete)
 */
export function useUpdateStudyPlanProgress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      planId: string;
      taskDay: number;
      taskIndex: number;
      completed: boolean;
      courseId: string;
    }) => {
      return await updateStudyPlanProgress(
        params.planId,
        params.taskDay,
        params.taskIndex,
        params.completed
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate study plan queries
      queryClient.invalidateQueries({
        queryKey: ['study-plan', user?.id, variables.courseId],
      });
      queryClient.invalidateQueries({
        queryKey: ['study-plans', user?.id, variables.courseId],
      });
    },
  });
}

/**
 * Archive a study plan
 */
export function useArchiveStudyPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { planId: string; courseId: string }) => {
      return await archiveStudyPlan(params.planId);
    },
    onSuccess: (_, variables) => {
      // Invalidate study plan queries
      queryClient.invalidateQueries({
        queryKey: ['study-plan', user?.id, variables.courseId],
      });
      queryClient.invalidateQueries({
        queryKey: ['study-plans', user?.id, variables.courseId],
      });
    },
  });
}

