/**
 * Unit Tests for start-exam-session Edge Function
 * Run with: deno test --allow-all supabase/functions/tests/start-exam-session_test.ts
 */

import {
  assert,
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.192.0/testing/asserts.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('PUBLIC_SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

// Test user credentials (set these in your test environment)
const testEmail = Deno.env.get('TEST_USER_EMAIL') || 'test@example.com'
const testPassword = Deno.env.get('TEST_USER_PASSWORD') || 'test123456'

let supabase: SupabaseClient
let userToken: string | null = null
let testUserId: string | null = null
let testCourseId: string | null = null
let testExamId: string | null = null

// ==================== SETUP & TEARDOWN ====================

/**
 * Setup: Login test user and get auth token
 */
async function setup() {
  supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Login test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (authError) {
    console.error('Auth error during setup:', authError)
    throw new Error(`Failed to authenticate test user: ${authError.message}`)
  }

  if (!authData.session) {
    throw new Error('No session returned from auth')
  }

  userToken = authData.session.access_token
  testUserId = authData.user.id

  console.log('✓ Test user authenticated')

  // Get or create test course
  const { data: courses } = await supabase.from('courses').select('id').limit(1).single()

  if (courses) {
    testCourseId = courses.id
    console.log('✓ Using existing course:', testCourseId)
  } else {
    console.warn('⚠ No courses found - some tests will be skipped')
  }

  // Get or create test exam
  if (testCourseId) {
    const { data: exams } = await supabase
      .from('exams')
      .select('id')
      .eq('course_id', testCourseId)
      .limit(1)
      .single()

    if (exams) {
      testExamId = exams.id
      console.log('✓ Using existing exam:', testExamId)
    } else {
      console.warn('⚠ No exams found - some tests will be skipped')
    }
  }
}

/**
 * Cleanup: Remove test data
 */
async function cleanup() {
  if (testUserId && testExamId) {
    // Delete test exam sessions
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    await adminClient
      .from('exam_sessions')
      .delete()
      .eq('user_id', testUserId)
      .eq('exam_id', testExamId)

    console.log('✓ Cleanup complete')
  }
}

// ==================== TESTS ====================

Deno.test({
  name: 'start-exam-session: should return 401 without auth token',
  async fn() {
    const response = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exam_id: 'fake-exam-id',
      }),
    })

    assertEquals(response.status, 401)

    const data = await response.json()
    assertExists(data.error)
    assertEquals(data.code, 'UNAUTHORIZED')
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'start-exam-session: should return 422 with missing exam_id',
  async fn() {
    await setup()

    const response = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    assertEquals(response.status, 422)

    const data = await response.json()
    assertExists(data.error)
    assert(data.error.includes('exam_id'))

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'start-exam-session: should return 422 with invalid UUID format',
  async fn() {
    await setup()

    const response = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exam_id: 'not-a-valid-uuid',
      }),
    })

    assertEquals(response.status, 422)

    const data = await response.json()
    assertExists(data.error)

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'start-exam-session: should return 404 for non-existent exam',
  async fn() {
    await setup()

    const fakeExamId = '00000000-0000-0000-0000-000000000000'

    const response = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exam_id: fakeExamId,
      }),
    })

    assertEquals(response.status, 404)

    const data = await response.json()
    assertExists(data.error)
    assertEquals(data.code, 'NOT_FOUND')

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'start-exam-session: should successfully create session for valid exam',
  async fn() {
    await setup()

    if (!testExamId) {
      console.log('⊘ Skipping - no test exam available')
      return
    }

    // Ensure user is enrolled in course
    if (testCourseId && testUserId) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      await adminClient.from('user_courses').upsert({
        user_id: testUserId,
        course_id: testCourseId,
      })
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exam_id: testExamId,
      }),
    })

    if (response.status !== 200) {
      const errorData = await response.json()
      console.error('Error response:', errorData)
    }

    assertEquals(response.status, 200)

    const data = await response.json()

    // Verify response structure
    assertExists(data.session_id)
    assertExists(data.exam)
    assertExists(data.questions)
    assertExists(data.started_at)
    assertExists(data.ends_at)
    assertExists(data.time_remaining_sec)

    // Verify exam details
    assertEquals(data.exam.id, testExamId)
    assert(data.exam.total_questions > 0)
    assert(data.exam.duration_minutes > 0)

    // Verify questions don't include correct answers
    for (const question of data.questions) {
      assertExists(question.id)
      assertExists(question.prompt)
      assertExists(question.q_type)
      assertEquals(question.correct_answer, undefined, 'correct_answer should be omitted')
    }

    console.log(`✓ Session created with ${data.questions.length} questions`)

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'start-exam-session: should return 409 for duplicate active session',
  async fn() {
    await setup()

    if (!testExamId) {
      console.log('⊘ Skipping - no test exam available')
      return
    }

    // Ensure user is enrolled
    if (testCourseId && testUserId) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      await adminClient.from('user_courses').upsert({
        user_id: testUserId,
        course_id: testCourseId,
      })
    }

    // First request - should succeed
    const response1 = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exam_id: testExamId,
      }),
    })

    assertEquals(response1.status, 200)

    // Second request - should fail with 409
    const response2 = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exam_id: testExamId,
      }),
    })

    assertEquals(response2.status, 409)

    const data = await response2.json()
    assertExists(data.error)
    assertEquals(data.code, 'CONFLICT')

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'start-exam-session: CORS headers should be present',
  async fn() {
    const response = await fetch(`${supabaseUrl}/functions/v1/start-exam-session`, {
      method: 'OPTIONS',
    })

    assertEquals(response.status, 200)
    assertExists(response.headers.get('Access-Control-Allow-Origin'))
    assertExists(response.headers.get('Access-Control-Allow-Headers'))
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

console.log('\n🧪 Running start-exam-session tests...\n')
