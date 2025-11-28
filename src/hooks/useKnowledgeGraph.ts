/**
 * useKnowledgeGraph Hook
 * Fetches and manages course knowledge graph (topic relationships)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  fetchCourseGraph, 
  fetchConcepts, 
  fetchFormulas, 
  fetchConceptRelationships,
  triggerKnowledgeGraphGeneration 
} from '@/lib/api'

// Query keys
export const knowledgeGraphKeys = {
  all: ['knowledge-graph'] as const,
  graph: (courseId: string) => [...knowledgeGraphKeys.all, 'graph', courseId] as const,
  concepts: (courseId: string, topicId?: string) => 
    [...knowledgeGraphKeys.all, 'concepts', courseId, topicId] as const,
  formulas: (courseId: string, topicId?: string) => 
    [...knowledgeGraphKeys.all, 'formulas', courseId, topicId] as const,
  relationships: (courseId: string) => 
    [...knowledgeGraphKeys.all, 'relationships', courseId] as const,
}

/**
 * Hook to fetch course topic relationships (graph edges)
 */
export function useCourseGraph(courseId: string) {
  return useQuery({
    queryKey: knowledgeGraphKeys.graph(courseId),
    queryFn: () => fetchCourseGraph(courseId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch concepts for a course or topic
 */
export function useConcepts(courseId: string, topicId?: string) {
  return useQuery({
    queryKey: knowledgeGraphKeys.concepts(courseId, topicId),
    queryFn: () => fetchConcepts(courseId, topicId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to fetch formulas for a course or topic
 */
export function useFormulas(courseId: string, topicId?: string) {
  return useQuery({
    queryKey: knowledgeGraphKeys.formulas(courseId, topicId),
    queryFn: () => fetchFormulas(courseId, topicId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to fetch concept relationships
 */
export function useConceptRelationships(courseId: string) {
  return useQuery({
    queryKey: knowledgeGraphKeys.relationships(courseId),
    queryFn: () => fetchConceptRelationships(courseId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to trigger knowledge graph generation
 */
export function useTriggerKnowledgeGraph() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (courseId: string) => triggerKnowledgeGraphGeneration(courseId),
    onSuccess: (_, courseId) => {
      // Invalidate graph queries after triggering generation
      queryClient.invalidateQueries({ 
        queryKey: knowledgeGraphKeys.graph(courseId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: knowledgeGraphKeys.concepts(courseId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: knowledgeGraphKeys.relationships(courseId) 
      })
    },
  })
}

// Re-export types
export type CourseGraphEdge = Awaited<ReturnType<typeof fetchCourseGraph>>[number]
export type Concept = Awaited<ReturnType<typeof fetchConcepts>>[number]
export type Formula = Awaited<ReturnType<typeof fetchFormulas>>[number]


