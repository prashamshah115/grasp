/**
 * useRelevantContent Hook
 * 
 * Fetches relevant course content for a question using vector search
 * with topic-based fallback. Uses React Query for caching.
 */

import { useQuery } from '@tanstack/react-query'
import { getRelevantContent, type GetRelevantContentRequest, type RelevantContentResponse } from '@/lib/api'

interface UseRelevantContentOptions {
  questionId?: string
  questionText?: string
  topicId?: string
  courseId?: string
  enabled?: boolean
}

export function useRelevantContent({
  questionId,
  questionText,
  topicId,
  courseId,
  enabled = true,
}: UseRelevantContentOptions) {
  const hasValidInput = !!(questionId || questionText || topicId)

  return useQuery<RelevantContentResponse>({
    queryKey: ['relevantContent', questionId, questionText?.slice(0, 50), topicId, courseId],
    queryFn: () => getRelevantContent({
      questionId,
      questionText,
      topicId,
      courseId,
    }),
    enabled: enabled && hasValidInput,
    staleTime: 1000 * 60 * 5, // 5 minutes - content doesn't change often
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    retry: 1, // Only retry once on failure
    refetchOnWindowFocus: false, // Don't refetch on focus
  })
}

export type { RelevantContentResponse, GetRelevantContentRequest }



