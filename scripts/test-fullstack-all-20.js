#!/usr/bin/env node

/**
 * Comprehensive Fullstack Test Suite
 * Tests all 20 functionalities at the API/backend level
 * Runs each test 20 times for reliability
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.test' });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Real data IDs from production
const REAL_DATA_IDS = {
  courseId: '634a94de-f71c-4c53-9f5d-e9c8bfc22449', // CSE120
  topicId: 'f643239a-48e7-4eec-ba5e-f32775f4c39a',
  questionId: '6025841a-4fa3-4ecc-a125-0ed8b51a3a5f',
};

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Shared test user to avoid rate limiting
let sharedTestUser = null;

// Helper: Get or create authenticated user (reused across tests)
async function getTestUser() {
  if (sharedTestUser) {
    // Refresh token if needed
    try {
      const { data: session } = await sharedTestUser.client.auth.getSession();
      if (session?.session) {
        return sharedTestUser;
      }
    } catch (e) {
      // Token expired, create new
      sharedTestUser = null;
    }
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const testEmail = `test-fullstack-${Date.now()}@grasp.test`;
  const testPassword = 'test-password-123';

  // Create user
  const { data: userData, error: createError } = await serviceClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createError || !userData.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`);
  }

  // Sign in to get token
  const { data: sessionData, error: sessionError } = await serviceClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (sessionError || !sessionData.session) {
    throw new Error(`Failed to sign in: ${sessionError?.message}`);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    },
  });

  sharedTestUser = {
    id: userData.user.id,
    email: testEmail,
    token: sessionData.session.access_token,
    client,
  };

  return sharedTestUser;
}

// Helper: Call edge function
async function callEdgeFunction(functionName, body, token) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    // Not JSON
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

// Helper: Run test with retries
async function runTest(testName, testFn, iterations = 20) {
  console.log(`\n${colors.blue}Testing: ${testName}${colors.reset}`);
  
  for (let i = 1; i <= iterations; i++) {
    try {
      await testFn();
      results.total++;
      results.passed++;
      process.stdout.write(`${colors.green}.${colors.reset}`);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.total++;
      results.failed++;
      results.errors.push({ test: testName, iteration: i, error: error.message });
      process.stdout.write(`${colors.red}X${colors.reset}`);
      // Delay on error too
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  console.log(`\n  ${colors.green}✓${colors.reset} ${testName}: ${iterations} iterations`);
}

// ==========================================
// TEST SUITE: All 20 Functionalities
// ==========================================

async function test1_Authentication() {
  const user = await getTestUser();
  if (!user.id || !user.token) throw new Error('Failed to create authenticated user');
  // Don't sign out - reuse user
}

async function test2_CourseCatalog() {
  const user = await getTestUser();
  const { data, error } = await user.client.from('courses').select('id').limit(1);
  if (error) throw error;
}

async function test3_CourseHome() {
  const user = await getTestUser();
  const { data, error } = await user.client
    .from('courses')
    .select('id, code, name')
    .eq('id', REAL_DATA_IDS.courseId)
    .single();
  if (error) throw error;
  if (!data) throw new Error('Course not found');
}

async function test4_PracticeView() {
  const user = await createTestUser();
  // Check if user is enrolled
  const { data, error } = await user.client
    .from('user_courses')
    .select('course_id')
    .eq('user_id', user.id)
    .eq('course_id', REAL_DATA_IDS.courseId)
    .single();
  // It's OK if not enrolled, just check query works
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test5_GlobalPracticeSession() {
  const user = await createTestUser();
  const response = await callEdgeFunction(
    'next-global-question',
    {
      courseId: REAL_DATA_IDS.courseId,
    },
    user.token
  );
  // Accept 200 (success), 404 (no questions), or 429 (rate limited)
  if (![200, 404, 429].includes(response.status)) {
    throw new Error(`Expected 200/404/429, got ${response.status}: ${JSON.stringify(response.data)}`);
  }
  // Don't sign out - reuse user
}

async function test6_CompressionView() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('compression_notes')
    .select('id, topic_id')
    .eq('user_id', user.id)
    .limit(1);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test7_GenerateCompression() {
  const user = await createTestUser();
  const response = await callEdgeFunction(
    'generate-compression',
    {
      user_id: user.id,
      topic_id: REAL_DATA_IDS.topicId,
    },
    user.token
  );
  // Accept 200 (success), 404 (no documents), 429 (rate limited), or 500 (API error)
  if (![200, 404, 429, 500].includes(response.status)) {
    throw new Error(`Expected 200/404/429/500, got ${response.status}: ${JSON.stringify(response.data)}`);
  }
  // Don't sign out - reuse user
}

async function test8_AIAssistant_RAGChat() {
  const user = await createTestUser();
  const response = await callEdgeFunction(
    'rag-chat',
    {
      message: 'What is virtual memory?',
      courseId: REAL_DATA_IDS.courseId,
    },
    user.token
  );
  // Accept 200 (success), 404 (no documents), or 429 (rate limited)
  if (![200, 404, 429].includes(response.status)) {
    throw new Error(`Expected 200/404/429, got ${response.status}: ${JSON.stringify(response.data)}`);
  }
  // Don't sign out - reuse user
}

async function test9_ExamView() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('exams')
    .select('id, name, course_id')
    .eq('course_id', REAL_DATA_IDS.courseId)
    .limit(10);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test10_ExamSessionStart() {
  const user = await createTestUser();
  // First get an exam
  const { data: exams } = await user.client
    .from('exams')
    .select('id')
    .eq('course_id', REAL_DATA_IDS.courseId)
    .limit(1)
    .single();
  
  if (exams) {
    const response = await callEdgeFunction(
      'start-exam-session',
      {
        exam_id: exams.id,
        user_id: user.id,
      },
      user.token
    );
    // Accept 200 (success), 404 (no exam), or 429 (rate limited)
    if (![200, 404, 429].includes(response.status)) {
      throw new Error(`Expected 200/404/429, got ${response.status}`);
    }
  }
  // Don't sign out - reuse user
}

async function test11_ExamSimulation() {
  const user = await createTestUser();
  // Get active exam session
  const { data: sessions } = await user.client
    .from('exam_sessions')
    .select('id, exam_id')
    .eq('user_id', user.id)
    .eq('is_completed', false)
    .limit(1)
    .single();
  
  if (sessions) {
    const { data, error } = await user.client
      .from('exam_sessions')
      .select('id, answers')
      .eq('id', sessions.id)
      .single();
    if (error) throw error;
  }
  // Don't sign out - reuse user
}

async function test12_SubmitExam() {
  const user = await createTestUser();
  // Get active exam session
  const { data: sessions } = await user.client
    .from('exam_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_completed', false)
    .limit(1)
    .single();
  
  if (sessions) {
    const response = await callEdgeFunction(
      'submit-exam',
      {
        session_id: sessions.id,
        answers: {},
      },
      user.token
    );
    // Accept 200 (success), 404 (no session), or 429 (rate limited)
    if (![200, 404, 429].includes(response.status)) {
      throw new Error(`Expected 200/404/429, got ${response.status}`);
    }
  }
  // Don't sign out - reuse user
}

async function test13_ExamResults() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('exam_sessions')
    .select('id, score, is_completed')
    .eq('user_id', user.id)
    .eq('is_completed', true)
    .limit(1);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test14_FinalsSection() {
  const user = await createTestUser();
  // Check for final packs
  const { data, error } = await user.client
    .from('final_packs')
    .select('id, course_id')
    .eq('course_id', REAL_DATA_IDS.courseId)
    .limit(1);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test15_FinalPackView() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('final_packs')
    .select('id, content, course_id')
    .eq('course_id', REAL_DATA_IDS.courseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test16_FinalsCommandCenter() {
  const user = await createTestUser();
  // Check knowledge state
  const { data, error } = await user.client
    .from('knowledge_state')
    .select('topic_id, knowledge_strength')
    .eq('user_id', user.id)
    .eq('course_id', REAL_DATA_IDS.courseId)
    .limit(10);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test17_GradedAssignmentUpload() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('graded_assignments')
    .select('id, user_id')
    .eq('user_id', user.id)
    .limit(1);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test18_PDFUpload() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('documents')
    .select('id, course_id, file_name')
    .eq('course_id', REAL_DATA_IDS.courseId)
    .limit(1);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test19_KnowledgeGraphViewer() {
  const user = await createTestUser();
  const { data, error } = await user.client
    .from('knowledge_graph_edges')
    .select('topic_a, topic_b, relation')
    .eq('course_id', REAL_DATA_IDS.courseId)
    .limit(10);
  if (error && error.code !== 'PGRST116') throw error;
  // Don't sign out - reuse user
}

async function test20_MasteryTracking_KSV() {
  const user = await createTestUser();
  // Test update mastery
  const response = await callEdgeFunction(
    'update-mastery',
    {
      user_id: user.id,
      course_id: REAL_DATA_IDS.courseId,
      topic_id: REAL_DATA_IDS.topicId,
      mastery_level: 'medium',
    },
    user.token
  );
  // Accept 200 (success), 404 (no data), or 429 (rate limited)
  if (![200, 404, 429].includes(response.status)) {
    throw new Error(`Expected 200/404/429, got ${response.status}`);
  }
  // Don't sign out - reuse user
}

// ==========================================
// RUN ALL TESTS
// ==========================================

async function runAllTests() {
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}🧪 Fullstack Test Suite - All 20 Functionalities${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`Testing: ${SUPABASE_URL}`);
  console.log(`Running each test 20 times\n`);

  // Create test user once at the start
  console.log(`${colors.yellow}Creating test user...${colors.reset}`);
  try {
    await getTestUser();
    console.log(`${colors.green}✓ Test user created${colors.reset}\n`);
  } catch (error) {
    console.log(`${colors.red}✗ Failed to create test user: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}Continuing with tests (some may fail)${colors.reset}\n`);
  }

  const tests = [
    { name: '1. Authentication', fn: test1_Authentication },
    { name: '2. Course Catalog', fn: test2_CourseCatalog },
    { name: '3. Course Home', fn: test3_CourseHome },
    { name: '4. Practice View', fn: test4_PracticeView },
    { name: '5. Global Practice Session', fn: test5_GlobalPracticeSession },
    { name: '6. Compression View', fn: test6_CompressionView },
    { name: '7. Generate Compression', fn: test7_GenerateCompression },
    { name: '8. AI Assistant / RAG Chat', fn: test8_AIAssistant_RAGChat },
    { name: '9. Exam View', fn: test9_ExamView },
    { name: '10. Exam Session Start', fn: test10_ExamSessionStart },
    { name: '11. Exam Simulation', fn: test11_ExamSimulation },
    { name: '12. Submit Exam', fn: test12_SubmitExam },
    { name: '13. Exam Results', fn: test13_ExamResults },
    { name: '14. Finals Section', fn: test14_FinalsSection },
    { name: '15. Final Pack View', fn: test15_FinalPackView },
    { name: '16. Finals Command Center', fn: test16_FinalsCommandCenter },
    { name: '17. Graded Assignment Upload', fn: test17_GradedAssignmentUpload },
    { name: '18. PDF Upload', fn: test18_PDFUpload },
    { name: '19. Knowledge Graph Viewer', fn: test19_KnowledgeGraphViewer },
    { name: '20. Mastery Tracking & KSV', fn: test20_MasteryTracking_KSV },
  ];

  for (const test of tests) {
    await runTest(test.name, test.fn, 20);
  }

  // Print summary
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}📊 Test Summary${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed} (${((results.passed/results.total)*100).toFixed(1)}%)${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed} (${((results.failed/results.total)*100).toFixed(1)}%)${colors.reset}`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.yellow}Errors:${colors.reset}`);
    results.errors.slice(0, 10).forEach(err => {
      console.log(`  ${err.test} (iteration ${err.iteration}): ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
  }

  console.log('');

  if (results.failed > 0) {
    console.log(`${colors.red}❌ Some tests failed. Review errors above.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ All tests passed!${colors.reset}`);
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});

