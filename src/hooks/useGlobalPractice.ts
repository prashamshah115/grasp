/**
 * React Query Hooks - Global Practice
 *
 * IMPLEMENTATION STATUS:
 * ✅ useGlobalQuestion - Get next adaptive question (mutation)
 * ✅ useUpdateQuestionHistory - Update spaced repetition (mutation)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getNextGlobalQuestion, updateQuestionHistory } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import type { NextGlobalQuestionRequest, UpdateQuestionHistoryRequest } from '@/types'

/**
 * ✅ IMPLEMENTED: Get next global practice question
 * Uses spaced repetition + weak topic focus
 *
 * Usage:
 * ```ts
 * const nextQuestion = useGlobalQuestion()
 * nextQuestion.mutate({ course_id: 'uuid' })
 * ```
 */
export function useGlobalQuestion() {
  return useMutation({
    mutationFn: (request: NextGlobalQuestionRequest) => getNextGlobalQuestion(request),
  })
}

/**
 * ✅ IMPLEMENTED: Update question history
 * Implements SM-2 spaced repetition algorithm
 * Updates next_review timestamp
 */
export function useUpdateQuestionHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateQuestionHistoryRequest) => updateQuestionHistory(request),
    onSuccess: () => {
      // Invalidate mastery (question history affects mastery calculation)
      queryClient.invalidateQueries({ queryKey: queryKeys.mastery.all })
    },
  })
}
