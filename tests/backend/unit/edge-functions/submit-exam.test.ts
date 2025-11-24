/**
 * Unit Tests for Submit Exam Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Submit Exam - Missing session_id (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'submit-exam',
    {},
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing session_id'
  )

  await user.client.auth.signOut()
})

Deno.test('Submit Exam - Invalid session_id format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'submit-exam',
    {
      session_id: 'invalid-uuid',
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for invalid UUID format'
  )

  await user.client.auth.signOut()
})

Deno.test('Submit Exam - Session not found', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'submit-exam',
    {
      session_id: '00000000-0000-0000-0000-000000000999',
    },
    user.token
  )

  // Should return 404 for session not found
  assertEquals(
    response.status,
    404,
    'Should return 404 for session not found'
  )

  await user.client.auth.signOut()
})

Deno.test('Submit Exam - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'submit-exam',
    {
      session_id: '00000000-0000-0000-0000-000000000001',
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Submit Exam - Missing authentication', async () => {
  const response = await callEdgeFunction('submit-exam', {
    session_id: '00000000-0000-0000-0000-000000000001',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

