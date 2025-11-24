/**
 * Database Tests - RLS Policies
 * Tests Row Level Security policies
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { callEdgeFunction, getSharedTestUser } from '../utils/helpers.ts'
import { seedTestData, cleanupTestData } from '../setup/fixtures.ts'
import { REAL_DATA_IDS, validateConfig } from '../config.ts'

validateConfig()

Deno.test('RLS - User can view own courses', async () => {
  await seedTestData()
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  
  const serviceClient = getServiceClient()
  
  // Create course enrollment for user1
  const { data: enrollment } = await serviceClient
    .from('user_courses')
    .insert({
      user_id: user1.id,
      course_id: REAL_DATA_IDS.courseId,
    })
    .select()
    .single()
  
  try {
    // User1 should see their own enrollment
    const { data: user1Courses, error: user1Error } = await user1.client
      .from('user_courses')
      .select('*')
      .eq('course_id', REAL_DATA_IDS.courseId)
    
    assert(!user1Error, 'User1 should be able to query their courses')
    assert(user1Courses && user1Courses.length > 0, 'User1 should see their enrollment')
    assert(user1Courses[0].user_id === user1.id, 'Enrollment should belong to user1')
    
    // User2 should NOT see user1's enrollment
    const { data: user2Courses, error: user2Error } = await user2.client
      .from('user_courses')
      .select('*')
      .eq('course_id', REAL_DATA_IDS.courseId)
    
    // Should either return empty array or error
    assert(
      !user2Courses || user2Courses.length === 0,
      'User2 should not see user1\'s enrollment'
    )
  } finally {
    await user1.client.auth.signOut()
    await user2.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('RLS - User can insert own courses', async () => {
  await seedTestData()
  const user = await createTestUser()
  
  try {
    const { data, error } = await user.client
      .from('user_courses')
      .insert({
        user_id: user.id,
        course_id: REAL_DATA_IDS.courseId,
      })
      .select()
      .single()
    
    assert(!error, 'User should be able to insert their own enrollment')
    assert(data, 'Insert should return data')
    assertEquals(data.user_id, user.id, 'Enrollment should belong to user')
  } finally {
    await user.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('RLS - User cannot insert courses for others', async () => {
  await seedTestData()
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  
  try {
    // Try to insert enrollment for user2 as user1
    const { error } = await user1.client
      .from('user_courses')
      .insert({
        user_id: user2.id, // Different user
        course_id: REAL_DATA_IDS.courseId,
      })
    
    // Should fail due to RLS
    assert(error, 'Should not be able to insert enrollment for another user')
  } finally {
    await user1.client.auth.signOut()
    await user2.client.auth.signOut()
    await cleanupTestData()
  }
})

Deno.test('RLS - User can view own question history', async () => {
  await seedTestData()
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  
  const serviceClient = getServiceClient()
  
  // Create question history for user1
  const { data: history } = await serviceClient
    .from('question_history')
    .insert({
      user_id: user1.id,
      question_id: REAL_DATA_IDS.questionId,
      times_seen: 1,
      times_correct: 1,
      last_seen: new Date().toISOString(),
      next_review: new Date().toISOString(),
    })
    .select()
    .single()
  
  try {
    // User1 should see their own history
    const { data: user1History, error: user1Error } = await user1.client
      .from('question_history')
      .select('*')
      .eq('question_id', REAL_DATA_IDS.questionId)
    
    assert(!user1Error, 'User1 should be able to query their history')
    assert(user1History && user1History.length > 0, 'User1 should see their history')
    
    // User2 should NOT see user1's history
    const { data: user2History, error: user2Error } = await user2.client
      .from('question_history')
      .select('*')
      .eq('question_id', REAL_DATA_IDS.questionId)
    
    assert(
      !user2History || user2History.length === 0,
      'User2 should not see user1\'s history'
    )
  } finally {
    await user1.client.auth.signOut()
    await user2.client.auth.signOut()
    await cleanupTestData()
  }
})

