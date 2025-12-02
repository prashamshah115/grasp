-- Migration: Add Explicit Content and FRQ Fields to Questions
-- Purpose: Enable explicit explanations and FRQ grading for better student experience
-- Date: 2025-12-03

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS explanation_md TEXT,
ADD COLUMN IF NOT EXISTS primary_source_type TEXT CHECK (primary_source_type IN ('slide', 'notes', 'textbook', 'handout')),
ADD COLUMN IF NOT EXISTS primary_source_id TEXT,
ADD COLUMN IF NOT EXISTS primary_source_locator TEXT,
ADD COLUMN IF NOT EXISTS frq_ideal_answer TEXT,
ADD COLUMN IF NOT EXISTS frq_rubric_md TEXT;

COMMENT ON COLUMN questions.explanation_md IS 'Short conceptual explanation shown to students';
COMMENT ON COLUMN questions.primary_source_type IS 'Type of primary source material';
COMMENT ON COLUMN questions.primary_source_id IS 'Document ID or URL to source';
COMMENT ON COLUMN questions.primary_source_locator IS 'Human-readable location (e.g. "Slide 13", "Page 41")';
COMMENT ON COLUMN questions.frq_ideal_answer IS 'Reference answer for FRQ grading';
COMMENT ON COLUMN questions.frq_rubric_md IS 'Grading rubric in markdown format';

-- Add FRQ grading fields to exam_answers table
ALTER TABLE exam_answers
ADD COLUMN IF NOT EXISTS frq_score NUMERIC CHECK (frq_score >= 0 AND frq_score <= 1),
ADD COLUMN IF NOT EXISTS frq_feedback TEXT,
ADD COLUMN IF NOT EXISTS frq_confidence NUMERIC CHECK (frq_confidence >= 0 AND frq_confidence <= 1);

COMMENT ON COLUMN exam_answers.frq_score IS 'FRQ score (0-1 scale)';
COMMENT ON COLUMN exam_answers.frq_feedback IS 'Feedback from FRQ grading';
COMMENT ON COLUMN exam_answers.frq_confidence IS 'Confidence level of the grading (0-1)';

