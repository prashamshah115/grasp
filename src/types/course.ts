import type { Database } from './database'

/**
 * Course type from database
 */
export type Course = Database['public']['Tables']['courses']['Row']

