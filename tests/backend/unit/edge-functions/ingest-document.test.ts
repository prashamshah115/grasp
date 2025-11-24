/**
 * Unit Tests for Ingest Document Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../../utils/helpers.ts'
import { TEST_CONFIG, validateConfig } from '../../config.ts'

validateConfig()

Deno.test('Ingest Document - Missing document_id (validation error)', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'ingest-document',
    {},
    user.token
  )

  assertEquals(
    response.status,
    422,
    'Should return 422 for missing document_id'
  )

  await user.client.auth.signOut()
})

Deno.test('Ingest Document - Invalid document_id format', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'ingest-document',
    {
      document_id: 'invalid-uuid',
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

Deno.test('Ingest Document - Document not found', async () => {
  const user = await getSharedTestUser()
  
  const response = await callEdgeFunction(
    'ingest-document',
    {
      document_id: '00000000-0000-0000-0000-000000000999',
    },
    user.token
  )

  // Should return 404 for document not found
  assertEquals(
    response.status,
    404,
    'Should return 404 for document not found'
  )

  await user.client.auth.signOut()
})

Deno.test('Ingest Document - Invalid authentication', async () => {
  const response = await callEdgeFunction(
    'ingest-document',
    {
      document_id: '00000000-0000-0000-0000-000000000001',
    },
    'invalid-token'
  )

  assertEquals(
    response.status,
    401,
    'Should return 401 for invalid token'
  )
})

Deno.test('Ingest Document - Missing authentication', async () => {
  const response = await callEdgeFunction('ingest-document', {
    document_id: '00000000-0000-0000-0000-000000000001',
  })

  assertEquals(
    response.status,
    401,
    'Should return 401 for missing token'
  )
})

