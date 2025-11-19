/**
 * Supabase Client Configuration
 * Following 2025 best practices with TypeScript support
 *
 * Environment variables (Vite):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

// Create typed Supabase client (singleton)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Type helper for better autocomplete
export type SupabaseClient = typeof supabase

// Helper to check connection health
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('courses').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
