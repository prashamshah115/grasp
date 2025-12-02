-- Migration: Add personalization support to final_packs table
-- Description: Adds user_id and is_personalized columns to enable user-specific study packs

-- Add user_id column (nullable for course-level packs)
ALTER TABLE final_packs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE final_packs 
ADD COLUMN IF NOT EXISTS is_personalized boolean DEFAULT false;

-- Update unique constraint to allow personalized packs per user
ALTER TABLE final_packs 
DROP CONSTRAINT IF EXISTS final_packs_course_id_tier_key;

-- New unique constraint: course-level packs are unique by (course_id, tier)
-- Personalized packs are unique by (user_id, course_id, tier)
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_packs_unique_course
  ON final_packs(course_id, tier) 
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_final_packs_unique_user
  ON final_packs(user_id, course_id, tier) 
  WHERE user_id IS NOT NULL;

-- Index for efficient user pack queries
CREATE INDEX IF NOT EXISTS idx_final_packs_user 
  ON final_packs(user_id, course_id) 
  WHERE user_id IS NOT NULL;

-- Update RLS policy to allow users to view their personalized packs
DROP POLICY IF EXISTS "Users can view final packs for enrolled courses" ON final_packs;

CREATE POLICY "Users can view final packs for enrolled courses"
  ON final_packs FOR SELECT
  USING (
    -- Course-level packs: user must be enrolled
    (user_id IS NULL AND EXISTS (
      SELECT 1 FROM user_courses 
      WHERE user_courses.user_id = auth.uid() 
        AND user_courses.course_id = final_packs.course_id
    ))
    OR
    -- Personalized packs: user must own them
    (user_id = auth.uid())
  );

