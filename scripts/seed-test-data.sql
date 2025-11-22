/**
 * Test Data Seeding Script
 * 
 * Creates test courses, topics, questions, and exams for E2E testing
 * Run this script before running Playwright tests
 */

-- Clean up existing test data (optional, use with caution)
-- DELETE FROM exam_questions WHERE exam_id IN (SELECT id FROM exams WHERE course_id = '11111111-1111-1111-1111-111111111111');
-- DELETE FROM exams WHERE course_id = '11111111-1111-1111-1111-111111111111';
-- DELETE FROM questions WHERE course_id = '11111111-1111-1111-1111-111111111111';
-- DELETE FROM topics WHERE course_id = '11111111-1111-1111-1111-111111111111';
-- DELETE FROM courses WHERE id = '11111111-1111-1111-1111-111111111111';

-- Insert test courses
INSERT INTO courses (id, code, name, term, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'CSE 120', 'Operating Systems', 'Winter 2024', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'CSE 101', 'Data Structures', 'Winter 2024', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'MATH 20C', 'Calculus III', 'Winter 2024', NOW()),
  ('44444444-4444-4444-4444-444444444444', 'CSE 140', 'Computer Architecture', 'Winter 2024', NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test topics for CSE 120
INSERT INTO topics (id, course_id, slug, name, week, order_index, created_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'processes-threads', 'Processes & Threads', 1, 0, NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'synchronization', 'Synchronization', 2, 1, NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'memory-management', 'Memory Management', 3, 2, NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'file-systems', 'File Systems', 4, 3, NOW()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'virtual-memory', 'Virtual Memory', 5, 4, NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test questions
INSERT INTO questions (id, course_id, topic_id, q_type, prompt, options, correct_answer, explanation, difficulty, created_at)
VALUES
  (
    'qqqqqqqq-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'multiple_choice',
    'What is the difference between a process and a thread?',
    '{"A": "A process has its own memory space, while threads share memory", "B": "A thread has its own memory space, while processes share memory", "C": "There is no difference", "D": "Both share the same memory space"}'::jsonb,
    '"A"'::jsonb,
    'Processes have isolated memory spaces, while threads within a process share the same memory space.',
    1,
    NOW()
  ),
  (
    'qqqqqqqq-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'multiple_choice',
    'Which synchronization primitive prevents race conditions?',
    '{"A": "Mutual exclusion", "B": "Semaphore", "C": "Monitor", "D": "All of the above"}'::jsonb,
    '"D"'::jsonb,
    'All synchronization primitives (mutex, semaphore, monitor) help prevent race conditions.',
    2,
    NOW()
  ),
  (
    'qqqqqqqq-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'text',
    'Explain the difference between stack and heap memory.',
    NULL,
    '"Stack memory is used for static allocation and function call frames, while heap memory is used for dynamic allocation."'::jsonb,
    'Stack memory is used for static allocation and function call frames, while heap memory is used for dynamic allocation.',
    2,
    NOW()
  ),
  (
    'qqqqqqqq-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'multiple_choice',
    'What is an inode in a file system?',
    '{"A": "A data structure that stores file metadata", "B": "A file allocation table", "C": "A directory entry", "D": "A file handle"}'::jsonb,
    '"A"'::jsonb,
    'An inode is a data structure that stores metadata about a file, including permissions, size, and location of data blocks.',
    2,
    NOW()
  ),
  (
    'qqqqqqqq-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'multiple_choice',
    'What is a page fault?',
    '{"A": "An error that occurs when accessing memory", "B": "A request to load a page from disk into memory", "C": "A memory overflow condition", "D": "A cache miss"}'::jsonb,
    '"B"'::jsonb,
    'A page fault occurs when a program tries to access a page that is not currently in physical memory, requiring it to be loaded from disk.',
    2,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Insert test exams
INSERT INTO exams (id, course_id, name, exam_type, duration_min, created_at)
VALUES
  (
    'exxxxxxx-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Finals Practice Exam',
    'final',
    120,
    NOW()
  ),
  (
    'exxxxxxx-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Midterm Practice Exam',
    'midterm',
    90,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Insert exam questions (link questions to exams)
INSERT INTO exam_questions (exam_id, question_id, order_index, points)
VALUES
  ('exxxxxxx-1111-1111-1111-111111111111', 'qqqqqqqq-1111-1111-1111-111111111111', 0, 1),
  ('exxxxxxx-1111-1111-1111-111111111111', 'qqqqqqqq-2222-2222-2222-222222222222', 1, 1),
  ('exxxxxxx-1111-1111-1111-111111111111', 'qqqqqqqq-3333-3333-3333-333333333333', 2, 2),
  ('exxxxxxx-1111-1111-1111-111111111111', 'qqqqqqqq-4444-4444-4444-444444444444', 3, 1),
  ('exxxxxxx-1111-1111-1111-111111111111', 'qqqqqqqq-5555-5555-5555-555555555555', 4, 1)
ON CONFLICT DO NOTHING;

-- Verify inserted data
SELECT 'Courses inserted:' as info, COUNT(*) as count FROM courses WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

SELECT 'Topics inserted:' as info, COUNT(*) as count FROM topics WHERE course_id = '11111111-1111-1111-1111-111111111111';

SELECT 'Questions inserted:' as info, COUNT(*) as count FROM questions WHERE course_id = '11111111-1111-1111-1111-111111111111';

SELECT 'Exams inserted:' as info, COUNT(*) as count FROM exams WHERE course_id = '11111111-1111-1111-1111-111111111111';

