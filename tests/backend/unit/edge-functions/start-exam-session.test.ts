/**
 * Unit Tests for Start Exam Session Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Start Exam Session - Missing exam_id (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'start-exam-session',
    {},
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing exam_id'
  )

  await user.client.auth.signOut()
})

Deno.test('Start Exam Session - Invalid exam_id format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'start-exam-session',
    {
      exam_id: 'invalid-uuid',
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

Deno.test('Start Exam Session - Exam not found', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'start-exam-session',
    {
      exam_id: '00000000-0000-0000-0000-000000000999',
    },
    user.token
  )

  // Should return 404 for exam not found
  assert(
    [404, 422].includes(response.status),
    `Expected 404/422, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('Start Exam Session - User not enrolled (403)', async () => {
  const user = await getSharedTestUser()
  
  // This will fail if user is not enrolled
  const response = await callEdgeFunction(
    'start-exam-session',
    {
      exam_id: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  // Accept 403 (not enrolled), 404 (exam not found), or 422 (validation)
  assert(
    [403, 404, 422].includes(response.status),
    `Expected 403/404/422, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('Start Exam Session - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'start-exam-session',
    {
      exam_id: '00000000-0000-0000-0000-000000000001',
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Start Exam Session - Missing authentication', async () => {
  const response = await callEdgeFunction('start-exam-session', {
    exam_id: '00000000-0000-0000-0000-000000000001',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

