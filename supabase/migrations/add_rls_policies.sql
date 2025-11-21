-- RLS Policies for user_courses, premium_users, and course_uploads tables
-- Run this in Supabase SQL Editor after creating the tables

-- ==================== user_courses ====================
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own courses"
  ON user_courses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own courses"
  ON user_courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses"
  ON user_courses FOR DELETE
  USING (auth.uid() = user_id);

-- ==================== premium_users ====================
ALTER TABLE premium_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own premium status"
  ON premium_users FOR SELECT
  USING (auth.uid() = user_id);

-- Note: INSERT and UPDATE should be handled by backend/edge functions with service role
-- Regular users should not be able to modify their own premium status

-- ==================== course_uploads ====================
ALTER TABLE course_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own uploads"
  ON course_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own uploads"
  ON course_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
  ON course_uploads FOR UPDATE
  USING (auth.uid() = user_id);

