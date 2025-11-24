/**
 * Centralized Test Configuration
 * Loads environment variables and provides test data constants
 */

require('dotenv').config();

const config = {
  // Supabase Configuration
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Test User Credentials
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'prashamshah115@gmail.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  },
  
  // Test Data IDs (from seed-test-data.sql)
  testData: {
    courseId: '11111111-1111-1111-1111-111111111111',
    topicId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    examId: 'exxxxxxx-1111-1111-1111-111111111111',
    questionId: 'qqqqqqqq-1111-1111-1111-111111111111',
  },
  
  // Rate Limits (from rate-limit.ts)
  rateLimits: {
    rag_chat: {
      perMinute: 10,
      perHour: 100,
      perDay: 500,
    },
    generate_compression: {
      perMinute: 2,
      perHour: 10,
      perDay: 50,
    },
  },
  
  // Test Settings
  timeout: 30000, // 30 seconds
  retries: 3,
  concurrency: 5,
};

// Validate required config
if (!config.supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_URL');
}

if (!config.supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
}

module.exports = config;

