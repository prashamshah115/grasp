-- Add RLS policies for courses table
-- Allows authenticated users to create courses and view all courses

-- Enable RLS on courses table
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view courses (for course catalog)
CREATE POLICY "Anyone can view courses"
  ON courses FOR SELECT
  USING (true);

-- Policy: Authenticated users can create courses
CREATE POLICY "Authenticated users can create courses"
  ON courses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update courses they created (optional - for future use)
-- Note: We don't have a created_by field yet, so this is commented out
-- CREATE POLICY "Users can update their own courses"
--   ON courses FOR UPDATE
--   USING (auth.uid() = created_by);

