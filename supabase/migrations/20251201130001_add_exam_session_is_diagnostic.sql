-- Migration: Add is_diagnostic boolean column to exam_sessions table
-- Description: Persist diagnostic flag in database to survive page refreshes

ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS is_diagnostic BOOLEAN DEFAULT FALSE;

-- Index for diagnostic session lookups
CREATE INDEX IF NOT EXISTS idx_exam_sessions_is_diagnostic
ON exam_sessions(user_id, is_diagnostic)
WHERE is_diagnostic = TRUE;

-- Comment explaining the purpose
COMMENT ON COLUMN exam_sessions.is_diagnostic IS 'True if this exam session is being used as a diagnostic for study plan generation. Survives page refreshes.';

