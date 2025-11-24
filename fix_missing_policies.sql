-- ==========================================
-- FIX MISSING RLS POLICIES
-- Run this if policies are missing
-- ==========================================

-- Enable RLS on courses (if not already enabled)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Enable RLS on documents (if not already enabled)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Enable RLS on document_pages (if not already enabled)
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate)
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can create courses" ON courses;
DROP POLICY IF EXISTS "Users can view accessible documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can create documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can view accessible document pages" ON document_pages;
DROP POLICY IF EXISTS "Authenticated users can create document pages" ON document_pages;

-- Create courses policies
CREATE POLICY "Anyone can view courses"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create courses"
  ON courses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create documents policies
CREATE POLICY "Users can view accessible documents"
  ON documents FOR SELECT
  USING (
    owner_user_id IS NULL 
    OR owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_courses 
      WHERE user_courses.user_id = auth.uid() 
      AND user_courses.course_id = documents.course_id
    )
  );

CREATE POLICY "Authenticated users can create documents"
  ON documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Create document_pages policies
CREATE POLICY "Users can view accessible document pages"
  ON document_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_pages.document_id
      AND (
        documents.owner_user_id IS NULL 
        OR documents.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_courses 
          WHERE user_courses.user_id = auth.uid() 
          AND user_courses.course_id = documents.course_id
        )
      )
    )
  );

CREATE POLICY "Authenticated users can create document pages"
  ON document_pages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Verify policies were created
SELECT 
    tablename,
    policyname,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('courses', 'documents', 'document_pages')
ORDER BY tablename, policyname;

