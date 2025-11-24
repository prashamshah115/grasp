/**
 * Performance Tests - Response Time Benchmarks
 */

import { assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { validateConfig } from '../config.ts'

validateConfig()

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  ragChat: 5000, // 5 seconds
  compression: 30000, // 30 seconds
  examStart: 1000, // 1 second
  questionFetch: 500, // 500ms
}

Deno.test('Performance - RAG Chat response time', async () => {
  const user = await createTestUser()
  
  const start = Date.now()
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'What is virtual memory?',
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )
  const duration = Date.now() - start
  
  console.log(`RAG Chat response time: ${duration}ms`)
  
  // Only check if request succeeded (not rate limited)
  if (response.status === 200) {
    assert(
      duration < THRESHOLDS.ragChat,
      `RAG Chat took ${duration}ms, expected < ${THRESHOLDS.ragChat}ms`
    )
  }

  await user.client.auth.signOut()
})

Deno.test('Performance - Compression generation response time', async () => {
  const user = await createTestUser()
  
  const start = Date.now()
  const response = await callEdgeFunction(
    'generate-compression',
    {
      topicId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )
  const duration = Date.now() - start
  
  console.log(`Compression generation response time: ${duration}ms`)
  
  // Only check if request succeeded
  if (response.status === 200) {
    assert(
      duration < THRESHOLDS.compression,
      `Compression took ${duration}ms, expected < ${THRESHOLDS.compression}ms`
    )
  }

  await user.client.auth.signOut()
})

Deno.test('Performance - Next question fetch response time', async () => {
  const user = await createTestUser()
  
  const start = Date.now()
  const response = await callEdgeFunction(
    'next-global-question',
    {
      courseId: '00000000-0000-0000-0000-000000000001',
    },
    user.token
  )
  const duration = Date.now() - start
  
  console.log(`Next question fetch response time: ${duration}ms`)
  
  // Only check if request succeeded
  if (response.status === 200) {
    assert(
      duration < THRESHOLDS.questionFetch,
      `Question fetch took ${duration}ms, expected < ${THRESHOLDS.questionFetch}ms`
    )
  }

  await user.client.auth.signOut()
})

Deno.test('Performance - Multiple concurrent requests', async () => {
  const user = await createTestUser()
  
  const start = Date.now()
  
  // Make 5 concurrent requests
  const requests = Array(5).fill(null).map(() =>
    callEdgeFunction(
      'next-global-question',
      {
        courseId: '00000000-0000-0000-0000-000000000001',
      },
      user.token
    )
  )
  
  const responses = await Promise.all(requests)
  const duration = Date.now() - start
  
  console.log(`5 concurrent requests completed in: ${duration}ms`)
  
  // All requests should complete
  const successCount = responses.filter(r => r.status === 200 || r.status === 404).length
  assert(
    successCount === 5,
    `Expected 5 successful responses, got ${successCount}`
  )
  
  // Should complete reasonably quickly (not sequential)
  assert(
    duration < THRESHOLDS.questionFetch * 3, // Allow some overhead
    `Concurrent requests took ${duration}ms, expected < ${THRESHOLDS.questionFetch * 3}ms`
  )

  await user.client.auth.signOut()
})

