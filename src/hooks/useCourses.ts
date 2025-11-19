/**
 * React Query Hooks - Courses & Topics
 * Following TanStack Query v5 best practices
 *
 * IMPLEMENTATION STATUS:
 * ✅ useCourses - Fetch all courses
 * ✅ useCourse - Fetch single course
 * ✅ useTopics - Fetch topics for course
 * ✅ useTopic - Fetch single topic
 */

import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { fetchCourses, fetchCourse, fetchTopics, fetchTopic } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'

/**
 * ✅ IMPLEMENTED: Fetch all courses
 * Uses standard useQuery (data can be undefined while loading)
 */
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: fetchCourses,
    staleTime: 10 * 60 * 1000, // 10 minutes (courses don't change often)
  })
}

/**
 * ✅ IMPLEMENTED: Fetch all courses with Suspense
 * Uses useSuspenseQuery (data is NEVER undefined, throws to Suspense boundary)
 */
export function useCoursesSuspense() {
  return useSuspenseQuery({
    queryKey: queryKeys.courses.all,
    queryFn: fetchCourses,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * ✅ IMPLEMENTED: Fetch single course
 */
export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.courses.detail(courseId!),
    queryFn: () => fetchCourse(courseId!),
    enabled: !!courseId, // Only run if courseId exists
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * ✅ IMPLEMENTED: Fetch topics for a course
 */
export function useTopics(courseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.courses.topics(courseId!),
    queryFn: () => fetchTopics(courseId!),
    enabled: !!courseId,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * ✅ IMPLEMENTED: Fetch single topic
 */
export function useTopic(topicId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.topics.detail(topicId!),
    queryFn: () => fetchTopic(topicId!),
    enabled: !!topicId,
    staleTime: 10 * 60 * 1000,
  })
}
