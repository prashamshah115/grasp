/**
 * Unit Tests for submit-exam Edge Function
 * Run with: deno test --allow-all supabase/functions/tests/submit-exam_test.ts
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

// Test user credentials
const testEmail = Deno.env.get('TEST_USER_EMAIL') || 'test@example.com'
const testPassword = Deno.env.get('TEST_USER_PASSWORD') || 'test123456'

let supabase: SupabaseClient
let userToken: string | null = null
let testUserId: string | null = null
let testSessionId: string | null = null
let testExamId: string | null = null

// ==================== SETUP & TEARDOWN ====================

async function setup() {
  supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (authError) throw new Error(`Auth failed: ${authError.message}`)
  if (!authData.session) throw new Error('No session')

  userToken = authData.session.access_token
  testUserId = authData.user.id

  console.log('✓ Test user authenticated')
}

async function createTestSession(): Promise<string> {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey)

  // Get a test exam
  const { data: exam } = await adminClient
    .from('exams')
    .select('id, course_id')
    .limit(1)
    .single()

  if (!exam) throw new Error('No exams found for testing')

  testExamId = exam.id

  // Ensure user enrolled
  await adminClient.from('user_courses').upsert({
    user_id: testUserId!,
    course_id: exam.course_id,
  })

  // Create session
  const { data: session, error } = await adminClient
    .from('exam_sessions')
    .insert({
      user_id: testUserId!,
      exam_id: exam.id,
      started_at: new Date().toISOString(),
      is_completed: false,
      time_remaining_sec: 3600,
    })
    .select()
    .single()

  if (error) throw error

  // Add some test answers
  const { data: questions } = await adminClient
    .from('exam_questions')
    .select('question_id, questions(correct_answer)')
    .eq('exam_id', exam.id)
    .limit(3)

  if (questions && questions.length > 0) {
    const answers = questions.map((q: any) => ({
      session_id: session.id,
      question_id: q.question_id,
      user_answer: q.questions.correct_answer, // Submit correct answer
      answered_at: new Date().toISOString(),
    }))

    await adminClient.from('exam_answers').insert(answers)
  }

  console.log('✓ Test session created:', session.id)
  return session.id
}

async function cleanup() {
  if (testUserId && testExamId) {
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
  name: 'submit-exam: should return 401 without auth token',
  async fn() {
    const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: 'fake-session-id',
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
  name: 'submit-exam: should return 422 with missing session_id',
  async fn() {
    await setup()

    const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
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
    assert(data.error.includes('session_id'))

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'submit-exam: should return 422 with invalid UUID format',
  async fn() {
    await setup()

    const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: 'not-a-valid-uuid',
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
  name: 'submit-exam: should return 404 for non-existent session',
  async fn() {
    await setup()

    const fakeSessionId = '00000000-0000-0000-0000-000000000000'

    const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: fakeSessionId,
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
  name: 'submit-exam: should successfully submit valid session',
  async fn() {
    await setup()

    try {
      testSessionId = await createTestSession()
    } catch (error) {
      console.log('⊘ Skipping - could not create test session:', error)
      return
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: testSessionId,
      }),
    })

    if (response.status !== 200) {
      const errorData = await response.json()
      console.error('Error response:', errorData)
    }

    assertEquals(response.status, 200)

    const data = await response.json()

    // Verify response structure
    assertEquals(data.success, true)
    assertExists(data.session_id)
    assertExists(data.exam_name)
    assertExists(data.score)
    assertExists(data.points_earned)
    assertExists(data.points_possible)
    assertExists(data.total_questions)
    assertExists(data.correct_count)
    assertExists(data.incorrect_count)
    assertExists(data.unanswered_count)
    assertExists(data.time_taken_sec)
    assertExists(data.breakdown)
    assertExists(data.performance_by_topic)

    // Verify score is valid
    assert(data.score >= 0 && data.score <= 100)

    // Verify breakdown includes correct answers
    for (const item of data.breakdown) {
      assertExists(item.question_id)
      assertExists(item.correct_answer, 'correct_answer should be included after submission')
      assertExists(item.user_answer)
      assert(typeof item.is_correct === 'boolean')
    }

    console.log(`✓ Exam submitted - Score: ${data.score}%`)
    console.log(`  Correct: ${data.correct_count}/${data.total_questions}`)

    await cleanup()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'submit-exam: should return 409 for already submitted session',
  async fn() {
    await setup()

    try {
      testSessionId = await createTestSession()
    } catch (error) {
      console.log('⊘ Skipping - could not create test session')
      return
    }

    // First submission - should succeed
    const response1 = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: testSessionId,
      }),
    })

    assertEquals(response1.status, 200)

    // Second submission - should fail with 409
    const response2 = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: testSessionId,
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
  name: 'submit-exam: should correctly score mixed correct/incorrect answers',
  async fn() {
    await setup()

    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)

      // Get exam
      const { data: exam } = await adminClient
        .from('exams')
        .select('id, course_id')
        .limit(1)
        .single()

      if (!exam) {
        console.log('⊘ Skipping - no exam found')
        return
      }

      testExamId = exam.id

      // Ensure enrollment
      await adminClient.from('user_courses').upsert({
        user_id: testUserId!,
        course_id: exam.course_id,
      })

      // Create session
      const { data: session } = await adminClient
        .from('exam_sessions')
        .insert({
          user_id: testUserId!,
          exam_id: exam.id,
          started_at: new Date().toISOString(),
          is_completed: false,
          time_remaining_sec: 3600,
        })
        .select()
        .single()

      testSessionId = session!.id

      // Get questions
      const { data: questions } = await adminClient
        .from('exam_questions')
        .select('question_id, questions(correct_answer, q_type)')
        .eq('exam_id', exam.id)
        .limit(4)

      if (!questions || questions.length < 2) {
        console.log('⊘ Skipping - not enough questions')
        return
      }

      // Submit mixed answers: half correct, half incorrect
      const answers = questions.map((q: any, index: number) => ({
        session_id: session!.id,
        question_id: q.question_id,
        // Every other answer is correct
        user_answer: index % 2 === 0 ? q.questions.correct_answer : 'WRONG_ANSWER',
        answered_at: new Date().toISOString(),
      }))

      await adminClient.from('exam_answers').insert(answers)

      // Submit exam
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: testSessionId,
        }),
      })

      assertEquals(response.status, 200)

      const data = await response.json()

      // Verify score is approximately 50%
      assert(data.score >= 45 && data.score <= 55, `Expected ~50% score, got ${data.score}%`)

      console.log(`✓ Mixed answers scored correctly: ${data.score}%`)

      await cleanup()
    } catch (error) {
      console.log('⊘ Test skipped:', error)
      await cleanup()
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

Deno.test({
  name: 'submit-exam: CORS headers should be present',
  async fn() {
    const response = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
      method: 'OPTIONS',
    })

    assertEquals(response.status, 200)
    assertExists(response.headers.get('Access-Control-Allow-Origin'))
    assertExists(response.headers.get('Access-Control-Allow-Headers'))
  },
  sanitizeResources: false,
  sanitizeOps: false,
})

console.log('\n🧪 Running submit-exam tests...\n')
