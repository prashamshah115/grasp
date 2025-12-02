-- Migration: Add document_paragraphs table for paragraph-level retrieval
-- Description: Enables precise paragraph-level search instead of page-level, improving relevance

-- Simple paragraph table (no overkill)
CREATE TABLE document_paragraphs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES document_pages(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  paragraph_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768), -- BGE-compatible, same as existing
  page_number integer,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_paragraphs_embedding ON document_paragraphs USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_paragraphs_document ON document_paragraphs(document_id);
CREATE INDEX idx_paragraphs_page ON document_paragraphs(page_id, paragraph_index);

-- RLS Policies
ALTER TABLE document_paragraphs ENABLE ROW LEVEL SECURITY;

-- Users can view paragraphs for documents in courses they're enrolled in
CREATE POLICY "Users can view paragraphs for enrolled courses"
  ON document_paragraphs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_courses uc ON d.course_id = uc.course_id
      WHERE d.id = document_paragraphs.document_id
        AND uc.user_id = auth.uid()
    )
  );

-- System can manage paragraphs (via service role)
CREATE POLICY "System can manage paragraphs"
  ON document_paragraphs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Simple RPC: Search paragraphs + get neighbors
CREATE OR REPLACE FUNCTION search_document_paragraphs(
  query_embedding vector(768),
  filter_course_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  doc_title text,
  page_number int,
  similarity float,
  document_id uuid,
  paragraph_before text,
  paragraph_after text
) AS $$
BEGIN
  RETURN QUERY
  WITH matches AS (
    SELECT 
      p.id,
      p.content,
      p.paragraph_index,
      p.page_number,
      p.document_id,
      p.page_id,
      1 - (p.embedding <=> query_embedding) as similarity
    FROM document_paragraphs p
    JOIN documents d ON p.document_id = d.id
    WHERE 
      (filter_course_id IS NULL OR d.course_id = filter_course_id)
      AND 1 - (p.embedding <=> query_embedding) > match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT 
    m.id,
    m.content,
    d.title as doc_title,
    m.page_number,
    m.similarity,
    m.document_id,
    -- Get paragraph before
    (SELECT content FROM document_paragraphs 
     WHERE page_id = m.page_id AND paragraph_index = m.paragraph_index - 1
     LIMIT 1) as paragraph_before,
    -- Get paragraph after
    (SELECT content FROM document_paragraphs 
     WHERE page_id = m.page_id AND paragraph_index = m.paragraph_index + 1
     LIMIT 1) as paragraph_after
  FROM matches m
  JOIN documents d ON m.document_id = d.id;
END;
$$ LANGUAGE plpgsql;

