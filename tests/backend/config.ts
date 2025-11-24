/**
 * Backend Test Configuration
 * Centralized configuration for all backend tests
 */

export interface TestConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  testUser: {
    email: string
    password: string
  }
  timeouts: {
    function: number
    database: number
    network: number
  }
  cleanup: {
    afterTests: boolean
    preserveTestData: boolean
  }
}

/**
 * Load configuration from environment variables
 * Falls back to defaults for local development
 */
export function loadTestConfig(): TestConfig {
  return {
    supabaseUrl: Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || 'http://localhost:54321',
    supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || '',
    supabaseServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    testUser: {
      email: Deno.env.get('TEST_USER_EMAIL') || 'test@example.com',
      password: Deno.env.get('TEST_USER_PASSWORD') || 'test-password-123',
    },
    timeouts: {
      function: parseInt(Deno.env.get('TEST_FUNCTION_TIMEOUT') || '30000'),
      database: parseInt(Deno.env.get('TEST_DB_TIMEOUT') || '5000'),
      network: parseInt(Deno.env.get('TEST_NETWORK_TIMEOUT') || '10000'),
    },
    cleanup: {
      afterTests: Deno.env.get('TEST_CLEANUP') !== 'false',
      preserveTestData: Deno.env.get('TEST_PRESERVE_DATA') === 'true',
    },
  }
}

export const TEST_CONFIG = loadTestConfig()

/**
 * Real data IDs from production database
 * These are actual courses/topics/questions that exist
 */
export const REAL_DATA_IDS = {
  // CSE120 Operating Systems (real course)
  courseId: '634a94de-f71c-4c53-9f5d-e9c8bfc22449',
  // Architecture topic (real topic)
  topicId: 'f643239a-48e7-4eec-ba5e-f32775f4c39a',
  // Real question IDs
  questionIds: [
    '6025841a-4fa3-4ecc-a125-0ed8b51a3a5f',
    '366f89ae-5b55-4221-864f-d166bd5d3f81',
    'ab75a08b-bbcd-4537-8cda-cdfdef976e19',
  ],
  questionId: '6025841a-4fa3-4ecc-a125-0ed8b51a3a5f',
  examId: '', // Will be created if needed
  documentId: '', // Will be created if needed
}

/**
 * Test data IDs (populated after seeding) - DEPRECATED, use REAL_DATA_IDS
 */
export const TEST_IDS = REAL_DATA_IDS

/**
 * Validate test configuration
 */
export function validateConfig(): void {
  if (!TEST_CONFIG.supabaseUrl) {
    throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required')
  }
  if (!TEST_CONFIG.supabaseAnonKey) {
    console.warn('⚠️  SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY not set - some tests may fail')
    // Don't throw - allow tests to run and fail gracefully
  }
  if (!TEST_CONFIG.supabaseServiceRoleKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - some tests may fail')
    // Don't throw - allow tests to run and fail gracefully
  }
}

