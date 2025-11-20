// src/lib/storage.ts
import { supabase } from './supabase'

// ============================================
// COURSE MATERIALS (Public)
// ============================================

/**
 * Get public URL for course material
 * No auth required - anyone can access
 */
export function getCourseDocumentUrl(path: string): string {
  const { data } = supabase.storage
    .from('course-materials')
    .getPublicUrl(path)

  return data.publicUrl
}

/**
 * Upload course document (ADMIN ONLY - use service role)
 * This should be called from backend/Edge Function only
 */
export async function uploadCourseDocument(
  path: string,
  file: File | Blob
) {
  // NOTE: This will fail with anon key (intended)
  // Must be called with service_role key from backend

  const { data, error } = await supabase.storage
    .from('course-materials')
    .upload(path, file, {
      contentType: 'application/pdf',
      upsert: false // Don't overwrite existing
    })

  if (error) throw error
  return data
}

/**
 * List all documents for a course/topic
 */
export async function listCourseDocuments(coursePath: string) {
  const { data, error } = await supabase.storage
    .from('course-materials')
    .list(coursePath)

  if (error) throw error
  return data
}

// ============================================
// USER CONTENT (Private)
// ============================================

/**
 * Upload user file (profile pic, notes, etc)
 * Automatically scoped to current user
 */
export async function uploadUserFile(
  filename: string,
  file: File | Blob
) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Path format: {user_id}/{filename}
  const path = `${user.id}/${filename}`

  const { data, error } = await supabase.storage
    .from('user-content')
    .upload(path, file, {
      upsert: true // Allow overwriting (e.g., profile pic)
    })

  if (error) throw error
  return data
}

/**
 * Get signed URL for user's private file
 * URL expires after specified time (default 1 hour)
 */
export async function getUserFileUrl(
  filename: string,
  expiresIn: number = 3600
) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const path = `${user.id}/${filename}`

  const { data, error } = await supabase.storage
    .from('user-content')
    .createSignedUrl(path, expiresIn)

  if (error) throw error
  return data.signedUrl
}

/**
 * List all files for current user
 */
export async function listUserFiles() {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.storage
    .from('user-content')
    .list(user.id)

  if (error) throw error
  return data
}

/**
 * Delete user file
 */
export async function deleteUserFile(filename: string) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const path = `${user.id}/${filename}`

  const { error } = await supabase.storage
    .from('user-content')
    .remove([path])

  if (error) throw error
}
