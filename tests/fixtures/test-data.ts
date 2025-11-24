/**
 * Test Data Generators and Constants
 * 
 * Provides test data for courses, topics, questions, exams, etc.
 */

export interface TestCourse {
  id: string;
  code: string;
  name: string;
  term?: string;
}

export interface TestTopic {
  id: string;
  courseId: string;
  slug: string;
  name: string;
  week?: number;
  orderIndex: number;
}

export interface TestQuestion {
  id: string;
  courseId: string;
  topicId: string;
  qType: string;
  prompt: string;
  options?: any;
  correctAnswer: any;
  explanation?: string;
  difficulty?: number;
}

export interface TestExam {
  id: string;
  courseId: string;
  name: string;
  examType: string;
  durationMin: number;
}

/**
 * Sample test courses
 */
export const testCourses: TestCourse[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'CSE 120',
    name: 'Operating Systems',
    term: 'Winter 2024',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    code: 'CSE 101',
    name: 'Data Structures',
    term: 'Winter 2024',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    code: 'MATH 20C',
    name: 'Calculus III',
    term: 'Winter 2024',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    code: 'CSE 140',
    name: 'Computer Architecture',
    term: 'Winter 2024',
  },
];

/**
 * Sample test topics for CSE 120
 */
export const testTopics: TestTopic[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    courseId: '11111111-1111-1111-1111-111111111111',
    slug: 'processes-threads',
    name: 'Processes & Threads',
    week: 1,
    orderIndex: 0,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    courseId: '11111111-1111-1111-1111-111111111111',
    slug: 'synchronization',
    name: 'Synchronization',
    week: 2,
    orderIndex: 1,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    courseId: '11111111-1111-1111-1111-111111111111',
    slug: 'memory-management',
    name: 'Memory Management',
    week: 3,
    orderIndex: 2,
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    courseId: '11111111-1111-1111-1111-111111111111',
    slug: 'file-systems',
    name: 'File Systems',
    week: 4,
    orderIndex: 3,
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    courseId: '11111111-1111-1111-1111-111111111111',
    slug: 'virtual-memory',
    name: 'Virtual Memory',
    week: 5,
    orderIndex: 4,
  },
];

/**
 * Sample test questions
 */
export const testQuestions: TestQuestion[] = [
  {
    id: 'qqqqqqqq-1111-1111-1111-111111111111',
    courseId: '11111111-1111-1111-1111-111111111111',
    topicId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    qType: 'multiple_choice',
    prompt: 'What is the difference between a process and a thread?',
    options: {
      A: 'A process has its own memory space, while threads share memory',
      B: 'A thread has its own memory space, while processes share memory',
      C: 'There is no difference',
      D: 'Both share the same memory space',
    },
    correctAnswer: 'A',
    explanation: 'Processes have isolated memory spaces, while threads within a process share the same memory space.',
    difficulty: 1,
  },
  {
    id: 'qqqqqqqq-2222-2222-2222-222222222222',
    courseId: '11111111-1111-1111-1111-111111111111',
    topicId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    qType: 'multiple_choice',
    prompt: 'Which synchronization primitive prevents race conditions?',
    options: {
      A: 'Mutual exclusion',
      B: 'Semaphore',
      C: 'Monitor',
      D: 'All of the above',
    },
    correctAnswer: 'D',
    explanation: 'All synchronization primitives (mutex, semaphore, monitor) help prevent race conditions.',
    difficulty: 2,
  },
  {
    id: 'qqqqqqqq-3333-3333-3333-333333333333',
    courseId: '11111111-1111-1111-1111-111111111111',
    topicId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    qType: 'text',
    prompt: 'Explain the difference between stack and heap memory.',
    correctAnswer: 'Stack memory is used for static allocation and function call frames, while heap memory is used for dynamic allocation.',
    difficulty: 2,
  },
];

/**
 * Sample test exams
 */
export const testExams: TestExam[] = [
  {
    id: 'exxxxxxx-1111-1111-1111-111111111111',
    courseId: '11111111-1111-1111-1111-111111111111',
    name: 'Finals Practice Exam',
    examType: 'final',
    durationMin: 120,
  },
  {
    id: 'exxxxxxx-2222-2222-2222-222222222222',
    courseId: '11111111-1111-1111-1111-111111111111',
    name: 'Midterm Practice Exam',
    examType: 'midterm',
    durationMin: 90,
  },
];

/**
 * Helper function to generate unique test email
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Helper function to generate unique test name
 */
export function generateTestName(): string {
  return `Test User ${Date.now()}`;
}

/**
 * Test data constants used by functional tests
 * These IDs should match your seeded database data
 */
import path from 'path';

export const STORAGE_STATE_PATH = path.join(__dirname, '../.auth/user.json');

// Seeded data UUIDs (from scripts/seed-test-data.sql or your actual database)
export const TEST_COURSE_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_TOPIC_ID = '22222222-1111-1111-1111-111111111111';
export const TEST_EXAM_ID = '44444444-1111-1111-1111-111111111111';
export const TEST_QUESTION_ID_MCQ = '33333333-1111-1111-1111-111111111111';
export const TEST_QUESTION_ID_SHORT_ANSWER = '33333333-1115-1111-1111-111111111111';

