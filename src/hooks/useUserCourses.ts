/**
 * React Query Hooks - User Courses & Course Uploads
 *
 * IMPLEMENTATION STATUS:
 * ✅ useUserCourses - Fetch user's enrolled courses
 * ✅ useAddCourse - Add course to user's enrolled courses
 * ✅ useRemoveCourse - Remove course from user's enrolled courses
 * ✅ useUploadCourseMaterial - Upload course material file
 * ✅ usePremiumStatus - Check if user has premium subscription
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchUserCourses, addUserCourse, removeUserCourse, uploadCourseMaterial, checkPremiumStatus } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import { useAuth } from '@/components/auth/AuthProvider'

/**
 * ✅ IMPLEMENTED: Fetch user's enrolled courses
 */
export function useUserCourses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.userCourses.all,
    queryFn: fetchUserCourses,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * ✅ IMPLEMENTED: Add course to user's enrolled courses
 * Invalidates user courses and courses queries after success
 */
export function useAddCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (courseId: string) => addUserCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userCourses.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all })
    },
  })
}

/**
 * ✅ IMPLEMENTED: Remove course from user's enrolled courses
 * Invalidates user courses query after success
 */
export function useRemoveCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (courseId: string) => removeUserCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userCourses.all })
    },
  })
}

/**
 * ✅ IMPLEMENTED: Upload course material file
 * Uploads to course-materials bucket and triggers ingestion
 * Note: courseId is required for course material uploads
 */
export function useUploadCourseMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ file, courseId }: { file: File; courseId: string }) =>
      uploadCourseMaterial(file, courseId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courseUploads.all })
      if (variables.courseId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.courseUploads.byCourse(variables.courseId),
        })
      }
    },
    onError: (error) => {
      console.error('Course material upload failed:', error)
    },
  })
}

/**
 * ✅ IMPLEMENTED: Check if user has premium subscription
 * Returns premium user data or null
 */
export function usePremiumStatus() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.premium.status,
    queryFn: checkPremiumStatus,
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes (premium status doesn't change often)
  })
}

