-- Migration: Add session_id column to diagnostic_status table
-- Description: Store exam session ID for audit trail and debugging

-- Ensure updated_at exists (safety check)
ALTER TABLE diagnostic_status
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Add session_id column
ALTER TABLE diagnostic_status
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES exam_sessions(id) ON DELETE SET NULL;

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_diagnostic_status_session_id
ON diagnostic_status(session_id);

-- Comment explaining the purpose
COMMENT ON COLUMN diagnostic_status.session_id IS 'Reference to the exam_sessions row used for this diagnostic. Enables audit trail and debugging.';

