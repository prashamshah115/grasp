-- Migration: Add mastery_score column to topic_mastery table
-- Description: Adds float mastery_score (0.0-1.0) to existing topic_mastery for simple score tracking

-- Add mastery_score column if it doesn't exist
ALTER TABLE topic_mastery 
ADD COLUMN IF NOT EXISTS mastery_score float DEFAULT 0.5;

-- Add index for efficient weak topic queries
CREATE INDEX IF NOT EXISTS idx_topic_mastery_score 
  ON topic_mastery(user_id, course_id, mastery_score) 
  WHERE mastery_score < 0.4;

-- Function to calculate mastery_score from existing mastery_level
-- This backfills existing records
CREATE OR REPLACE FUNCTION backfill_mastery_scores()
RETURNS void AS $$
BEGIN
  UPDATE topic_mastery
  SET mastery_score = CASE
    WHEN mastery_level = 'strong' THEN 0.8
    WHEN mastery_level = 'moderate' THEN 0.5
    WHEN mastery_level = 'weak' THEN 0.2
    ELSE 0.5
  END
  WHERE mastery_score IS NULL OR mastery_score = 0.5;
END;
$$ LANGUAGE plpgsql;

-- Run backfill
SELECT backfill_mastery_scores();

-- Also calculate from accuracy if available
UPDATE topic_mastery
SET mastery_score = accuracy
WHERE accuracy IS NOT NULL 
  AND (mastery_score IS NULL OR mastery_score = 0.5);

-- Add constraint to ensure score is between 0 and 1
ALTER TABLE topic_mastery
ADD CONSTRAINT check_mastery_score_range 
CHECK (mastery_score >= 0.0 AND mastery_score <= 1.0);

