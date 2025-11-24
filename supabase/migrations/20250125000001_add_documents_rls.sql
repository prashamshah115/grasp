-- Add RLS policies for documents and document_pages tables
-- Allows users to access public documents and documents for courses they're enrolled in

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents where:
-- 1. owner_user_id IS NULL (public documents)
-- 2. owner_user_id = their user_id (their own documents)
-- 3. They are enrolled in the course (checked via user_courses)
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

-- Policy: Users can create documents (for uploads)
CREATE POLICY "Authenticated users can create documents"
  ON documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update their own documents
CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Enable RLS on document_pages table
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view document pages for accessible documents
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

-- Policy: Service role can insert document pages (for ingestion)
-- Note: This is handled by edge functions with service role, but we allow authenticated users too
CREATE POLICY "Authenticated users can create document pages"
  ON document_pages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

