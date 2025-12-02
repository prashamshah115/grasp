-- Migration: Final Packs Prerequisites and Job Status Tracking
-- Description: Adds prerequisite validation functions and job status tracking for async jobs

-- ============================================
-- 1. PREREQUISITES CHECK FUNCTIONS
-- ============================================

-- Function: Check if prerequisites are met for final pack generation
CREATE OR REPLACE FUNCTION check_final_packs_prerequisites(p_course_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_knowledge_objects_count INTEGER := 0;
  v_questions_count INTEGER := 0;
  v_missing_items TEXT[] := ARRAY[]::TEXT[];
  v_result JSONB;
BEGIN
  -- Check knowledge objects
  SELECT COUNT(*) INTO v_knowledge_objects_count
  FROM knowledge_objects
  WHERE course_id = p_course_id;

  -- Check questions
  SELECT COUNT(*) INTO v_questions_count
  FROM questions
  WHERE course_id = p_course_id;

  -- Determine what's missing
  IF v_knowledge_objects_count = 0 THEN
    v_missing_items := array_append(v_missing_items, 'knowledge_objects');
  END IF;

  IF v_questions_count = 0 THEN
    v_missing_items := array_append(v_missing_items, 'questions');
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'has_knowledge_objects', v_knowledge_objects_count > 0,
    'knowledge_objects_count', v_knowledge_objects_count,
    'has_questions', v_questions_count > 0,
    'questions_count', v_questions_count,
    'can_generate', v_knowledge_objects_count > 0, -- Knowledge objects are required
    'missing_items', v_missing_items
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Check if prerequisites are met for study plan generation
CREATE OR REPLACE FUNCTION check_study_plan_prerequisites(
  p_user_id UUID,
  p_course_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_topics_count INTEGER := 0;
  v_mastery_count INTEGER := 0;
  v_graph_edges_count INTEGER := 0;
  v_has_mastery_data BOOLEAN := false;
  v_missing_items TEXT[] := ARRAY[]::TEXT[];
  v_result JSONB;
BEGIN
  -- Check topics
  SELECT COUNT(*) INTO v_topics_count
  FROM topics
  WHERE course_id = p_course_id;

  -- Check mastery data (optional but helpful)
  SELECT COUNT(*) INTO v_mastery_count
  FROM topic_mastery
  WHERE user_id = p_user_id 
    AND topic_id IN (SELECT id FROM topics WHERE course_id = p_course_id);

  v_has_mastery_data := v_mastery_count > 0;

  -- Check graph edges (optional but helpful for prerequisite ordering)
  SELECT COUNT(*) INTO v_graph_edges_count
  FROM course_graph_edges
  WHERE course_id = p_course_id;

  -- Determine what's missing (only topics are required)
  IF v_topics_count = 0 THEN
    v_missing_items := array_append(v_missing_items, 'topics');
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'has_topics', v_topics_count > 0,
    'topics_count', v_topics_count,
    'has_mastery_data', v_has_mastery_data,
    'mastery_count', v_mastery_count,
    'has_graph_edges', v_graph_edges_count > 0,
    'graph_edges_count', v_graph_edges_count,
    'can_generate', v_topics_count > 0, -- Topics are required
    'missing_items', v_missing_items,
    'warnings', CASE 
      WHEN v_mastery_count = 0 THEN ARRAY['No mastery data - plan will use default assumptions']
      WHEN v_graph_edges_count = 0 THEN ARRAY['No graph edges - plan will not use prerequisite ordering']
      ELSE ARRAY[]::TEXT[]
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. JOB STATUS TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS job_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('final_packs', 'study_plan', 'knowledge_graph')),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_job_id TEXT, -- Trigger.dev run ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_status_course_job_status 
  ON job_status(course_id, job_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_status_trigger_job_id 
  ON job_status(trigger_job_id) WHERE trigger_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_status_user_status 
  ON job_status(user_id, status, created_at DESC) WHERE user_id IS NOT NULL;

-- RLS Policies
ALTER TABLE job_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own job status or course-level jobs for courses they're enrolled in
CREATE POLICY "Users can view their own job status"
  ON job_status FOR SELECT
  USING (
    -- User-specific jobs
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR
    -- Course-level jobs for enrolled courses
    (user_id IS NULL AND EXISTS (
      SELECT 1 FROM user_courses 
      WHERE user_courses.user_id = auth.uid() 
        AND user_courses.course_id = job_status.course_id
    ))
  );

-- System can insert/update (via service role)
CREATE POLICY "System can manage job status"
  ON job_status FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. HELPER FUNCTION: Get Latest Job Status
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_job_status(
  p_job_type TEXT,
  p_course_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  job_type TEXT,
  course_id UUID,
  user_id UUID,
  trigger_job_id TEXT,
  status TEXT,
  progress_percent INTEGER,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    js.id,
    js.job_type,
    js.course_id,
    js.user_id,
    js.trigger_job_id,
    js.status,
    js.progress_percent,
    js.metadata,
    js.error_message,
    js.created_at,
    js.completed_at,
    js.updated_at
  FROM job_status js
  WHERE js.job_type = p_job_type
    AND js.course_id = p_course_id
    AND (p_user_id IS NULL OR js.user_id = p_user_id)
  ORDER BY js.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. TRIGGER: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_job_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_status_updated_at
  BEFORE UPDATE ON job_status
  FOR EACH ROW
  EXECUTE FUNCTION update_job_status_updated_at();

