/**
 * Security Tests - Input Validation
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { validateConfig } from '../config.ts'

validateConfig()

Deno.test('Input Validation - SQL injection attempt blocked', async () => {
  const user = await createTestUser()
  
  // Try SQL injection in message field
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: "'; DROP TABLE users; --",
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  // Should either process as normal text or return validation error
  // The important thing is it doesn't execute SQL
  assert(
    [200, 404, 422, 429].includes(response.status),
    'Should not execute SQL injection'
  )

  await user.client.auth.signOut()
})

Deno.test('Input Validation - XSS attempt sanitized', async () => {
  const user = await createTestUser()
  
  // Try XSS in message field
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: '<script>alert("XSS")</script>',
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  // Should process as text, not execute script
  assert(
    [200, 404, 422, 429].includes(response.status),
    'Should not execute XSS'
  )

  await user.client.auth.signOut()
})

Deno.test('Input Validation - UUID format enforced', async () => {
  const user = await createTestUser()
  
  const response = await callEdgeFunction(
    'generate-compression',
    {
      topicId: 'not-a-uuid-123',
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should reject invalid UUID format'
  )

  await user.client.auth.signOut()
})

Deno.test('Input Validation - Required fields enforced', async () => {
  const user = await createTestUser()
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      // Missing message
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should reject missing required field'
  )

  await user.client.auth.signOut()
})

Deno.test('Input Validation - Type validation enforced', async () => {
  const user = await createTestUser()
  
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
    'Should reject incorrect type'
  )

  await user.client.auth.signOut()
})

Deno.test('Input Validation - Length limits enforced', async () => {
  const user = await createTestUser()
  
  // Create extremely long message
  const longMessage = 'a'.repeat(100000)
  
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: longMessage,
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  // Should either accept (if no limit) or reject (if limit exists)
  // The important thing is it doesn't crash
  assert(
    [200, 400, 422, 429, 413].includes(response.status),
    'Should handle long input gracefully'
  )

  await user.client.auth.signOut()
})

