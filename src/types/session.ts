/**
 * Session State Machine Types
 * Defines explicit states and transitions for practice/exam workflows
 */

import { Database } from './database'

export type SessionMode = Database['public']['Tables']['study_sessions']['Row']['mode']

export type SessionState =
  | 'idle'
  | 'loading'
  | 'practicing'
  | 'reviewing'
  | 'submitting'
  | 'completed'
  | 'error'
  | 'paused'

export type SessionEvent =
  | { type: 'START'; mode: SessionMode; topicId?: string; examId?: string }
  | { type: 'QUESTION_LOADED'; question: Question }
  | { type: 'ANSWER_SUBMITTED'; answer: string; isCorrect: boolean }
  | { type: 'NEXT_QUESTION' }
  | { type: 'REVIEW_ANSWER' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SUBMIT_SESSION' }
  | { type: 'SESSION_COMPLETED'; stats: SessionStats }
  | { type: 'ERROR'; error: Error }
  | { type: 'RESET' }

export interface Question {
  id: string
  prompt: string
  q_type: 'mcq' | 'short' | 'long'
  options?: string[]
  correct_answer: any
  explanation?: string
  difficulty?: 1 | 2 | 3
  topic_id: string
}

export interface SessionStats {
  totalQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  averageTimePerQuestion: number
  accuracy: number
  masteryLevel?: 'weak' | 'moderate' | 'strong'
}

export interface StudySession {
  id: string
  userId: string
  courseId: string
  topicId?: string
  examId?: string
  mode: SessionMode
  state: SessionState
  questions: Question[]
  currentQuestionIndex: number
  userAnswers: Map<string, string>
  questionStartTime: number | null
  sessionStartTime: string
  sessionEndTime?: string
  stats?: SessionStats
}

export interface ExamSession extends Omit<StudySession, 'mode'> {
  mode: 'exam'
  examId: string
  totalDurationSec: number
  timeRemainingSec: number
  isCompleted: boolean
  isFlagged: Set<string>
  lastSavedAt: string
}

// State transition validator
export function isValidTransition(
  currentState: SessionState,
  event: SessionEvent
): boolean {
  const transitions: Record<SessionState, SessionEvent['type'][]> = {
    idle: ['START'],
    loading: ['QUESTION_LOADED', 'ERROR'],
    practicing: ['ANSWER_SUBMITTED', 'PAUSE', 'SUBMIT_SESSION', 'ERROR'],
    reviewing: ['NEXT_QUESTION', 'ERROR'],
    submitting: ['SESSION_COMPLETED', 'ERROR'],
    completed: ['RESET'],
    error: ['RESET', 'START'],
    paused: ['RESUME', 'RESET'],
  }

  return transitions[currentState]?.includes(event.type) ?? false
}

// Next state calculator
export function calculateNextState(
  currentState: SessionState,
  event: SessionEvent
): SessionState {
  if (!isValidTransition(currentState, event)) {
    console.warn(`Invalid transition: ${currentState} -> ${event.type}`)
    return currentState
  }

  switch (event.type) {
    case 'START':
      return 'loading'
    case 'QUESTION_LOADED':
      return 'practicing'
    case 'ANSWER_SUBMITTED':
      return 'reviewing'
    case 'NEXT_QUESTION':
      return 'practicing'
    case 'PAUSE':
      return 'paused'
    case 'RESUME':
      return 'practicing'
    case 'SUBMIT_SESSION':
      return 'submitting'
    case 'SESSION_COMPLETED':
      return 'completed'
    case 'ERROR':
      return 'error'
    case 'RESET':
      return 'idle'
    default:
      return currentState
  }
}
