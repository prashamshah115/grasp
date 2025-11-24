/**
 * Unit Tests for RAG Chat Edge Function
 * Tests individual components with mocks
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig, REAL_DATA_IDS } from '../../config.ts'

// Validate config before tests
validateConfig()

Deno.test('RAG Chat - Valid request with message', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'What is virtual memory?',
      courseId: REAL_DATA_IDS.courseId,
    },
    user.token
  )

  // Should accept 200 (success) or 429 (rate limited)
  assert(
    response.status === 200 || response.status === 429,
    `Expected 200 or 429, got ${response.status}`
  )

  if (response.status === 200) {
    assert(response.data.answer, 'Response should include answer')
    assert(Array.isArray(response.data.citations), 'Response should include citations')
  }

  await user.client.auth.signOut()
})

Deno.test('RAG Chat - Missing message (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      courseId: REAL_DATA_IDS.courseId,
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing message'
  )

  await user.client.auth.signOut()
})

Deno.test('RAG Chat - Empty message (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: '',
      courseId: REAL_DATA_IDS.courseId,
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for empty message'
  )

  await user.client.auth.signOut()
})

Deno.test('RAG Chat - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'Test message',
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('RAG Chat - Missing authentication', async () => {
  const response = await callEdgeFunction('rag-chat', {
    message: 'Test message',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

Deno.test('RAG Chat - Request with topicId', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'What is virtual memory?',
      courseId: REAL_DATA_IDS.courseId,
      topicId: REAL_DATA_IDS.topicId,
    },
    user.token
  )

  // Should accept 200 (success), 404 (no documents), or 429 (rate limited)
  assert(
    [200, 404, 429].includes(response.status),
    `Expected 200/404/429, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('RAG Chat - Request with questionId', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'Help me understand this',
      courseId: REAL_DATA_IDS.courseId,
      topicId: REAL_DATA_IDS.topicId,
      questionId: REAL_DATA_IDS.questionId,
    },
    user.token
  )

  // Should accept 200 (success), 404 (no documents), or 429 (rate limited)
  assert(
    [200, 404, 429].includes(response.status),
    `Expected 200/404/429, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('RAG Chat - Malformed JSON', async () => {
  const user = await getSharedTestUser()
  
  // Send invalid JSON
  const response = await fetch(
    `${TEST_CONFIG.supabaseUrl}/functions/v1/rag-chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`,
      },
      body: 'invalid json',
    }
  )

  assert(
    response.status === 400 || response.status === 422,
    `Expected 400/422 for malformed JSON, got ${response.status}`
  )

  await user.client.auth.signOut()
})

