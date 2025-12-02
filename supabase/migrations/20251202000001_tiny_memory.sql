-- Migration: Add user_memory table for simple personalized chat
-- Description: Ultra-simple memory system storing only 3 keys: preferred_style, struggling_topic, misconception

-- Ultra-simple memory table
CREATE TABLE user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  memory_key text NOT NULL, -- 'preferred_style', 'struggling_topic', 'misconception'
  memory_value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id, memory_key)
);

CREATE INDEX idx_user_memory_lookup ON user_memory(user_id, course_id);

-- RLS Policies
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

-- Users can only view/edit their own memory
CREATE POLICY "Users can manage their own memory"
  ON user_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_user_memory_updated_at();

