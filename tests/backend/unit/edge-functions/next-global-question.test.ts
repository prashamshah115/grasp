/**
 * Unit Tests for Next Global Question Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Next Global Question - Valid request with courseId', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'next-global-question',
    {
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  // Accept 200 (question found) or 404 (no questions available)
  assert(
    [200, 404].includes(response.status),
    `Expected 200/404, got ${response.status}: ${JSON.stringify(response.data)}`
  )

  if (response.status === 200) {
    assert(response.data.id, 'Response should include question id')
    assert(response.data.prompt, 'Response should include prompt')
  }

  await user.client.auth.signOut()
})

Deno.test('Next Global Question - Missing courseId (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'next-global-question',
    {},
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing courseId'
  )

  await user.client.auth.signOut()
})

Deno.test('Next Global Question - Invalid courseId format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'next-global-question',
    {
      courseId: 'invalid-uuid',
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

Deno.test('Next Global Question - No questions available', async () => {
  const user = await getSharedTestUser()
  
  // Use a course ID that likely has no questions
  const response = await callEdgeFunction(
    'next-global-question',
    {
      courseId: '00000000-0000-0000-0000-000000000999',
    },
    user.token
  )

  // Should return 404 if no questions available
  assert(
    [404, 422].includes(response.status),
    `Expected 404/422, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('Next Global Question - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'next-global-question',
    {
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Next Global Question - Missing authentication', async () => {
  const response = await callEdgeFunction('next-global-question', {
    courseId: '00000000-0000-0000-0000-000000000001',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

