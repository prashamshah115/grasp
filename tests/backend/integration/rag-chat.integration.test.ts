/**
 * Integration Tests for RAG Chat Edge Function
 * Tests with real database interactions
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { seedTestData, cleanupTestData, createTestDocument } from '../setup/fixtures.ts'
import { REAL_DATA_IDS, validateConfig } from '../config.ts'

validateConfig()

Deno.test('RAG Chat Integration - End-to-end with real database', async () => {
  // Setup
  await seedTestData()
  const user = await createTestUser()
  
  // Create test document with pages
  const documentId = await createTestDocument(REAL_DATA_IDS.courseId, REAL_DATA_IDS.topicId)
  
  try {
    // Test RAG chat with real data
    const response = await callEdgeFunction(
      'rag-chat',
      {
        message: 'What is the test topic about?',
        courseId: REAL_DATA_IDS.courseId,
        topicId: REAL_DATA_IDS.topicId,
      },
      user.token
    )

    // Should accept 200 (success), 404 (no documents), or 429 (rate limited)
    assert(
      [200, 404, 429].includes(response.status),
      `Expected 200/404/429, got ${response.status}: ${JSON.stringify(response.data)}`
    )

    if (response.status === 200) {
      assert(response.data.answer, 'Response should include answer')
      assert(Array.isArray(response.data.citations), 'Response should include citations')
      assert(response.data.answer.length > 0, 'Answer should not be empty')
    }
  } finally {
    // Cleanup
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('RAG Chat Integration - Topic-specific query', async () => {
  await seedTestData()
  const user = await createTestUser()
  
  try {
    const response = await callEdgeFunction(
      'rag-chat',
      {
        message: 'Explain the concept',
        courseId: REAL_DATA_IDS.courseId,
        topicId: REAL_DATA_IDS.topicId,
      },
      user.token
    )

    assert(
      [200, 404, 429].includes(response.status),
      `Expected 200/404/429, got ${response.status}`
    )
  } finally {
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('RAG Chat Integration - Question context query', async () => {
  await seedTestData()
  const user = await createTestUser()
  
  try {
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

    assert(
      [200, 404, 429].includes(response.status),
      `Expected 200/404/429, got ${response.status}`
    )
  } finally {
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

