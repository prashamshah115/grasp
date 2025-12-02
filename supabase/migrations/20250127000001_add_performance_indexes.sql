-- Performance Indexes for 1000+ Concurrent Users
-- Adds indexes to frequently queried tables for optimal performance

-- ==========================================
-- TOPIC_MASTERY INDEXES
-- ==========================================
-- Frequently queried by user_id and topic_id
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_topic 
  ON topic_mastery(user_id, topic_id);

-- Frequently queried for weak topics (low mastery)
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_mastery 
  ON topic_mastery(user_id, mastery_level) 
  WHERE mastery_level = 'weak';

-- Frequently queried for last practiced (spaced repetition)
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_last_practiced 
  ON topic_mastery(user_id, last_practiced_at NULLS FIRST);

-- ==========================================
-- STUDY_SESSIONS INDEXES
-- ==========================================
-- Frequently queried by user_id and course_id
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_course 
  ON study_sessions(user_id, course_id);

-- Frequently queried for active sessions
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_active 
  ON study_sessions(user_id, created_at DESC) 
  WHERE ended_at IS NULL;

-- Frequently queried by mode (practice, global, exam)
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_mode 
  ON study_sessions(user_id, mode, created_at DESC);

-- ==========================================
-- QUESTION_ATTEMPTS INDEXES
-- ==========================================
-- Frequently queried by session_id (for session results)
CREATE INDEX IF NOT EXISTS idx_question_attempts_session 
  ON question_attempts(session_id, created_at);

-- Frequently queried by user_id and question_id (for analytics)
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_question 
  ON question_attempts(user_id, question_id, created_at DESC);

-- Frequently queried for correctness analysis
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_correct 
  ON question_attempts(user_id, is_correct, created_at DESC);

-- ==========================================
-- QUESTION_HISTORY INDEXES
-- ==========================================
-- Frequently queried for spaced repetition (next_review)
CREATE INDEX IF NOT EXISTS idx_question_history_user_next_review 
  ON question_history(user_id, next_review) 
  WHERE next_review <= NOW();

-- Frequently queried by user_id and question_id
CREATE INDEX IF NOT EXISTS idx_question_history_user_question 
  ON question_history(user_id, question_id);

-- Frequently queried for accuracy analysis
CREATE INDEX IF NOT EXISTS idx_question_history_user_accuracy 
  ON question_history(user_id, (times_correct::float / NULLIF(times_seen, 0)));

-- ==========================================
-- COMPRESSION_NOTES INDEXES
-- ==========================================
-- Frequently queried by course_id and topic_id
CREATE INDEX IF NOT EXISTS idx_compression_notes_course_topic 
  ON compression_notes(course_id, topic_id);

-- Frequently queried for latest notes
CREATE INDEX IF NOT EXISTS idx_compression_notes_course_created 
  ON compression_notes(course_id, created_at DESC);

-- ==========================================
-- USER_COURSES INDEXES
-- ==========================================
-- Frequently queried for enrollment checks
CREATE INDEX IF NOT EXISTS idx_user_courses_user_course 
  ON user_courses(user_id, course_id);

-- Frequently queried for all courses a user is enrolled in
CREATE INDEX IF NOT EXISTS idx_user_courses_user 
  ON user_courses(user_id);

-- ==========================================
-- QUESTIONS INDEXES
-- ==========================================
-- Frequently queried by topic_id and is_exam_only
CREATE INDEX IF NOT EXISTS idx_questions_topic_exam_only 
  ON questions(topic_id, is_exam_only) 
  WHERE is_exam_only = false;

-- Frequently queried by difficulty for adaptive selection
CREATE INDEX IF NOT EXISTS idx_questions_topic_difficulty 
  ON questions(topic_id, difficulty);

-- ==========================================
-- DOCUMENTS INDEXES
-- ==========================================
-- Frequently queried by course_id for RAG
CREATE INDEX IF NOT EXISTS idx_documents_course 
  ON documents(course_id, created_at DESC);

-- Frequently queried by topic_id
CREATE INDEX IF NOT EXISTS idx_documents_topic 
  ON documents(topic_id, created_at DESC);

-- ==========================================
-- EXAM_SESSIONS INDEXES (if not already exists)
-- ==========================================
-- Frequently queried for active exam sessions
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_active 
  ON exam_sessions(user_id, exam_id, is_completed) 
  WHERE is_completed = false;

-- ==========================================
-- LLM_USAGE INDEXES
-- ==========================================
-- Frequently queried for usage analytics
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created 
  ON llm_usage(user_id, created_at DESC);

-- Frequently queried by endpoint for analytics
CREATE INDEX IF NOT EXISTS idx_llm_usage_endpoint_created 
  ON llm_usage(endpoint, created_at DESC);

-- ==========================================
-- NOTES
-- ==========================================
-- These indexes optimize the most common query patterns:
-- 1. User-specific data lookups (user_id indexes)
-- 2. Course/topic filtering (course_id, topic_id indexes)
-- 3. Time-based queries (created_at, last_practiced_at indexes)
-- 4. Spaced repetition queries (next_review indexes)
-- 5. Active session lookups (WHERE clauses on status fields)
--
-- All indexes use IF NOT EXISTS to prevent errors on re-run
-- Partial indexes (WHERE clauses) reduce index size and improve performance

