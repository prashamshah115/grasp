/**
 * React Query Hooks - Study Sessions
 *
 * IMPLEMENTATION STATUS:
 * ✅ useStartSession - Create new study session (mutation)
 * ✅ useSubmitAnswer - Submit answer to question (mutation)
 * ✅ useEndSession - End study session (mutation)
 * ✅ useCreateExamSession - Create exam session (mutation)
 * ✅ useSubmitExam - Submit exam (mutation)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createSession,
  submitAnswer,
  endSession,
  createExamSession,
  submitExam,
} from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import type {
  CreateSessionRequest,
  SubmitAnswerRequest,
  EndSessionRequest,
  CreateExamSessionRequest,
  SubmitExamRequest,
} from '@/types'

/**
 * ✅ IMPLEMENTED: Start new study session
 * Invalidates active sessions query
 */
export function useStartSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateSessionRequest) => createSession(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all })
      return data
    },
  })
}

/**
 * ✅ IMPLEMENTED: Submit answer to question
 * Returns immediate feedback (correct/incorrect)
 */
export function useSubmitAnswer() {
  return useMutation({
    mutationFn: (request: SubmitAnswerRequest) => submitAnswer(request),
  })
}

/**
 * ✅ IMPLEMENTED: End study session
 * Invalidates sessions and mastery queries
 */
export function useEndSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: EndSessionRequest) => endSession(request),
    onSuccess: () => {
      // Invalidate both sessions and mastery (mastery updated on session end)
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mastery.all })
    },
  })
}

/**
 * ✅ IMPLEMENTED: Create exam session
 */
export function useCreateExamSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateExamSessionRequest) => createExamSession(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exams.all })
      return data
    },
  })
}

/**
 * ✅ IMPLEMENTED: Submit exam
 * Calculates score and updates exam session
 */
export function useSubmitExam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SubmitExamRequest) => submitExam(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exams.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mastery.all })
    },
  })
}
