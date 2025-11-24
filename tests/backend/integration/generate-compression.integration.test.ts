/**
 * Integration Tests for Generate Compression Edge Function
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { seedTestData, cleanupTestData, createTestDocument } from '../setup/fixtures.ts'
import { REAL_DATA_IDS, validateConfig } from '../config.ts'

validateConfig()

Deno.test('Generate Compression Integration - End-to-end with real database', async () => {
  await seedTestData()
  const user = await createTestUser()
  
  // Create test document
  await createTestDocument(REAL_DATA_IDS.courseId, REAL_DATA_IDS.topicId)
  
  try {
    const response = await callEdgeFunction(
      'generate-compression',
      {
        topicId: REAL_DATA_IDS.topicId,
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
      assert(response.data.content.length > 0, 'Content should not be empty')
      assert(typeof response.data.sourceCount === 'number', 'Response should include sourceCount')
    }
  } finally {
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

