-- Add RLS policies for missing tables
-- Security critical: Ensures users can only access their own data

-- ==========================================
-- TOPIC_MASTERY
-- ==========================================
ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;

-- Users can only view their own mastery records
CREATE POLICY "Users can view own topic mastery"
  ON topic_mastery FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own mastery records
CREATE POLICY "Users can create own topic mastery"
  ON topic_mastery FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own mastery records
CREATE POLICY "Users can update own topic mastery"
  ON topic_mastery FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- STUDY_SESSIONS
-- ==========================================
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own study sessions
CREATE POLICY "Users can view own study sessions"
  ON study_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own study sessions
CREATE POLICY "Users can create own study sessions"
  ON study_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own study sessions
CREATE POLICY "Users can update own study sessions"
  ON study_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- QUESTION_ATTEMPTS
-- ==========================================
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own question attempts
CREATE POLICY "Users can view own question attempts"
  ON question_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own question attempts
CREATE POLICY "Users can create own question attempts"
  ON question_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own question attempts
CREATE POLICY "Users can update own question attempts"
  ON question_attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- QUESTION_HISTORY
-- ==========================================
ALTER TABLE question_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own question history
CREATE POLICY "Users can view own question history"
  ON question_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own question history
CREATE POLICY "Users can create own question history"
  ON question_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own question history
CREATE POLICY "Users can update own question history"
  ON question_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- COMPRESSION_NOTES
-- ==========================================
ALTER TABLE compression_notes ENABLE ROW LEVEL SECURITY;

-- Users can view compression notes for courses they're enrolled in
CREATE POLICY "Users can view compression notes for enrolled courses"
  ON compression_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_courses
      WHERE user_courses.user_id = auth.uid()
      AND user_courses.course_id = compression_notes.course_id
    )
  );

-- Users can create compression notes for courses they're enrolled in
CREATE POLICY "Users can create compression notes for enrolled courses"
  ON compression_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_courses
      WHERE user_courses.user_id = auth.uid()
      AND user_courses.course_id = compression_notes.course_id
    )
  );

-- Users can update compression notes for courses they're enrolled in
CREATE POLICY "Users can update compression notes for enrolled courses"
  ON compression_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_courses
      WHERE user_courses.user_id = auth.uid()
      AND user_courses.course_id = compression_notes.course_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_courses
      WHERE user_courses.user_id = auth.uid()
      AND user_courses.course_id = compression_notes.course_id
    )
  );

-- ==========================================
-- LLM_USAGE
-- ==========================================
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view their own LLM usage
CREATE POLICY "Users can view own LLM usage"
  ON llm_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own LLM usage records
CREATE POLICY "Users can create own LLM usage"
  ON llm_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: LLM usage is typically only inserted, not updated
-- But we allow updates for their own records
CREATE POLICY "Users can update own LLM usage"
  ON llm_usage FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- GRADED_ASSIGNMENTS
-- ==========================================
ALTER TABLE graded_assignments ENABLE ROW LEVEL SECURITY;

-- Users can only view their own graded assignments
CREATE POLICY "Users can view own graded assignments"
  ON graded_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own graded assignments
CREATE POLICY "Users can create own graded assignments"
  ON graded_assignments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own graded assignments
CREATE POLICY "Users can update own graded assignments"
  ON graded_assignments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- GRADED_ASSIGNMENT_ANALYSIS
-- ==========================================
ALTER TABLE graded_assignment_analysis ENABLE ROW LEVEL SECURITY;

-- Users can view analysis for their own graded assignments
CREATE POLICY "Users can view own graded assignment analysis"
  ON graded_assignment_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM graded_assignments
      WHERE graded_assignments.id = graded_assignment_analysis.assignment_id
      AND graded_assignments.user_id = auth.uid()
    )
  );

-- Users can create analysis for their own graded assignments
CREATE POLICY "Users can create own graded assignment analysis"
  ON graded_assignment_analysis FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graded_assignments
      WHERE graded_assignments.id = graded_assignment_analysis.assignment_id
      AND graded_assignments.user_id = auth.uid()
    )
  );

-- Users can update analysis for their own graded assignments
CREATE POLICY "Users can update own graded assignment analysis"
  ON graded_assignment_analysis FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM graded_assignments
      WHERE graded_assignments.id = graded_assignment_analysis.assignment_id
      AND graded_assignments.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graded_assignments
      WHERE graded_assignments.id = graded_assignment_analysis.assignment_id
      AND graded_assignments.user_id = auth.uid()
    )
  );

-- ==========================================
-- NOTES
-- ==========================================
-- Service role (used by edge functions) bypasses RLS automatically
-- These policies only apply to authenticated users using the anon key
-- Edge functions using service role can still access all data as needed

