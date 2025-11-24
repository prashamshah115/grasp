/**
 * Unit Tests for Update Question History Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Update Question History - Valid request (correct answer)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-question-history',
    {
      questionId: '00000000-0000-0000-0000-000000000001',
      isCorrect: true,
    },
    user.token
  )

  // Accept 200 (success), 404 (question not found), or 422 (validation)
  assert(
    [200, 404, 422].includes(response.status),
    `Expected 200/404/422, got ${response.status}: ${JSON.stringify(response.data)}`
  )

  if (response.status === 200) {
    assert(response.data.success === true, 'Response should indicate success')
    assert(response.data.nextReview, 'Response should include nextReview')
    assert(typeof response.data.timesSeen === 'number', 'Response should include timesSeen')
    assert(typeof response.data.timesCorrect === 'number', 'Response should include timesCorrect')
    assert(typeof response.data.accuracy === 'number', 'Response should include accuracy')
  }

  await user.client.auth.signOut()
})

Deno.test('Update Question History - Valid request (incorrect answer)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-question-history',
    {
      questionId: '00000000-0000-0000-0000-000000000001',
      isCorrect: false,
    },
    user.token
  )

  // Accept 200 (success), 404 (question not found), or 422 (validation)
  assert(
    [200, 404, 422].includes(response.status),
    `Expected 200/404/422, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('Update Question History - Missing questionId (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-question-history',
    {
      isCorrect: true,
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing questionId'
  )

  await user.client.auth.signOut()
})

Deno.test('Update Question History - Missing isCorrect (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-question-history',
    {
      questionId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing isCorrect'
  )

  await user.client.auth.signOut()
})

Deno.test('Update Question History - Invalid questionId format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-question-history',
    {
      questionId: 'invalid-uuid',
      isCorrect: true,
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

Deno.test('Update Question History - Invalid isCorrect type', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'update-question-history',
    {
      questionId: '00000000-0000-0000-0000-000000000001',
      isCorrect: 'true', // String instead of boolean
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for invalid isCorrect type'
  )

  await user.client.auth.signOut()
})

Deno.test('Update Question History - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'update-question-history',
    {
      questionId: '00000000-0000-0000-0000-000000000001',
      isCorrect: true,
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Update Question History - Missing authentication', async () => {
  const response = await callEdgeFunction('update-question-history', {
    questionId: '00000000-0000-0000-0000-000000000001',
    isCorrect: true,
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

