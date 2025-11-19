/**
 * Zustand Global State Store
 * Following 2025 best practices with TypeScript + persist middleware
 *
 * Double parentheses syntax: create<State>()()
 * Persist middleware: selective state persistence
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  StudySession,
  SessionState,
  SessionStats,
  Question
} from '@/types/session'
import type { Database } from '@/types/database'
import type { ChatConversation } from '@/types/chat'

// Screen types
export type Screen =
  | 'landing'
  | 'catalog'
  | 'course-home'
  | 'topic-practice'
  | 'global-practice'
  | 'compression'
  | 'exam'
  | 'chat'

type Course = Database['public']['Tables']['courses']['Row']
type Topic = Database['public']['Tables']['topics']['Row']
type TopicMastery = Database['public']['Tables']['topic_mastery']['Row']

// Main app state interface
interface AppState {
  // ==================== NAVIGATION ====================
  currentScreen: Screen
  setScreen: (screen: Screen) => void

  // ==================== AUTH ====================
  user: {
    id: string
    email: string
  } | null
  setUser: (user: AppState['user']) => void
  logout: () => void

  // ==================== COURSE CONTEXT ====================
  currentCourse: Course | null
  setCurrentCourse: (course: Course | null) => void

  currentTopic: Topic | null
  setCurrentTopic: (topic: Topic | null) => void

  // ==================== ACTIVE SESSION ====================
  activeSession: StudySession | null
  sessionState: SessionState
  sessionQuestions: Question[]
  currentQuestionIndex: number
  userAnswers: Record<string, string>
  questionStartTime: number | null

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

  // ==================== MASTERY TRACKING ====================
  topicMastery: Record<string, TopicMastery>
  setTopicMastery: (topicId: string, mastery: TopicMastery) => void
  refreshMastery: (courseId: string) => Promise<void>

  // ==================== CHAT ====================
  activeChat: ChatConversation | null
  setActiveChat: (chat: ChatConversation | null) => void
  addChatMessage: (message: Omit<ChatConversation['messages'][0], 'id' | 'timestamp'>) => void

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
      // ==================== NAVIGATION ====================
      currentScreen: 'landing',
      setScreen: (screen) => set({ currentScreen: screen }),

      // ==================== AUTH ====================
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({
        user: null,
        currentCourse: null,
        currentTopic: null,
        activeSession: null,
        topicMastery: {}
      }),

      // ==================== COURSE CONTEXT ====================
      currentCourse: null,
      setCurrentCourse: (course) => set({ currentCourse: course }),

      currentTopic: null,
      setCurrentTopic: (topic) => set({ currentTopic: topic }),

      // ==================== ACTIVE SESSION ====================
      activeSession: null,
      sessionState: 'idle',
      sessionQuestions: [],
      currentQuestionIndex: 0,
      userAnswers: {},
      questionStartTime: null,

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

        // TODO: Call API to save attempt
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
        })
      },

      // ==================== MASTERY TRACKING ====================
      topicMastery: {},
      setTopicMastery: (topicId, mastery) => {
        const { topicMastery } = get()
        set({
          topicMastery: {
            ...topicMastery,
            [topicId]: mastery,
          },
        })
      },

      refreshMastery: async (courseId) => {
        // TODO: Implement API call to fetch mastery
        console.log(`Refreshing mastery for course: ${courseId}`)
      },

      // ==================== CHAT ====================
      activeChat: null,
      setActiveChat: (chat) => set({ activeChat: chat }),

      addChatMessage: (message) => {
        const { activeChat } = get()
        if (!activeChat) return

        const newMessage = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        }

        set({
          activeChat: {
            ...activeChat,
            messages: [...activeChat.messages, newMessage],
            updatedAt: new Date().toISOString(),
          },
        })
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
      // Only persist user session and course context
      partialize: (state) => ({
        user: state.user,
        currentCourse: state.currentCourse,
        currentTopic: state.currentTopic,
      }),
    }
  )
)
