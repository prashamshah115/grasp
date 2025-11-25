-- Migration: Add RLS policies for exam_sessions and exam_answers tables
-- Description: Ensures proper security for exam-related tables
-- Created: 2025-11-26

-- ============================================
-- 1. EXAM_SESSIONS TABLE RLS
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate)
DROP POLICY IF EXISTS "Users can view their own exam sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Users can create their own exam sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Users can update their own exam sessions" ON exam_sessions;

-- Users can view their own exam sessions
CREATE POLICY "Users can view their own exam sessions"
  ON exam_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own exam sessions (though typically done via edge function)
CREATE POLICY "Users can create their own exam sessions"
  ON exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own exam sessions (for saving answers, etc.)
CREATE POLICY "Users can update their own exam sessions"
  ON exam_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. EXAM_ANSWERS TABLE RLS
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate)
DROP POLICY IF EXISTS "Users can view their own exam answers" ON exam_answers;
DROP POLICY IF EXISTS "Users can create their own exam answers" ON exam_answers;
DROP POLICY IF EXISTS "Users can update their own exam answers" ON exam_answers;

-- Users can view their own exam answers (via session ownership)
CREATE POLICY "Users can view their own exam answers"
  ON exam_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = exam_answers.session_id
      AND exam_sessions.user_id = auth.uid()
    )
  );

-- Users can create their own exam answers (via session ownership)
CREATE POLICY "Users can create their own exam answers"
  ON exam_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = exam_answers.session_id
      AND exam_sessions.user_id = auth.uid()
    )
  );

-- Users can update their own exam answers (via session ownership)
CREATE POLICY "Users can update their own exam answers"
  ON exam_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = exam_answers.session_id
      AND exam_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = exam_answers.session_id
      AND exam_sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. EXAM_QUESTIONS TABLE (should be public read-only)
-- ============================================

-- Ensure exam_questions is readable by all authenticated users
-- (This table links exams to questions and should be public)
-- Note: If RLS is enabled, we need a policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'exam_questions'
  ) THEN
    -- Check if RLS is enabled
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relname = 'exam_questions'
      AND c.relrowsecurity = true
    ) THEN
      -- Drop existing policy if it exists
      DROP POLICY IF EXISTS "Anyone can view exam questions" ON exam_questions;
      
      -- Create policy for public read access
      CREATE POLICY "Anyone can view exam questions"
        ON exam_questions FOR SELECT
        USING (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- 4. VERIFY POLICIES WERE CREATED
-- ============================================

-- Verify exam_sessions policies
SELECT 
    'exam_sessions' as table_name,
    policyname,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'exam_sessions'
ORDER BY policyname;

-- Verify exam_answers policies
SELECT 
    'exam_answers' as table_name,
    policyname,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'exam_answers'
ORDER BY policyname;

