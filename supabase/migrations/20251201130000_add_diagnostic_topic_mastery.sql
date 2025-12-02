-- Migration: Add topic_mastery JSONB column to diagnostic_status table
-- Description: Store topic-level performance at diagnostic time for study plan generation

ALTER TABLE diagnostic_status
ADD COLUMN IF NOT EXISTS topic_mastery JSONB;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_diagnostic_status_topic_mastery 
ON diagnostic_status USING GIN (topic_mastery);

-- Comment explaining the format
COMMENT ON COLUMN diagnostic_status.topic_mastery IS 'JSONB object mapping topic_id to mastery percentage (0-1). Format: {"topic_id1": 0.45, "topic_id2": 0.80}';

