/**
 * React Query Hooks - Compression Notes
 *
 * IMPLEMENTATION STATUS:
 * ✅ useCompressionNotes - Fetch compression notes for topic
 * ✅ useGenerateCompression - Generate AI compression notes (mutation)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCompressionNotes, generateCompression } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import { logger } from '@/lib/logger'
import type { GenerateCompressionRequest } from '@/types'

/**
 * ✅ IMPLEMENTED: Fetch compression notes for a topic
 */
export function useCompressionNotes(userId: string | undefined, topicId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.compression.byTopic(userId!, topicId!),
    queryFn: () => fetchCompressionNotes(userId!, topicId!),
    enabled: !!userId && !!topicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * ✅ IMPLEMENTED: Generate new compression notes
 * AI-generates 10-20 bullet study notes
 * Invalidates compression query after success
 */
export function useGenerateCompression() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: GenerateCompressionRequest) => {
      return logger.logApiCall(
        'generateCompression',
        () => generateCompression(request),
        {
          userId: request.user_id,
          topicId: request.topic_id,
        }
      )
    },
    onSuccess: (_, variables) => {
      logger.info('Compression generated successfully', {
        userId: variables.user_id,
        topicId: variables.topic_id,
      })
      // Invalidate compression for this topic
      queryClient.invalidateQueries({
        queryKey: queryKeys.compression.all,
      })
    },
    onError: (error, variables) => {
      logger.error('Failed to generate compression', error, {
        userId: variables.user_id,
        topicId: variables.topic_id,
      })
    },
  })
}
