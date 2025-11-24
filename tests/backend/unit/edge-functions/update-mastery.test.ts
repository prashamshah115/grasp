/**
 * Unit Tests for Update Mastery Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Update Mastery - Missing sessionId (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-mastery',
    {},
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing sessionId'
  )

  await user.client.auth.signOut()
})

Deno.test('Update Mastery - Invalid sessionId format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-mastery',
    {
      sessionId: 'invalid-uuid',
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

Deno.test('Update Mastery - Session not found', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-mastery',
    {
      sessionId: '00000000-0000-0000-0000-000000000999',
    },
    user.token
  )

  // Should return 404 or 500 for session not found
  assert(
    [404, 500].includes(response.status),
    `Expected 404/500, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('Update Mastery - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'update-mastery',
    {
      sessionId: '00000000-0000-0000-0000-000000000001',
    },
    'invalid-token'
  )

  // Note: This function uses service role, so auth might not be checked
  // But we test it anyway
  assert(
    [401, 422, 500].includes(response.status),
    `Expected 401/422/500, got ${response.status}`
  )
})

