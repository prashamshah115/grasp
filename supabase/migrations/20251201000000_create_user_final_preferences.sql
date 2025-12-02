-- Migration: Create user_final_preferences table
-- Description: Stores user preferences for final exam dates and study time budgets

CREATE TABLE IF NOT EXISTS user_final_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  final_exam_date TIMESTAMPTZ,
  final_exam_weight NUMERIC(3,2) NOT NULL DEFAULT 0.3 CHECK (final_exam_weight >= 0 AND final_exam_weight <= 1),
  daily_study_minutes INTEGER NOT NULL DEFAULT 60 CHECK (daily_study_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_final_preferences_user_course 
  ON user_final_preferences(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_user_final_preferences_course 
  ON user_final_preferences(course_id);

-- RLS Policies
ALTER TABLE user_final_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own final preferences"
  ON user_final_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own final preferences"
  ON user_final_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own final preferences"
  ON user_final_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_final_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_final_preferences_updated_at
  BEFORE UPDATE ON user_final_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_final_preferences_updated_at();

