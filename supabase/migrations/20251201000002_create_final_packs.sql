-- Migration: Create final_packs table
-- Description: Stores precomputed final exam study packs (essentials, must_solve, drills)

CREATE TABLE IF NOT EXISTS final_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('essentials', 'must_solve', 'drills')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, tier)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_final_packs_course_tier 
  ON final_packs(course_id, tier);
CREATE INDEX IF NOT EXISTS idx_final_packs_course 
  ON final_packs(course_id);
CREATE INDEX IF NOT EXISTS idx_final_packs_generated_at 
  ON final_packs(generated_at DESC);

-- RLS Policies
ALTER TABLE final_packs ENABLE ROW LEVEL SECURITY;

-- Users can view final packs for courses they're enrolled in
CREATE POLICY "Users can view final packs for enrolled courses"
  ON final_packs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_courses 
      WHERE user_courses.user_id = auth.uid() 
        AND user_courses.course_id = final_packs.course_id
    )
  );

-- System can insert/update final packs (via service role)
CREATE POLICY "System can manage final packs"
  ON final_packs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_final_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER final_packs_updated_at
  BEFORE UPDATE ON final_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_final_packs_updated_at();

