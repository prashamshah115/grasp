/**
 * Zustand Global State Store - PHASE 4 CORRECTED
 * Following 2025 best practices with TypeScript + persist middleware
 *
 * CRITICAL: This store ONLY handles CLIENT STATE
 * Backend data (courses, topics, mastery, etc.) belongs in React Query
 *
 * ZUSTAND RESPONSIBILITIES:
 * ✅ Session-local state (current question index, timer, answers)
 * ✅ UI state (chat open/closed, loading, errors)
 * ✅ User auth state (could also use Supabase auth directly)
 *
 * REACT QUERY RESPONSIBILITIES:
 * ❌ Courses, topics, questions
 * ❌ Mastery data
 * ❌ Compression notes
 * ❌ Session data from database
 *
 * NO OVERLAP ALLOWED
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  StudySession,
  SessionState,
  SessionStats,
  Question
} from '@/types/session'

// Main app state interface (CLIENT STATE ONLY)
interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface AppState {
  // ==================== AUTH ====================
  user: AuthUser | null
  setUser: (user: AppState['user']) => void
  logout: () => void

  // ==================== SESSION-LOCAL STATE ====================
  // This is ephemeral state for the active session only
  activeSession: StudySession | null
  sessionState: SessionState
  sessionQuestions: Question[] // Questions for CURRENT session only
  currentQuestionIndex: number
  userAnswers: Record<string, string> // Answers for CURRENT session only
  questionStartTime: number | null
  sessionTimer: number // Elapsed seconds for exam timer

  // Session actions
  startSession: (
    mode: 'practice' | 'global' | 'compression' | 'exam',
    courseId: string,
    topicId?: string,
    examId?: string
  ) => void

  loadQuestion: (question: Question) => void
  submitAnswer: (questionId: string, answer: string, isCorrect: boolean) => void
  nextQuestion: () => void
  endSession: (stats: SessionStats) => void
  resetSession: () => void
  updateSessionTimer: (seconds: number) => void

  // ==================== UI STATE ====================
  isChatOpen: boolean
  toggleChat: () => void

  isLoading: boolean
  setLoading: (loading: boolean) => void

  error: string | null
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ==================== AUTH ====================
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({
        user: null,
        activeSession: null,
        sessionState: 'idle',
        sessionQuestions: [],
        currentQuestionIndex: 0,
        userAnswers: {},
        questionStartTime: null,
        sessionTimer: 0,
      }),

      // ==================== SESSION-LOCAL STATE ====================
      activeSession: null,
      sessionState: 'idle',
      sessionQuestions: [],
      currentQuestionIndex: 0,
      userAnswers: {},
      questionStartTime: null,
      sessionTimer: 0,

      startSession: (mode, courseId, topicId, examId) => {
        const { user } = get()
        if (!user) {
          set({ error: 'User not authenticated' })
          return
        }

        const session: StudySession = {
          id: crypto.randomUUID(),
          userId: user.id,
          courseId,
          topicId,
          examId,
          mode,
          state: 'loading',
          questions: [],
          currentQuestionIndex: 0,
          userAnswers: new Map(),
          questionStartTime: null,
          sessionStartTime: new Date().toISOString(),
        }

        set({
          activeSession: session,
          sessionState: 'loading',
          sessionQuestions: [],
          currentQuestionIndex: 0,
          userAnswers: {},
          questionStartTime: null,
          sessionTimer: 0,
        })
      },

      loadQuestion: (question) => {
        const { sessionQuestions } = get()
        set({
          sessionQuestions: [...sessionQuestions, question],
          sessionState: 'practicing',
          questionStartTime: Date.now(),
        })
      },

      submitAnswer: (questionId, answer, isCorrect) => {
        const { userAnswers, questionStartTime } = get()
        const timeTaken = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 0

        set({
          userAnswers: {
            ...userAnswers,
            [questionId]: answer,
          },
          sessionState: 'reviewing',
          questionStartTime: null,
        })

        // NOTE: API submission is handled by React Query mutation, not Zustand
        console.log(`Answer submitted: ${questionId}, correct: ${isCorrect}, time: ${timeTaken}s`)
      },

      nextQuestion: () => {
        const { currentQuestionIndex, sessionQuestions } = get()
        const nextIndex = currentQuestionIndex + 1

        if (nextIndex < sessionQuestions.length) {
          set({
            currentQuestionIndex: nextIndex,
            sessionState: 'practicing',
            questionStartTime: Date.now(),
          })
        } else {
          // No more questions, move to submitting
          set({ sessionState: 'submitting' })
        }
      },

      endSession: (stats) => {
        set({
          activeSession: null,
          sessionState: 'completed',
          sessionQuestions: [],
          currentQuestionIndex: 0,
          userAnswers: {},
          questionStartTime: null,
          sessionTimer: 0,
        })

        // Reset to idle after a delay
        setTimeout(() => {
          set({ sessionState: 'idle' })
        }, 1000)
      },

      resetSession: () => {
        set({
          activeSession: null,
          sessionState: 'idle',
          sessionQuestions: [],
          currentQuestionIndex: 0,
          userAnswers: {},
          questionStartTime: null,
          sessionTimer: 0,
        })
      },

      updateSessionTimer: (seconds) => {
        set({ sessionTimer: seconds })
      },

      // ==================== UI STATE ====================
      isChatOpen: false,
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),

      error: null,
      setError: (error) => set({ error }),
    }),
    {
      name: 'grasp-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist user auth state
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
)
