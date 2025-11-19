/**
 * React Query Hooks - Questions
 *
 * IMPLEMENTATION STATUS:
 * ✅ useQuestions - Fetch questions for topic
 * ✅ useQuestion - Fetch single question
 */

import { useQuery } from '@tanstack/react-query'
import { fetchQuestions, fetchQuestion } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'

/**
 * ✅ IMPLEMENTED: Fetch questions for a topic
 */
export function useQuestions(topicId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.questions.byTopic(topicId!),
    queryFn: () => fetchQuestions(topicId!),
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000, // 5 minutes (questions change less often than user data)
  })
}

/**
 * ✅ IMPLEMENTED: Fetch single question
 */
export function useQuestion(questionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.questions.detail(questionId!),
    queryFn: () => fetchQuestion(questionId!),
    enabled: !!questionId,
    staleTime: 10 * 60 * 1000,
  })
}
