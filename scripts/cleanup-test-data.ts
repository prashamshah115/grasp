/**
 * Test Data Cleanup Script
 * 
 * Cleans up test data created during E2E tests
 * Run this script after running Playwright tests
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Test data IDs to clean up
 */
const testCourseIds = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
];

const testExamIds = [
  'exxxxxxx-1111-1111-1111-111111111111',
  'exxxxxxx-2222-2222-2222-222222222222',
];

const testQuestionIds = [
  'qqqqqqqq-1111-1111-1111-111111111111',
  'qqqqqqqq-2222-2222-2222-222222222222',
  'qqqqqqqq-3333-3333-3333-333333333333',
  'qqqqqqqq-4444-4444-4444-444444444444',
  'qqqqqqqq-5555-5555-5555-555555555555',
];

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('Starting test data cleanup...');

  try {
    // Delete exam sessions
    console.log('Deleting test exam sessions...');
    const { error: examSessionsError } = await supabase
      .from('exam_sessions')
      .delete()
      .in('exam_id', testExamIds);
    
    if (examSessionsError) {
      console.error('Error deleting exam sessions:', examSessionsError);
    } else {
      console.log('✓ Exam sessions deleted');
    }

    // Delete exam answers
    console.log('Deleting test exam answers...');
    const { error: examAnswersError } = await supabase
      .from('exam_answers')
      .delete()
      .in('question_id', testQuestionIds);
    
    if (examAnswersError) {
      console.error('Error deleting exam answers:', examAnswersError);
    } else {
      console.log('✓ Exam answers deleted');
    }

    // Delete exam questions
    console.log('Deleting test exam questions...');
    const { error: examQuestionsError } = await supabase
      .from('exam_questions')
      .delete()
      .in('exam_id', testExamIds);
    
    if (examQuestionsError) {
      console.error('Error deleting exam questions:', examQuestionsError);
    } else {
      console.log('✓ Exam questions deleted');
    }

    // Delete exams
    console.log('Deleting test exams...');
    const { error: examsError } = await supabase
      .from('exams')
      .delete()
      .in('id', testExamIds);
    
    if (examsError) {
      console.error('Error deleting exams:', examsError);
    } else {
      console.log('✓ Exams deleted');
    }

    // Delete question attempts
    console.log('Deleting test question attempts...');
    const { error: attemptsError } = await supabase
      .from('question_attempts')
      .delete()
      .in('question_id', testQuestionIds);
    
    if (attemptsError) {
      console.error('Error deleting question attempts:', attemptsError);
    } else {
      console.log('✓ Question attempts deleted');
    }

    // Delete question history
    console.log('Deleting test question history...');
    const { error: historyError } = await supabase
      .from('question_history')
      .delete()
      .in('question_id', testQuestionIds);
    
    if (historyError) {
      console.error('Error deleting question history:', historyError);
    } else {
      console.log('✓ Question history deleted');
    }

    // Delete questions
    console.log('Deleting test questions...');
    const { error: questionsError } = await supabase
      .from('questions')
      .delete()
      .in('id', testQuestionIds);
    
    if (questionsError) {
      console.error('Error deleting questions:', questionsError);
    } else {
      console.log('✓ Questions deleted');
    }

    // Delete topic mastery
    console.log('Deleting test topic mastery...');
    const { data: topics } = await supabase
      .from('topics')
      .select('id')
      .in('course_id', testCourseIds);
    
    if (topics) {
      const topicIds = topics.map(t => t.id);
      const { error: masteryError } = await supabase
        .from('topic_mastery')
        .delete()
        .in('topic_id', topicIds);
      
      if (masteryError) {
        console.error('Error deleting topic mastery:', masteryError);
      } else {
        console.log('✓ Topic mastery deleted');
      }
    }

    // Delete topics
    console.log('Deleting test topics...');
    const { error: topicsError } = await supabase
      .from('topics')
      .delete()
      .in('course_id', testCourseIds);
    
    if (topicsError) {
      console.error('Error deleting topics:', topicsError);
    } else {
      console.log('✓ Topics deleted');
    }

    // Delete user courses
    console.log('Deleting test user courses...');
    const { error: userCoursesError } = await supabase
      .from('user_courses')
      .delete()
      .in('course_id', testCourseIds);
    
    if (userCoursesError) {
      console.error('Error deleting user courses:', userCoursesError);
    } else {
      console.log('✓ User courses deleted');
    }

    // Delete courses
    console.log('Deleting test courses...');
    const { error: coursesError } = await supabase
      .from('courses')
      .delete()
      .in('id', testCourseIds);
    
    if (coursesError) {
      console.error('Error deleting courses:', coursesError);
    } else {
      console.log('✓ Courses deleted');
    }

    console.log('✓ Test data cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup if executed directly
if (require.main === module) {
  cleanupTestData();
}

export { cleanupTestData };

