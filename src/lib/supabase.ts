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

// Warn about missing env vars but don't crash - allows graceful degradation
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  })
  // Create a mock client to prevent crashes - actual API calls will fail gracefully
}

// Create typed Supabase client (singleton)
// Use fallback values to prevent crashes if env vars are missing
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

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
