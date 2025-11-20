-- Seed Data: Sample Course for Testing GRASP
-- Course: CSE 120 Operating Systems
-- Topics: 5 topics with 15 questions each (75 total)
-- Run this after schema is deployed

-- =====================================================
-- 1. INSERT SAMPLE COURSE
-- =====================================================

INSERT INTO courses (id, code, name, term, description, instructor) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  'CSE 120',
  'Operating Systems',
  'Fall 2024',
  'Introduction to operating systems: processes, threads, scheduling, memory management, file systems',
  'Prof. Smith'
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. INSERT TOPICS
-- =====================================================

INSERT INTO topics (id, course_id, slug, name, week, order_index, description) VALUES
(
  '22222222-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'intro-processes',
  'Introduction & Processes',
  1,
  1,
  'OS basics, processes, process management'
),
(
  '22222222-2222-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'scheduling',
  'CPU Scheduling',
  2,
  2,
  'Scheduling algorithms: FCFS, SJF, Round Robin, Priority'
),
(
  '22222222-3333-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'memory',
  'Virtual Memory',
  3,
  3,
  'Paging, segmentation, TLBs, page replacement'
),
(
  '22222222-4444-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'filesystems',
  'File Systems',
  4,
  4,
  'File system design, inodes, directories, caching'
),
(
  '22222222-5555-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'io',
  'I/O and Devices',
  5,
  5,
  'Device drivers, interrupts, DMA, I/O scheduling'
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. INSERT SAMPLE QUESTIONS (15 per topic = 75 total)
-- =====================================================

-- Topic 1: Introduction & Processes (15 questions)

INSERT INTO questions (id, course_id, topic_id, q_type, prompt, options, correct_answer, explanation, difficulty) VALUES
(
  '33333333-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is a process?',
  '["A program in execution", "A file on disk", "A user session", "A CPU core"]'::jsonb,
  '"A program in execution"'::jsonb,
  'A process is a program in execution with its own address space, program counter, and resources.',
  1
),
(
  '33333333-1112-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What does the OS do during a context switch?',
  '["Saves process state", "Deletes the process", "Restarts the computer", "Formats the disk"]'::jsonb,
  '"Saves process state"'::jsonb,
  'During a context switch, the OS saves the current process state and loads the next process state.',
  2
),
(
  '33333333-1113-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is the difference between a process and a thread?',
  '["Threads share address space, processes don''t", "No difference", "Processes are faster", "Threads use more memory"]'::jsonb,
  '"Threads share address space, processes don''t"'::jsonb,
  'Threads within a process share the same address space, while processes have separate address spaces.',
  2
),
(
  '33333333-1114-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'Which state is NOT a valid process state?',
  '["Running", "Waiting", "Ready", "Sleeping"]'::jsonb,
  '"Sleeping"'::jsonb,
  'Common process states are: New, Ready, Running, Waiting, Terminated. "Sleeping" is not a standard state.',
  1
),
(
  '33333333-1115-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'short_answer',
  'Explain what the fork() system call does.',
  NULL,
  '"fork() creates a new child process that is a copy of the parent process"'::jsonb,
  'fork() creates a new process by duplicating the calling process. The new process (child) is an exact copy of the calling process (parent) except for the return value.',
  2
),
(
  '33333333-1116-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is the purpose of the Process Control Block (PCB)?',
  '["Store process state", "Execute instructions", "Allocate CPU time", "Manage I/O devices"]'::jsonb,
  '"Store process state"'::jsonb,
  'The PCB stores all information about a process including state, registers, memory limits, open files, etc.',
  2
),
(
  '33333333-1117-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'Which system call terminates a process?',
  '["exit()", "fork()", "wait()", "kill()"]'::jsonb,
  '"exit()"'::jsonb,
  'exit() terminates the calling process and returns a status code to the parent.',
  1
),
(
  '33333333-1118-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is a zombie process?',
  '["A terminated process waiting for parent to read exit status", "A virus", "A deadlocked process", "A sleeping process"]'::jsonb,
  '"A terminated process waiting for parent to read exit status"'::jsonb,
  'A zombie process has terminated but still has an entry in the process table because its parent has not yet read its exit status via wait().',
  3
),
(
  '33333333-1119-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What does the exec() family of system calls do?',
  '["Replace process image with new program", "Create new process", "Terminate process", "Pause process"]'::jsonb,
  '"Replace process image with new program"'::jsonb,
  'exec() replaces the current process image with a new program, keeping the same PID.',
  2
),
(
  '33333333-1120-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is Inter-Process Communication (IPC)?',
  '["Mechanism for processes to communicate and synchronize", "CPU scheduling", "Memory management", "Disk I/O"]'::jsonb,
  '"Mechanism for processes to communicate and synchronize"'::jsonb,
  'IPC allows processes to exchange data and synchronize their actions using mechanisms like pipes, message queues, shared memory, etc.',
  2
),
(
  '33333333-1121-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'Which IPC mechanism is fastest?',
  '["Shared memory", "Pipes", "Message queues", "Sockets"]'::jsonb,
  '"Shared memory"'::jsonb,
  'Shared memory is the fastest IPC mechanism because it avoids kernel involvement after initial setup.',
  3
),
(
  '33333333-1122-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is the role of the init process in Unix?',
  '["First process started by kernel, PID 1", "Last process to terminate", "CPU scheduler", "Memory allocator"]'::jsonb,
  '"First process started by kernel, PID 1"'::jsonb,
  'init is the first process started by the kernel (PID 1) and is the ancestor of all other processes.',
  2
),
(
  '33333333-1123-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is process priority?',
  '["Value determining scheduling order", "Process size", "CPU speed", "Memory usage"]'::jsonb,
  '"Value determining scheduling order"'::jsonb,
  'Priority is a value assigned to processes to determine their scheduling order - higher priority processes are scheduled first.',
  1
),
(
  '33333333-1124-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'mcq',
  'What is a daemon process?',
  '["Background process running continuously", "System virus", "User interface program", "Temporary file"]'::jsonb,
  '"Background process running continuously"'::jsonb,
  'A daemon is a background process that runs continuously to provide system services (e.g., httpd, sshd).',
  2
),
(
  '33333333-1125-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '22222222-1111-1111-1111-111111111111',
  'short_answer',
  'Describe the life cycle of a process from creation to termination.',
  NULL,
  '"Process goes through states: New → Ready → Running → Waiting (optional) → Terminated"'::jsonb,
  'A process starts in New state, moves to Ready when admitted, Running when scheduled, may go to Waiting for I/O, and eventually Terminated when it exits.',
  2
) ON CONFLICT (id) DO NOTHING;

-- Topic 2: CPU Scheduling (15 questions) - IDs starting with 34...
-- Topic 3: Virtual Memory (15 questions) - IDs starting with 35...
-- Topic 4: File Systems (15 questions) - IDs starting with 36...
-- Topic 5: I/O (15 questions) - IDs starting with 37...

-- NOTE: For brevity, only showing Topic 1 questions
-- You should add 60 more questions for complete seed data
-- Use similar format with incrementing IDs

-- =====================================================
-- 4. INSERT SAMPLE EXAM
-- =====================================================

INSERT INTO exams (id, course_id, name, exam_type, duration_minutes, total_points, instructions) VALUES
(
  '44444444-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'CSE 120 Midterm Exam',
  'midterm',
  90,
  100,
  'This exam covers topics 1-3. You have 90 minutes. No notes allowed.'
) ON CONFLICT (id) DO NOTHING;

-- Link first 30 questions to the exam
INSERT INTO exam_questions (exam_id, question_id, order_index, points)
SELECT
  '44444444-1111-1111-1111-111111111111',
  id,
  ROW_NUMBER() OVER (ORDER BY created_at),
  CASE
    WHEN difficulty = 1 THEN 2
    WHEN difficulty = 2 THEN 3
    WHEN difficulty = 3 THEN 5
    ELSE 3
  END
FROM questions
WHERE course_id = '11111111-1111-1111-1111-111111111111'
LIMIT 30
ON CONFLICT (exam_id, question_id) DO NOTHING;

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- Verify data was inserted
SELECT 'Courses inserted:' as check_type, COUNT(*) as count FROM courses;
SELECT 'Topics inserted:' as check_type, COUNT(*) as count FROM topics;
SELECT 'Questions inserted:' as check_type, COUNT(*) as count FROM questions;
SELECT 'Exams inserted:' as check_type, COUNT(*) as count FROM exams;
SELECT 'Exam questions linked:' as check_type, COUNT(*) as count FROM exam_questions;
