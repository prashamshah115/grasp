/**
 * Verify Schema and Test RAG with Real Data
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'prashamshah115@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

const REAL_COURSE_ID = '634a94de-f71c-4c53-9f5d-e9c8bfc22449'; // CSE120
const REAL_TOPIC_ID = 'bb004e83-7e3f-478e-874a-3590113a186b'; // Virtual Memory

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function verifySchema() {
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║           Schema Verification                         ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
  
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (!authData.session) {
    log('❌ Authentication failed', 'red');
    process.exit(1);
  }
  
  // 1. DOCUMENTS table
  log('\n📚 DOCUMENTS Table:', 'cyan');
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, course_id, topic_id, title, doc_type, total_pages, status')
    .eq('course_id', REAL_COURSE_ID)
    .limit(5);
  
  if (docsError) {
    log(`  Error: ${docsError.message}`, 'red');
  } else if (docs && docs.length > 0) {
    log(`  ✅ Found ${docs.length} documents`, 'green');
    docs.forEach(doc => {
      log(`    - ${doc.title} (topic_id: ${doc.topic_id || 'NULL'}, status: ${doc.status})`, 'yellow');
    });
  } else {
    log('  ⚠️  No documents found for CSE 120', 'yellow');
  }
  
  // 2. DOCUMENT_PAGES table
  log('\n📄 DOCUMENT_PAGES Table:', 'cyan');
  const { data: pages, error: pagesError } = await supabase
    .from('document_pages')
    .select('id, document_id, page_number, text_content')
    .limit(3);
  
  if (pagesError) {
    log(`  Error: ${pagesError.message}`, 'red');
  } else if (pages && pages.length > 0) {
    log(`  ✅ Found ${pages.length} pages (showing first 3)`, 'green');
    pages.forEach(page => {
      log(`    - Page ${page.page_number} (${page.text_content?.length || 0} chars)`, 'yellow');
    });
  } else {
    log('  ⚠️  No pages found', 'yellow');
  }
  
  // 3. PAGE_EMBEDDINGS_V2 table
  log('\n🔢 PAGE_EMBEDDINGS_V2 Table:', 'cyan');
  const { data: embeddings, error: embError } = await supabase
    .from('page_embeddings_v2')
    .select('id, document_id, page_number, model')
    .limit(5);
  
  if (embError) {
    log(`  Error: ${embError.message}`, 'red');
  } else if (embeddings && embeddings.length > 0) {
    log(`  ✅ Found ${embeddings.length} page embeddings`, 'green');
    embeddings.forEach(emb => {
      log(`    - Doc ${emb.document_id.substring(0, 8)}... Page ${emb.page_number} (${emb.model})`, 'yellow');
    });
  } else {
    log('  ⚠️  No embeddings found', 'yellow');
  }
  
  // 4. DOCUMENT_CHUNKS table
  log('\n🧩 DOCUMENT_CHUNKS Table:', 'cyan');
  const { data: chunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select('id, page_id, chunk_index, content')
    .limit(5);
  
  if (chunksError) {
    log(`  Error: ${chunksError.message}`, 'red');
  } else if (chunks && chunks.length > 0) {
    log(`  ✅ Found ${chunks.length} chunks (showing first 5)`, 'green');
    chunks.forEach(chunk => {
      log(`    - Chunk ${chunk.chunk_index} (${chunk.content?.length || 0} chars)`, 'yellow');
    });
  } else {
    log('  ⚠️  No chunks found', 'yellow');
  }
  
  // 5. Check RPC function exists
  log('\n🔍 Checking RPC Function:', 'cyan');
  try {
    // Try to call it with a dummy embedding to see if it exists
    const dummyEmbedding = new Array(768).fill(0.1);
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_document_pages', {
      query_embedding: dummyEmbedding,
      filter_course_id: REAL_COURSE_ID,
      filter_topic_id: null,
      filter_user_id: authData.session.user.id,
      match_threshold: 0.7,
      match_count: 1
    });
    
    if (rpcError) {
      log(`  ⚠️  RPC Error: ${rpcError.message}`, 'yellow');
      log(`  Code: ${rpcError.code}`, 'yellow');
    } else {
      log(`  ✅ RPC function exists and callable`, 'green');
      log(`  Returned ${rpcData?.length || 0} results`, 'green');
    }
  } catch (error) {
    log(`  ❌ RPC function error: ${error.message}`, 'red');
  }
  
  log('\n✅ Schema verification complete!', 'green');
}

async function testRAG() {
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║           Testing RAG Chat                             ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
  
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  const token = authData.session.access_token;
  
  // Test 1: Course only (no topic filter)
  log('\n📝 Test 1: RAG Chat - Course Only', 'cyan');
  const response1 = await fetch(`${SUPABASE_URL}/functions/v1/rag-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'What is virtual memory? Explain comprehensively.',
      courseId: REAL_COURSE_ID,
    }),
  });
  
  const data1 = await response1.json();
  
  if (response1.ok && data1.answer && !data1.answer.includes("don't have enough context")) {
    log('✅ Success! Got comprehensive answer', 'green');
    log(`\nAnswer (${data1.answer.length} chars):`, 'cyan');
    console.log(data1.answer.substring(0, 500) + '...');
    if (data1.citations && data1.citations.length > 0) {
      log(`\n📚 Citations: ${data1.citations.length}`, 'green');
      data1.citations.slice(0, 3).forEach((cite, i) => {
        console.log(`  ${i + 1}. ${cite.documentTitle || cite} - Page ${cite.pageNumber || '?'}`);
      });
    }
  } else {
    log('⚠️  No documents found or error', 'yellow');
    console.log(JSON.stringify(data1, null, 2));
  }
  
  // Test 2: With topic
  log('\n📝 Test 2: RAG Chat - With Topic', 'cyan');
  const response2 = await fetch(`${SUPABASE_URL}/functions/v1/rag-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Explain virtual memory in detail.',
      courseId: REAL_COURSE_ID,
      topicId: REAL_TOPIC_ID,
    }),
  });
  
  const data2 = await response2.json();
  
  if (response2.ok && data2.answer && !data2.answer.includes("don't have enough context")) {
    log('✅ Success! Got comprehensive answer', 'green');
    log(`\nAnswer (${data2.answer.length} chars):`, 'cyan');
    console.log(data2.answer.substring(0, 500) + '...');
  } else {
    log('⚠️  No documents found for this topic', 'yellow');
    console.log(JSON.stringify(data2, null, 2));
  }
}

async function run() {
  await verifySchema();
  await testRAG();
  
  log('\n╔════════════════════════════════════════════════════════╗', 'blue');
  log('║                    Complete!                          ║', 'blue');
  log('╚════════════════════════════════════════════════════════╝', 'blue');
}

run().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});


