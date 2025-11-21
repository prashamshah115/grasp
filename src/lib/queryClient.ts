/**
 * React Query (TanStack Query v5) Configuration
 * Following 2025 best practices with TypeScript
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 5 minutes (good for course data that doesn't change often)
      staleTime: 5 * 60 * 1000,
      // Cache time: 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests
      retry: 2,
      // Retry delay (exponential backoff)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
})

// Query keys factory for type-safe query keys
export const queryKeys = {
  // Courses
  courses: {
    all: ['courses'] as const,
    detail: (id: string) => ['courses', id] as const,
    topics: (courseId: string) => ['courses', courseId, 'topics'] as const,
  },
  // Topics
  topics: {
    all: ['topics'] as const,
    detail: (id: string) => ['topics', id] as const,
    questions: (topicId: string) => ['topics', topicId, 'questions'] as const,
    mastery: (userId: string, topicId: string) =>
      ['topics', topicId, 'mastery', userId] as const,
  },
  // Questions
  questions: {
    all: ['questions'] as const,
    detail: (id: string) => ['questions', id] as const,
    byTopic: (topicId: string) => ['questions', 'topic', topicId] as const,
  },
  // Sessions
  sessions: {
    all: ['sessions'] as const,
    detail: (id: string) => ['sessions', id] as const,
    active: (userId: string) => ['sessions', 'active', userId] as const,
  },
  // Mastery
  mastery: {
    all: ['mastery'] as const,
    byCourse: (userId: string, courseId: string) =>
      ['mastery', 'course', courseId, userId] as const,
    byTopic: (userId: string, topicId: string) =>
      ['mastery', 'topic', topicId, userId] as const,
  },
  // Compression notes
  compression: {
    all: ['compression'] as const,
    byTopic: (userId: string, topicId: string) =>
      ['compression', topicId, userId] as const,
  },
  // Exams
  exams: {
    all: ['exams'] as const,
    detail: (id: string) => ['exams', id] as const,
    byCourse: (courseId: string) => ['exams', 'course', courseId] as const,
    sessions: (examId: string, userId: string) =>
      ['exams', examId, 'sessions', userId] as const,
  },
  // Chat
  chat: {
    all: ['chat'] as const,
    conversation: (conversationId: string) => ['chat', conversationId] as const,
  },
  // Documents & Storage
  documents: {
    all: ['documents'] as const,
    detail: (id: string) => ['documents', id] as const,
    byTopic: (topicId: string) => ['documents', 'topic', topicId] as const,
    byCourse: (courseId: string) => ['documents', 'course', courseId] as const,
  },
  storage: {
    all: ['storage'] as const,
    userFiles: (userId: string) => ['storage', 'user', userId] as const,
    courseFiles: (coursePath: string) => ['storage', 'course', coursePath] as const,
  },
  // User Courses
  userCourses: {
    all: ['user-courses'] as const,
  },
  // Premium
  premium: {
    status: ['premium', 'status'] as const,
  },
  // Course Uploads
  courseUploads: {
    all: ['course-uploads'] as const,
    byCourse: (courseId: string) => ['course-uploads', 'course', courseId] as const,
    byUser: (userId: string) => ['course-uploads', 'user', userId] as const,
  },
} as const

// Type helpers for query results
export type QueryKey = typeof queryKeys[keyof typeof queryKeys]
