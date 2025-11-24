/**
 * Unit Tests for Generate Compression Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Generate Compression - Valid request with topicId', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'generate-compression',
    {
      topicId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )

  // Accept 200 (success), 404 (no documents), or 429 (rate limited)
  assert(
    [200, 404, 429].includes(response.status),
    `Expected 200/404/429, got ${response.status}: ${JSON.stringify(response.data)}`
  )

  if (response.status === 200) {
    assert(response.data.success === true, 'Response should indicate success')
    assert(response.data.content, 'Response should include content')
    assert(typeof response.data.sourceCount === 'number', 'Response should include sourceCount')
  }

  await user.client.auth.signOut()
})

Deno.test('Generate Compression - Missing topicId (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'generate-compression',
    {},
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing topicId'
  )

  await user.client.auth.signOut()
})

Deno.test('Generate Compression - Invalid topicId format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'generate-compression',
    {
      topicId: 'invalid-uuid',
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

Deno.test('Generate Compression - Topic not found', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'generate-compression',
    {
      topicId: '00000000-0000-0000-0000-000000000999',
    },
    user.token
  )

  // Should return 404 for topic not found
  assert(
    [404, 422].includes(response.status),
    `Expected 404/422, got ${response.status}`
  )

  await user.client.auth.signOut()
})

Deno.test('Generate Compression - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'generate-compression',
    {
      topicId: '00000000-0000-0000-0000-000000000001',
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Generate Compression - Missing authentication', async () => {
  const response = await callEdgeFunction('generate-compression', {
    topicId: '00000000-0000-0000-0000-000000000001',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

Deno.test('Generate Compression - Malformed JSON', async () => {
  const user = await getSharedTestUser()
  
  const response = await fetch(
    `${TEST_CONFIG.supabaseUrl}/functions/v1/generate-compression`,
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

