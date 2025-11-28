/**
 * Check what documents and embeddings exist in the database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDocuments() {
  console.log('\n🔍 Checking documents and embeddings...\n');
  
  // Authenticate
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL || 'prashamshah115@gmail.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  });
  
  if (!authData.session) {
    console.error('❌ Authentication failed');
    process.exit(1);
  }
  
  // Check courses
  console.log('📚 Courses:');
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, code, name')
    .limit(10);
  
  if (coursesError) {
    console.error('Error fetching courses:', coursesError);
  } else {
    courses?.forEach(course => {
      console.log(`  - ${course.code}: ${course.name} (${course.id})`);
    });
  }
  
  // Find CSE 120
  const cse120 = courses?.find(c => c.code === 'CSE 120' || c.code?.includes('120'));
  if (!cse120) {
    console.log('\n⚠️  CSE 120 not found in courses. Checking all courses...');
  } else {
    console.log(`\n✅ Found CSE 120: ${cse120.id}`);
    
    // Check topics for CSE 120
    console.log('\n📖 Topics for CSE 120:');
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, name, slug')
      .eq('course_id', cse120.id)
      .limit(20);
    
    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
    } else {
      topics?.forEach(topic => {
        console.log(`  - ${topic.name} (${topic.id})`);
      });
      
      // Check documents for each topic
      if (topics && topics.length > 0) {
        console.log('\n📄 Documents:');
        for (const topic of topics) {
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('id, title, topic_id, owner_user_id')
            .eq('topic_id', topic.id)
            .limit(10);
          
          if (!docsError && docs && docs.length > 0) {
            console.log(`\n  Topic: ${topic.name}`);
            docs.forEach(doc => {
              console.log(`    - ${doc.title} (${doc.id})`);
            });
            
            // Check document pages
            for (const doc of docs) {
              const { data: pages, error: pagesError } = await supabase
                .from('document_pages')
                .select('id, page_number, content')
                .eq('document_id', doc.id)
                .limit(5);
              
              if (!pagesError && pages && pages.length > 0) {
                console.log(`      Pages: ${pages.length} pages`);
                
                // Check if pages have embeddings
                const { data: embeddings, error: embError } = await supabase
                  .from('document_page_embeddings')
                  .select('id, page_id')
                  .eq('page_id', pages[0].id)
                  .limit(1);
                
                if (!embError && embeddings && embeddings.length > 0) {
                  console.log(`      ✅ Has embeddings`);
                } else {
                  console.log(`      ⚠️  No embeddings found`);
                }
              }
            }
          }
        }
      }
    }
    
    // Check all documents for CSE 120 (any topic)
    console.log('\n📚 All documents for CSE 120 (any topic):');
    const { data: allDocs, error: allDocsError } = await supabase
      .from('documents')
      .select('id, title, topic_id, owner_user_id, documents!inner(topics!inner(course_id))')
      .eq('topics.course_id', cse120.id)
      .limit(20);
    
    if (!allDocsError && allDocs && allDocs.length > 0) {
      console.log(`Found ${allDocs.length} documents`);
      allDocs.forEach(doc => {
        console.log(`  - ${doc.title}`);
      });
    } else {
      console.log('  No documents found');
    }
  }
  
  // Check document_pages directly
  console.log('\n📄 Checking document_pages table:');
  const { data: allPages, error: pagesError } = await supabase
    .from('document_pages')
    .select('id, page_number, document_id, documents!inner(title, topic_id)')
    .limit(10);
  
  if (!pagesError && allPages && allPages.length > 0) {
    console.log(`Found ${allPages.length} pages`);
    allPages.forEach(page => {
      console.log(`  - Page ${page.page_number} of "${page.documents.title}"`);
    });
  } else {
    console.log('  No pages found');
  }
  
  // Check embeddings
  console.log('\n🔢 Checking embeddings:');
  const { data: embeddings, error: embError } = await supabase
    .from('document_page_embeddings')
    .select('id, page_id')
    .limit(10);
  
  if (!embError && embeddings) {
    console.log(`Found ${embeddings.length} embeddings`);
  } else {
    console.log('  Error or no embeddings:', embError?.message);
  }
  
  // Test the RPC function
  if (cse120 && topics && topics.length > 0) {
    console.log('\n🧪 Testing search_document_pages RPC:');
    const testQuery = 'virtual memory';
    
    // Generate a test embedding (we'll use a simple approach)
    console.log('  Note: Testing RPC requires actual embeddings...');
    console.log('  Try querying with a real course/topic ID from above');
  }
  
  console.log('\n✅ Check complete!');
  console.log('\n💡 Use the course/topic IDs above in your tests!');
}

checkDocuments().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});



