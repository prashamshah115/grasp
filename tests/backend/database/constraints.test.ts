/**
 * Database Tests - Constraints
 * Tests database constraints (unique, foreign keys, etc.)
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { seedTestData, cleanupTestData } from '../setup/fixtures.ts'
import { REAL_DATA_IDS, validateConfig } from '../config.ts'

validateConfig()

Deno.test('Constraint - Unique enrollment (user_id, course_id)', async () => {
  await seedTestData()
  const user = await createTestUser()
  const serviceClient = getServiceClient()
  
  try {
    // Insert first enrollment
    const { error: firstError } = await serviceClient
      .from('user_courses')
      .insert({
        user_id: user.id,
        course_id: REAL_DATA_IDS.courseId,
      })
    
    assert(!firstError, 'First enrollment should succeed')
    
    // Try to insert duplicate enrollment
    const { error: duplicateError } = await serviceClient
      .from('user_courses')
      .insert({
        user_id: user.id,
        course_id: REAL_DATA_IDS.courseId,
      })
    
    // Should fail due to unique constraint
    assert(duplicateError, 'Duplicate enrollment should fail')
    assert(
      duplicateError.message.includes('duplicate') || duplicateError.code === '23505',
      'Error should indicate duplicate key violation'
    )
  } finally {
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('Constraint - Foreign key (course_id references courses)', async () => {
  await seedTestData()
  const user = await createTestUser()
  
  try {
    // Try to insert enrollment with invalid course_id
    const { error } = await user.client
      .from('user_courses')
      .insert({
        user_id: user.id,
        course_id: '00000000-0000-0000-0000-000000000999', // Non-existent course
      })
    
    // Should fail due to foreign key constraint
    assert(error, 'Should fail with invalid course_id')
  } finally {
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('Constraint - Foreign key (topic_id references topics)', async () => {
  await seedTestData()
  const serviceClient = getServiceClient()
  
  try {
    // Try to create question with invalid topic_id
    const { error } = await serviceClient
      .from('questions')
      .insert({
        topic_id: '00000000-0000-0000-0000-000000000999', // Non-existent topic
        prompt: 'Test question',
        type: 'multiple_choice',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        difficulty: 'easy',
      })
    
    // Should fail due to foreign key constraint
    assert(error, 'Should fail with invalid topic_id')
  } finally {
    await cleanupTestData()
  }
})

