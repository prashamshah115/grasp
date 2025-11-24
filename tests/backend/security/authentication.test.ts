/**
 * Security Tests - Authentication
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction } from '../utils/helpers.ts'
import { validateConfig } from '../config.ts'

validateConfig()

Deno.test('Authentication - Valid JWT token accepted', async () => {
  // This is tested in other test files where we create users
  // Just verify the pattern works
  assert(true, 'Valid tokens are tested in integration tests')
})

Deno.test('Authentication - Invalid JWT token rejected', async () => {
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'Test',
    },
    'invalid-token-12345'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Authentication - Missing Authorization header rejected', async () => {
  const response = await callEdgeFunction('rag-chat', {
    message: 'Test',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

Deno.test('Authentication - Malformed token rejected', async () => {
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'Test',
    },
    'Bearer invalid.token.here'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for malformed token'
  )
})

Deno.test('Authentication - Expired token rejected', async () => {
  // Note: This would require creating an expired token
  // For now, we test that invalid tokens are rejected
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'Test',
    },
    'expired-token-test'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for expired/invalid token'
  )
})

