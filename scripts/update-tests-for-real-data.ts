/**
 * Helper Script: Update Test Files to Use Real Data
 * 
 * This script helps you update test files to use your real course/topic IDs
 * instead of placeholder UUIDs.
 * 
 * Run: npx tsx scripts/update-tests-for-real-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CourseData {
  id: string;
  code: string;
  name: string;
  topics: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
}

async function fetchRealCourseData(courseCode: string = 'CSE 120'): Promise<CourseData | null> {
  console.log(`Fetching course data for: ${courseCode}...`);
  
  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, code, name')
    .eq('code', courseCode)
    .single();
  
  if (courseError || !course) {
    console.error(`Error fetching course: ${courseError?.message}`);
    console.error(`\n⚠️  Course "${courseCode}" not found in database.`);
    console.error(`   Please create the course record first, or update the course code.`);
    return null;
  }
  
  // Fetch topics
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, slug, name')
    .eq('course_id', course.id)
    .order('order_index', { ascending: true });
  
  if (topicsError) {
    console.error(`Error fetching topics: ${topicsError.message}`);
    return null;
  }
  
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    topics: topics || [],
  };
}

async function updateTestFile(
  filePath: string,
  placeholderId: string,
  realId: string
): Promise<boolean> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const updatedContent = content.replace(
      new RegExp(placeholderId, 'g'),
      realId
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}: ${error}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Fetching real course data from database...\n');
  
  const courseData = await fetchRealCourseData();
  
  if (!courseData) {
    console.log('\n❌ Could not fetch course data. Please check:');
    console.log('   1. Course exists in database');
    console.log('   2. Topics exist for the course');
    console.log('   3. Supabase credentials are correct');
    process.exit(1);
  }
  
  console.log(`✅ Found course: ${courseData.code} - ${courseData.name}`);
  console.log(`   Course ID: ${courseData.id}`);
  console.log(`   Topics: ${courseData.topics.length}\n`);
  
  if (courseData.topics.length === 0) {
    console.log('⚠️  Warning: No topics found for this course.');
    console.log('   You may need to create topic records to match your storage folder structure.\n');
  } else {
    console.log('Topics:');
    courseData.topics.forEach((topic, index) => {
      console.log(`   ${index + 1}. ${topic.name} (${topic.slug}) - ID: ${topic.id}`);
    });
    console.log('');
  }
  
  // Update test files
  const testFilesDir = path.join(process.cwd(), 'tests');
  const testFiles = [
    'course-catalog.spec.ts',
    'practice-view.spec.ts',
    'practice-session.spec.ts',
    'compression-view.spec.ts',
    'exam-view.spec.ts',
    'exam-session.spec.ts',
    'document-upload.spec.ts',
  ];
  
  console.log('📝 Updating test files...\n');
  
  const placeholderCourseId = '11111111-1111-1111-1111-111111111111';
  let updatedCount = 0;
  
  for (const testFile of testFiles) {
    const filePath = path.join(testFilesDir, testFile);
    if (fs.existsSync(filePath)) {
      const updated = await updateTestFile(filePath, placeholderCourseId, courseData.id);
      if (updated) {
        console.log(`   ✅ Updated: ${testFile}`);
        updatedCount++;
      }
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} test files.`);
  console.log('\n📋 Summary:');
  console.log(`   Course ID to use: ${courseData.id}`);
  console.log(`   Course Code: ${courseData.code}`);
  console.log(`   Course Name: ${courseData.name}`);
  console.log(`   Number of Topics: ${courseData.topics.length}`);
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Review updated test files');
  console.log('   2. Update topic IDs in tests if needed (currently using first topic)');
  console.log('   3. Run tests: npm run test:e2e');
  console.log(`   4. If you need to update topic IDs, edit the test files manually`);
  
  console.log('\n🔧 To set as environment variable:');
  console.log(`   export TEST_COURSE_ID="${courseData.id}"`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

