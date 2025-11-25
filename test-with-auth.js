/**
 * Comprehensive AI Features Testing with Authentication
 * Tests RAG Chat and Compression with quality validation
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'prashamshah115@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// Test data IDs
const TEST_COURSE_ID = process.env.TEST_COURSE_ID || '11111111-1111-1111-1111-111111111111';
const TEST_TOPIC_ID = process.env.TEST_TOPIC_ID || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_QUESTION_ID = process.env.TEST_QUESTION_ID || 'qqqqqqqq-1111-1111-1111-111111111111';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let testsPassed = 0;
let testsFailed = 0;

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function authenticate() {
  log('\n🔐 Authenticating...', 'cyan');
  
  // Try to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (!signInError && signInData?.session) {
    log('✅ Authenticated successfully', 'green');
    return signInData.session.access_token;
  }
  
  // Try sign up if sign in fails
  log('⚠️  Sign in failed, trying sign up...', 'yellow');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (signUpError) {
    log(`❌ Authentication failed: ${signUpError.message}`, 'red');
    log('Please check your credentials or create the user manually', 'yellow');
    process.exit(1);
  }
  
  if (signUpData?.session) {
    log('✅ Signed up and authenticated', 'green');
    return signUpData.session.access_token;
  }
  
  log('❌ No session returned. Email confirmation may be required.', 'red');
  process.exit(1);
}

async function testEndpoint(name, endpoint, body, expectedFields = []) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Test: ${name}`, 'cyan');
  log('='.repeat(60), 'blue');
  
  const token = await authenticate();
  const url = `${SUPABASE_URL}/functions/v1/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      log(`❌ Failed (HTTP ${response.status})`, 'red');
      console.log(JSON.stringify(data, null, 2));
      testsFailed++;
      return null;
    }
    
    // Check expected fields
    for (const field of expectedFields) {
      if (!data[field]) {
        log(`❌ Missing field: ${field}`, 'red');
        testsFailed++;
        return null;
      }
    }
    
    log('✅ Success', 'green');
    console.log(JSON.stringify(data, null, 2));
    testsPassed++;
    return data;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    testsFailed++;
    return null;
  }
}

function validateRAGQuality(response) {
  log('\n📊 Quality Validation:', 'cyan');
  let score = 0;
  const maxScore = 5;
  
  const answer = response.answer || '';
  
  // Check length
  if (answer.length > 500) {
    log(`  ✓ Comprehensive response (${answer.length} chars)`, 'green');
    score++;
  } else {
    log(`  ⚠ Response might be too short (${answer.length} chars)`, 'yellow');
  }
  
  // Check citations
  if (response.citations && response.citations.length > 0) {
    log(`  ✓ Has citations (${response.citations.length} sources)`, 'green');
    score++;
  }
  
  // Check structure
  if (/^[-*]|^[0-9]+\.|^##/m.test(answer)) {
    log('  ✓ Structured format', 'green');
    score++;
  }
  
  // Check examples
  if (/example|for instance|such as|analogy|like/i.test(answer)) {
    log('  ✓ Includes examples', 'green');
    score++;
  }
  
  // Check core concepts
  if (/is|are|means|refers to|definition/i.test(answer)) {
    log('  ✓ Explains core concepts', 'green');
    score++;
  }
  
  log(`\n  Quality Score: ${score}/${maxScore}`, 'cyan');
  if (score >= maxScore * 0.75) {
    log('  ✅ Excellent quality!', 'green');
  } else if (score >= maxScore * 0.5) {
    log('  ⚠️  Good, but could be improved', 'yellow');
  } else {
    log('  ❌ Needs improvement', 'red');
  }
}

function validateCompressionQuality(response) {
  log('\n📊 Quality Validation:', 'cyan');
  let score = 0;
  const maxScore = 7;
  
  const content = response.content || '';
  
  // Check section headers
  const headers = (content.match(/^##/gm) || []).length;
  if (headers > 0) {
    log(`  ✓ Has section headers (${headers} sections)`, 'green');
    score++;
  }
  
  // Check bold terms
  const boldMatches = content.match(/\*\*[^*]+\*\*/g) || [];
  if (boldMatches.length > 0) {
    log(`  ✓ Has bold terms (${boldMatches.length} terms)`, 'green');
    score++;
  }
  
  // Check code blocks
  if (content.includes('```')) {
    log('  ✓ Has code blocks', 'green');
    score++;
  }
  
  // Check bullets
  const bullets = (content.match(/^-/gm) || []).length;
  if (bullets >= 15) {
    log(`  ✓ Sufficient bullets (${bullets} points)`, 'green');
    score++;
  } else {
    log(`  ⚠ Fewer than 15 bullets (${bullets} points)`, 'yellow');
  }
  
  // Check categories
  const categoryKeywords = ['Definition', 'Concept', 'Process', 'Formula', 'Application', 'Pitfall', 'Exam'];
  const foundCategories = categoryKeywords.filter(keyword => 
    new RegExp(keyword, 'i').test(content)
  ).length;
  if (foundCategories >= 5) {
    log(`  ✓ Multiple categories covered (${foundCategories}/7)`, 'green');
    score++;
  }
  
  // Check length
  if (content.length > 2000) {
    log(`  ✓ Comprehensive content (${content.length} chars)`, 'green');
    score++;
  }
  
  // Check ground-up explanations
  if (/fundamental|basic|core|first|principle|ground/i.test(content)) {
    log('  ✓ Ground-up explanations', 'green');
    score++;
  }
  
  log(`\n  Quality Score: ${score}/${maxScore}`, 'cyan');
  if (score >= maxScore * 0.75) {
    log('  ✅ Excellent quality!', 'green');
  } else if (score >= maxScore * 0.5) {
    log('  ⚠️  Good, but could be improved', 'yellow');
  } else {
    log('  ❌ Needs improvement', 'red');
  }
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║     GRASP AI Chat & Compression Testing Suite        ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
  
  log(`\n✅ Configuration loaded`, 'green');
  log(`   URL: ${SUPABASE_URL}`, 'cyan');
  log(`   Course ID: ${TEST_COURSE_ID}`, 'cyan');
  log(`   Topic ID: ${TEST_TOPIC_ID}`, 'cyan');
  
  // Test 1: Basic RAG Chat
  const rag1 = await testEndpoint(
    'Basic RAG Chat (No Context)',
    'rag-chat',
    {
      message: 'What is virtual memory? Explain it comprehensively.',
      courseId: TEST_COURSE_ID,
    },
    ['answer']
  );
  if (rag1) validateRAGQuality(rag1);
  
  // Test 2: Topic-Specific RAG Chat
  const rag2 = await testEndpoint(
    'Topic-Specific RAG Chat',
    'rag-chat',
    {
      message: 'Explain processes and threads in detail. Compare and contrast them.',
      courseId: TEST_COURSE_ID,
      topicId: TEST_TOPIC_ID,
    },
    ['answer', 'citations']
  );
  if (rag2) validateRAGQuality(rag2);
  
  // Test 3: Question Context Chat
  await testEndpoint(
    'Question Context Chat',
    'rag-chat',
    {
      message: 'Help me understand this question better',
      courseId: TEST_COURSE_ID,
      topicId: TEST_TOPIC_ID,
      questionId: TEST_QUESTION_ID,
    },
    ['answer']
  );
  
  // Test 4: Complex Multi-Part Question
  const rag4 = await testEndpoint(
    'Complex Multi-Part Question',
    'rag-chat',
    {
      message: 'Compare and contrast processes and threads. Include examples, use cases, and explain when to use each. Provide step-by-step explanations.',
      courseId: TEST_COURSE_ID,
      topicId: TEST_TOPIC_ID,
    },
    ['answer', 'citations']
  );
  if (rag4) validateRAGQuality(rag4);
  
  // Test 5: Compression Generation
  log(`\n${'='.repeat(60)}`, 'blue');
  log('Test: Compression Generation', 'cyan');
  log('='.repeat(60), 'blue');
  log('Generating compression notes (this may take 30-60 seconds)...', 'yellow');
  
  const token = await authenticate();
  const compressionResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-compression`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicId: TEST_TOPIC_ID,
    }),
  });
  
  const compressionData = await compressionResponse.json();
  
  if (compressionResponse.ok) {
    log('✅ Compression Generated', 'green');
    log('\n📄 Content Preview (first 500 chars):', 'cyan');
    console.log((compressionData.content || '').substring(0, 500) + '...\n');
    validateCompressionQuality(compressionData);
    testsPassed++;
  } else {
    log(`❌ Compression Failed (HTTP ${compressionResponse.status})`, 'red');
    console.log(JSON.stringify(compressionData, null, 2));
    testsFailed++;
  }
  
  // Summary
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║                    Test Summary                       ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
  log(`\n  ✅ Passed: ${testsPassed}`, 'green');
  log(`  ❌ Failed: ${testsFailed}`, 'red');
  
  if (testsFailed === 0) {
    log('\n🎉 All tests passed! Your AI features are working perfectly!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Check the output above for details.', 'yellow');
    process.exit(1);
  }
}

runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});


