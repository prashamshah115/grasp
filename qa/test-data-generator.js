/**
 * Synthetic Test Data Generator
 * Generates test data for various scenarios: multiple users, rate limits, etc.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./test-config');

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey || config.supabaseAnonKey
);

// Generate test users
async function generateTestUsers(count = 5) {
  console.log(`\n👥 Generating ${count} test users...`);
  
  const users = [];
  for (let i = 0; i < count; i++) {
    const email = `test-user-${Date.now()}-${i}@example.com`;
    const password = 'testpassword123';
    
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      
      if (error) {
        console.error(`  ❌ Failed to create user ${i + 1}: ${error.message}`);
      } else {
        users.push({ id: data.user.id, email });
        console.log(`  ✅ Created user ${i + 1}: ${email}`);
      }
    } catch (error) {
      console.error(`  ❌ Error creating user ${i + 1}: ${error.message}`);
    }
  }
  
  return users;
}

// Generate rate limit test data
async function generateRateLimitData(userId, endpoint, count) {
  console.log(`\n📊 Generating rate limit data for user ${userId.substring(0, 8)}...`);
  
  const records = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    // Create records in different time windows
    const windowStart = new Date(now.getTime() - (i * 60 * 1000)); // Each minute
    
    const { data, error } = await supabase
      .from('rate_limit_usage')
      .insert({
        user_id: userId,
        endpoint,
        request_count: Math.floor(Math.random() * 10) + 1,
        window_start: windowStart.toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error(`  ❌ Failed to create rate limit record ${i + 1}: ${error.message}`);
    } else {
      records.push(data);
    }
  }
  
  console.log(`  ✅ Created ${records.length} rate limit records`);
  return records;
}

// Generate study sessions
async function generateStudySessions(userId, courseId, count = 10) {
  console.log(`\n📚 Generating ${count} study sessions...`);
  
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const startedAt = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)); // One per day
    const endedAt = i % 2 === 0 ? new Date(startedAt.getTime() + 30 * 60 * 1000) : null; // Some completed
    
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        course_id: courseId,
        mode: ['warmup', 'practice', 'review'][i % 3],
        started_at: startedAt.toISOString(),
        ended_at: endedAt?.toISOString() || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error(`  ❌ Failed to create session ${i + 1}: ${error.message}`);
    } else {
      sessions.push(data);
      
      // Generate question attempts for completed sessions
      if (endedAt) {
        await generateQuestionAttempts(data.id, userId, 5);
      }
    }
  }
  
  console.log(`  ✅ Created ${sessions.length} study sessions`);
  return sessions;
}

// Generate question attempts
async function generateQuestionAttempts(sessionId, userId, count = 5) {
  const questionIds = [
    'qqqqqqqq-1111-1111-1111-111111111111',
    'qqqqqqqq-2222-2222-2222-222222222222',
    'qqqqqqqq-3333-3333-3333-333333333333',
    'qqqqqqqq-4444-4444-4444-444444444444',
    'qqqqqqqq-5555-5555-5555-555555555555',
  ];
  
  for (let i = 0; i < count; i++) {
    const questionId = questionIds[i % questionIds.length];
    const isCorrect = Math.random() > 0.3; // 70% correct rate
    
    await supabase
      .from('question_attempts')
      .insert({
        session_id: sessionId,
        user_id: userId,
        question_id: questionId,
        user_answer: isCorrect ? 'A' : 'B',
        is_correct: isCorrect,
        time_taken_sec: Math.floor(Math.random() * 60) + 10,
      });
  }
}

// Generate question history (spaced repetition)
async function generateQuestionHistory(userId, count = 20) {
  console.log(`\n🔄 Generating question history...`);
  
  const questionIds = [
    'qqqqqqqq-1111-1111-1111-111111111111',
    'qqqqqqqq-2222-2222-2222-222222222222',
    'qqqqqqqq-3333-3333-3333-333333333333',
  ];
  
  for (let i = 0; i < count; i++) {
    const questionId = questionIds[i % questionIds.length];
    const lastReviewed = new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)); // Every 2 days
    const nextReview = new Date(lastReviewed.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
    
    await supabase
      .from('question_history')
      .upsert({
        user_id: userId,
        question_id: questionId,
        ease_factor: 2.5,
        interval_days: i + 1,
        repetitions: i % 5,
        last_reviewed: lastReviewed.toISOString(),
        next_review: nextReview.toISOString(),
      }, {
        onConflict: 'user_id,question_id',
      });
  }
  
  console.log(`  ✅ Created ${count} question history records`);
}

// Generate topic mastery
async function generateTopicMastery(userId, courseId) {
  console.log(`\n🎯 Generating topic mastery...`);
  
  const topicIds = [
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
  ];
  
  const masteryLevels = ['weak', 'moderate', 'strong'];
  
  for (let i = 0; i < topicIds.length; i++) {
    await supabase
      .from('topic_mastery')
      .upsert({
        user_id: userId,
        topic_id: topicIds[i],
        mastery_level: masteryLevels[i % masteryLevels.length],
        accuracy: (i + 1) * 0.25, // 25%, 50%, 75%
        questions_attempted: (i + 1) * 10,
        questions_correct: (i + 1) * 7,
      }, {
        onConflict: 'user_id,topic_id',
      });
  }
  
  console.log(`  ✅ Created topic mastery records`);
}

// Generate user course enrollments
async function generateUserCourses(userId, courseIds) {
  console.log(`\n📖 Enrolling user in courses...`);
  
  for (const courseId of courseIds) {
    await supabase
      .from('user_courses')
      .upsert({
        user_id: userId,
        course_id: courseId,
      }, {
        onConflict: 'user_id,course_id',
      });
  }
  
  console.log(`  ✅ Enrolled in ${courseIds.length} courses`);
}

// Main generator function
async function generateAllTestData(options = {}) {
  const {
    userCount = 3,
    rateLimitUsers = 2,
    sessionsPerUser = 5,
  } = options;
  
  console.log('🚀 Starting Test Data Generation\n');
  console.log('='.repeat(60));
  
  // Generate test users
  const users = await generateTestUsers(userCount);
  
  if (users.length === 0) {
    console.error('\n❌ No users created. Cannot continue.');
    return;
  }
  
  const courseIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
  ];
  
  // Generate data for each user
  for (const user of users) {
    console.log(`\n📦 Generating data for user: ${user.email}`);
    
    // Enroll in courses
    await generateUserCourses(user.id, courseIds);
    
    // Generate study sessions
    await generateStudySessions(user.id, courseIds[0], sessionsPerUser);
    
    // Generate question history
    await generateQuestionHistory(user.id, 15);
    
    // Generate topic mastery
    await generateTopicMastery(user.id, courseIds[0]);
    
    // Generate rate limit data for some users
    if (users.indexOf(user) < rateLimitUsers) {
      await generateRateLimitData(user.id, 'rag_chat', 20);
      await generateRateLimitData(user.id, 'generate_compression', 5);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Data Generation Complete!');
  console.log(`\nGenerated:`);
  console.log(`  - ${users.length} test users`);
  console.log(`  - ${users.length * sessionsPerUser} study sessions`);
  console.log(`  - Rate limit data for ${rateLimitUsers} users`);
  console.log('\nUse these user emails for testing:');
  users.forEach((user, i) => {
    console.log(`  ${i + 1}. ${user.email} (password: testpassword123)`);
  });
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const userCount = parseInt(args[0]) || 3;
  const rateLimitUsers = parseInt(args[1]) || 2;
  
  generateAllTestData({
    userCount,
    rateLimitUsers,
    sessionsPerUser: 5,
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generateAllTestData, generateTestUsers };

