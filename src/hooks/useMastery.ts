/**
 * React Query Hooks - Mastery Tracking
 *
 * IMPLEMENTATION STATUS:
 * ✅ useTopicMastery - Fetch mastery for single topic
 * ✅ useCourseMastery - Fetch mastery for all topics in course
 * ✅ useUpdateMastery - Update mastery after session (mutation)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchTopicMastery, fetchCourseMastery, updateMastery } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import type { UpdateMasteryRequest } from '@/types'

/**
 * ✅ IMPLEMENTED: Fetch mastery for a single topic
 */
export function useTopicMastery(userId: string | undefined, topicId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.mastery.byTopic(userId!, topicId!),
    queryFn: () => fetchTopicMastery(userId!, topicId!),
    enabled: !!userId && !!topicId,
    staleTime: 1 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}

/**
 * ✅ IMPLEMENTED: Fetch mastery for all topics in a course
 */
export function useCourseMastery(userId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.mastery.byCourse(userId!, courseId!),
    queryFn: () => fetchCourseMastery(userId!, courseId!),
    enabled: !!userId && !!courseId,
    staleTime: 1 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}

/**
 * ✅ IMPLEMENTED: Update mastery after session
 * Mutation that invalidates mastery queries
 */
export function useUpdateMastery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateMasteryRequest) => updateMastery(request),
    onSuccess: () => {
      // Invalidate all mastery queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.mastery.all })
    },
  })
}
