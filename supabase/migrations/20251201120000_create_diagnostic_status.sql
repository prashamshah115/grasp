-- Migration: Create diagnostic_status table
-- Description: Tracks whether a user has completed the diagnostic for a given course

CREATE TABLE IF NOT EXISTS diagnostic_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_status_user_course_unique UNIQUE (user_id, course_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_diagnostic_status_user_course
  ON diagnostic_status(user_id, course_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_status_course
  ON diagnostic_status(course_id);

-- RLS Policies
ALTER TABLE diagnostic_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own diagnostic status
CREATE POLICY "Users can view their own diagnostic status"
  ON diagnostic_status FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert/update their own diagnostic status
CREATE POLICY "Users can insert diagnostic status"
  ON diagnostic_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diagnostic status"
  ON diagnostic_status FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_diagnostic_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diagnostic_status_updated_at
  BEFORE UPDATE ON diagnostic_status
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_status_updated_at();


