/**
 * Test Helper Utilities
 * Common functions for backend testing
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadTestConfig } from '../config.ts'

// Function to get config (reloads each time to get latest env vars)
function getConfig() {
  return loadTestConfig()
}

export interface TestUser {
  id: string
  email: string
  password: string
  client: SupabaseClient
  token: string
}

// Shared test user cache to avoid rate limiting
let sharedTestUser: TestUser | null = null

/**
 * Get or create a shared test user (avoids rate limiting)
 */
export async function getSharedTestUser(): Promise<TestUser> {
  if (sharedTestUser) {
    return sharedTestUser
  }

  const config = getConfig()
  
  if (!config.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for test user creation')
  }

  const serviceClient = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey
  )

  // Use service role to create user directly (bypasses rate limits)
  const testEmail = `test-backend-${Date.now()}@grasp.test`
  const testPassword = 'test-password-123'

  // Create user via admin API
  const { data: userData, error: createError } = await serviceClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true, // Auto-confirm email
  })

  if (createError || !userData.user) {
    throw new Error(`Failed to create test user: ${createError?.message || 'Unknown error'}`)
  }

  // Get session token
  const { data: sessionData, error: sessionError } = await serviceClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (sessionError || !sessionData.session) {
    throw new Error(`Failed to sign in test user: ${sessionError?.message || 'Unknown error'}`)
  }

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    },
  })

  sharedTestUser = {
    id: userData.user.id,
    email: testEmail,
    password: testPassword,
    client,
    token: sessionData.session.access_token,
  }

  return sharedTestUser
}

/**
 * Create a test user and return authenticated client
 * DEPRECATED: Use getSharedTestUser() instead to avoid rate limiting
 */
export async function createTestUser(
  email?: string,
  password?: string
): Promise<TestUser> {
  // Use shared test user to avoid rate limiting
  return await getSharedTestUser()
}

/**
 * Create a test user and return authenticated client (OLD VERSION - kept for compatibility)
 */
async function createTestUserOld(
  email?: string,
  password?: string
): Promise<TestUser> {
  const testEmail = email || `test-${Date.now()}@example.com`
  const testPassword = password || 'test-password-123'

  const config = getConfig()
  
  if (!config.supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY is required for testing')
  }
  
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey)

  // Sign up user
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
  })

  if (signUpError) {
    throw new Error(`Failed to create test user: ${signUpError.message}`)
  }

  if (!signUpData.user) {
    throw new Error('User creation returned no user')
  }

  // If email confirmation is required, use service role to confirm
  if (!signUpData.session) {
    const config = getConfig()
    
    if (!config.supabaseServiceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user confirmation')
    }
    
    const serviceClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey
    )

    // Confirm email using service role
    const { error: confirmError } = await serviceClient.auth.admin.updateUserById(
      signUpData.user.id,
      { email_confirm: true }
    )

    if (confirmError) {
      throw new Error(`Failed to confirm email: ${confirmError.message}`)
    }

    // Sign in after confirmation
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    if (signInError || !signInData.session) {
      throw new Error(`Failed to sign in after confirmation: ${signInError?.message}`)
    }

    return {
      id: signUpData.user.id,
      email: testEmail,
      password: testPassword,
      client: createClient(getConfig().supabaseUrl, getConfig().supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${signInData.session.access_token}`,
          },
        },
      }),
      token: signInData.session.access_token,
    }
  }

  return {
    id: signUpData.user.id,
    email: testEmail,
    password: testPassword,
      client: createClient(getConfig().supabaseUrl, getConfig().supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${signUpData.session.access_token}`,
        },
      },
    }),
    token: signUpData.session.access_token,
  }
}

/**
 * Call an Edge Function with authentication
 */
export async function callEdgeFunction(
  functionName: string,
  body: any,
  token?: string
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const config = getConfig()
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  let data: any = {}
  try {
    data = await response.json()
  } catch {
    // Response might not be JSON
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Clean up test user
 */
export async function cleanupTestUser(user: TestUser): Promise<void> {
  const serviceClient = createClient(
    TEST_CONFIG.supabaseUrl,
    TEST_CONFIG.supabaseServiceRoleKey
  )

  await serviceClient.auth.admin.deleteUser(user.id)
}

/**
 * Get service role client (bypasses RLS)
 */
export function getServiceClient(): SupabaseClient {
  const config = getConfig()
  
  if (!config.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client')
  }
  
  return createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey
  )
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

