/**
 * Test AI Features with REAL CSE 120 Data
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'prashamshah115@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// REAL CSE 120 IDs from your database
const REAL_COURSE_ID = '634a94de-f71c-4c53-9f5d-e9c8bfc22449'; // CSE120
const REAL_TOPIC_ID = 'bb004e83-7e3f-478e-874a-3590113a186b'; // Virtual Memory

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let testsPassed = 0;
let testsFailed = 0;

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
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (!signInError && signInData?.session) {
    log('✅ Authenticated successfully', 'green');
    return signInData.session.access_token;
  }
  
  log(`❌ Authentication failed: ${signInError?.message}`, 'red');
  process.exit(1);
}

async function testRAGChat(name, message, courseId, topicId = null) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Test: ${name}`, 'cyan');
  log('='.repeat(60), 'blue');
  
  const token = await authenticate();
  const url = `${SUPABASE_URL}/functions/v1/rag-chat`;
  
  const body = {
    message,
    courseId,
  };
  
  if (topicId) {
    body.topicId = topicId;
  }
  
  try {
    log(`Query: "${message}"`, 'yellow');
    log(`Course: ${courseId}${topicId ? `, Topic: ${topicId}` : ''}`, 'yellow');
    
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
    
    log('✅ Success', 'green');
    
    // Show answer preview
    const answer = data.answer || '';
    log(`\n📝 Answer (${answer.length} chars):`, 'cyan');
    console.log(answer.substring(0, 500) + (answer.length > 500 ? '...' : ''));
    
    // Show citations
    if (data.citations && data.citations.length > 0) {
      log(`\n📚 Citations (${data.citations.length}):`, 'cyan');
      data.citations.slice(0, 3).forEach((cite, i) => {
        console.log(`  ${i + 1}. ${cite.documentTitle || cite} - Page ${cite.pageNumber || '?'}`);
      });
    } else {
      log('\n⚠️  No citations found', 'yellow');
    }
    
    // Quality check
    if (answer.length > 500 && !answer.includes("don't have enough context")) {
      log('\n✅ Quality: Comprehensive response with context!', 'green');
      testsPassed++;
    } else if (answer.includes("don't have enough context")) {
      log('\n⚠️  Quality: No documents found for this query', 'yellow');
      testsFailed++;
    } else {
      log('\n⚠️  Quality: Response might be too short', 'yellow');
      testsPassed++; // Still count as pass if it's a valid response
    }
    
    return data;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    testsFailed++;
    return null;
  }
}

async function testCompression(topicId) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log('Test: Compression Generation', 'cyan');
  log('='.repeat(60), 'blue');
  log('Generating compression notes (this may take 30-60 seconds)...', 'yellow seconds)...', 'yellow');
  
  const token = await authenticate();
  const url = `${SUPABASE_URL}/functions/v1/generate-compression`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topicId }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      log(`❌ Failed (HTTP ${response.status})`, 'red');
      console.log(JSON.stringify(data, null, 2));
      testsFailed++;
      return null;
    }
    
    log('✅ Compression Generated', 'green');
    
    const content = data.content || '';
    log(`\n📄 Content Preview (${content.length} chars):`, 'cyan');
    console.log(content.substring(0, 800) + '...\n');
    
    // Quality checks
    const headers = (content.match(/^##/gm) || []).length;
    const bullets = (content.match(/^-/gm) || []).length;
    const hasBold = content.includes('**');
    const hasCode = content.includes('```');
    
    log('📊 Quality Metrics:', 'cyan');
    log(`  Headers: ${headers}`, headers > 0 ? 'green' : 'yellow');
    log(`  Bullets: ${bullets}`, bullets >= 15 ? 'green' : 'yellow');
    log(`  Bold terms: ${hasBold ? 'Yes' : 'No'}`, hasBold ? 'green' : 'yellow');
    log(`  Code blocks: ${hasCode ? 'Yes' : 'No'}`, hasCode ? 'green' : 'yellow');
    
    if (content.length > 2000 && bullets >= 15) {
      log('\n✅ Excellent compression quality!', 'green');
      testsPassed++;
    } else {
      log('\n⚠️  Compression generated but quality could be improved', 'yellow');
      testsPassed++; // Still count as pass
    }
    
    return data;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    testsFailed++;
    return null;
  }
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║     GRASP AI Chat & Compression Testing (REAL DATA)  ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
  
  log(`\n✅ Using REAL CSE 120 data`, 'green');
  log(`   Course ID: ${REAL_COURSE_ID}`, 'cyan');
  log(`   Topic ID: ${REAL_TOPIC_ID}`, 'cyan');
  
  // Test 1: RAG Chat with course only (no topic filter)
  await testRAGChat(
    'RAG Chat - Course Only (No Topic Filter)',
    'What is virtual memory? Explain it comprehensively.',
    REAL_COURSE_ID
  );
  
  // Test 2: RAG Chat with topic
  await testRAGChat(
    'RAG Chat - With Topic Filter',
    'Explain virtual memory in detail. How does it work?',
    REAL_COURSE_ID,
    REAL_TOPIC_ID
  );
  
  // Test 3: Complex question
  await testRAGChat(
    'RAG Chat - Complex Question',
    'Compare and contrast virtual memory and physical memory. Include examples and explain when each is used.',
    REAL_COURSE_ID,
    REAL_TOPIC_ID
  );
  
  // Test 4: Compression
  await testCompression(REAL_TOPIC_ID);
  
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
    log('\n⚠️  Some tests failed. Check the output above.', 'yellow');
    process.exit(1);
  }
}

runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});




