/**
 * React Query Hooks - Storage & File Upload
 *
 * IMPLEMENTATION STATUS:
 * ✅ useUploadDocument - Upload PDF to user storage
 * ✅ useIngestDocument - Trigger document processing
 * ✅ useUserFiles - List user's uploaded files
 * ✅ useDeleteUserFile - Delete user file
 * ✅ useCourseDocuments - List course materials
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadDocument, ingestDocument } from '@/lib/api'
import { listUserFiles, deleteUserFile, listCourseDocuments, getUserFileUrl } from '@/lib/storage'
import { queryKeys } from '@/lib/queryClient'
import { useAuth } from '@/components/auth/AuthProvider'

/**
 * ✅ IMPLEMENTED: Upload document and trigger ingestion
 * 1. Uploads file to user-content bucket
 * 2. Creates document record in DB
 * 3. Optionally triggers ingestion for embeddings
 */
export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      courseId,
      topicId,
      autoIngest = true,
    }: {
      file: File
      courseId: string
      topicId: string
      autoIngest?: boolean
    }) => {
      // Upload to storage and create DB record
      const document = await uploadDocument(file, courseId, topicId)

      // Optionally trigger ingestion
      if (autoIngest) {
        await ingestDocument(document.id)
      }

      return document
    },
    onSuccess: (data, variables) => {
      // Invalidate documents queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.byTopic(variables.topicId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.byCourse(variables.courseId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.storage.all,
      })
    },
    onError: (error) => {
      console.error('Upload failed:', error)
    },
  })
}

/**
 * ✅ IMPLEMENTED: Trigger document ingestion manually
 * Use when document was uploaded without auto-ingestion
 */
export function useIngestDocument() {
  return useMutation({
    mutationFn: (documentId: string) => ingestDocument(documentId),
    onError: (error) => {
      console.error('Ingestion failed:', error)
    },
  })
}

/**
 * ✅ IMPLEMENTED: List all files in user's storage
 * Returns file metadata (name, size, created_at, etc.)
 */
export function useUserFiles() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.storage.userFiles(user?.id || ''),
    queryFn: () => listUserFiles(),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * ✅ IMPLEMENTED: Delete file from user storage
 * Invalidates storage queries after success
 */
export function useDeleteUserFile() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (filename: string) => deleteUserFile(filename),
    onSuccess: () => {
      // Invalidate user files query
      queryClient.invalidateQueries({
        queryKey: queryKeys.storage.userFiles(user?.id || ''),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.storage.all,
      })
    },
    onError: (error) => {
      console.error('Delete failed:', error)
    },
  })
}

/**
 * ✅ IMPLEMENTED: List course materials (public bucket)
 * Returns files in course-materials bucket for a specific path
 */
export function useCourseDocuments(coursePath: string) {
  return useQuery({
    queryKey: queryKeys.storage.courseFiles(coursePath),
    queryFn: () => listCourseDocuments(coursePath),
    enabled: !!coursePath,
    staleTime: 10 * 60 * 1000, // 10 minutes (course materials change rarely)
  })
}

/**
 * ✅ IMPLEMENTED: Get signed URL for user file
 * Returns temporary URL that expires (useful for downloads)
 */
export function useUserFileUrl(filename: string | null, expiresIn: number = 3600) {
  return useQuery({
    queryKey: ['storage', 'user-file-url', filename, expiresIn],
    queryFn: () => getUserFileUrl(filename!, expiresIn),
    enabled: !!filename,
    staleTime: (expiresIn - 60) * 1000, // Refresh 1 minute before expiry
  })
}
