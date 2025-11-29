-- Migration: Knowledge State Vector (KSV)
-- Description: Creates adaptive finals preparation engine infrastructure
-- Computed state vector that powers personalized recommendations

-- ============================================
-- 1. KNOWLEDGE STATE VECTOR TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_state_vector (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  
  -- Core metrics (computed from existing data)
  knowledge_strength NUMERIC(4,3) NOT NULL DEFAULT 0.0 
    CHECK (knowledge_strength >= 0 AND knowledge_strength <= 1),
  mastery_score INTEGER NOT NULL DEFAULT 0 
    CHECK (mastery_score >= 0 AND mastery_score <= 5),
  error_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0 
    CHECK (error_rate >= 0 AND error_rate <= 1),
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  coverage NUMERIC(5,4) NOT NULL DEFAULT 0.0 
    CHECK (coverage >= 0 AND coverage <= 1),
  
  -- Graph-based metrics (from course_graph_edges)
  graph_in_degree INTEGER NOT NULL DEFAULT 0, -- # of prerequisites
  graph_out_degree INTEGER NOT NULL DEFAULT 0, -- # of downstream topics (importance)
  
  -- Recency and engagement
  last_reviewed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  engagement_score NUMERIC(5,4) NOT NULL DEFAULT 0.0 
    CHECK (engagement_score >= 0 AND engagement_score <= 1),
  
  -- Computed recommendation scores (cached for performance)
  recommendation_score NUMERIC(5,4) NOT NULL DEFAULT 0.0 
    CHECK (recommendation_score >= 0 AND recommendation_score <= 1),
  priority_rank INTEGER,
  
  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (user_id, course_id, topic_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ksv_user_course ON knowledge_state_vector(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_ksv_recommendation_score ON knowledge_state_vector(user_id, course_id, recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_ksv_topic ON knowledge_state_vector(topic_id);
CREATE INDEX IF NOT EXISTS idx_ksv_updated_at ON knowledge_state_vector(updated_at DESC);

-- RLS Policies
ALTER TABLE knowledge_state_vector ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own KSV"
  ON knowledge_state_vector FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own KSV"
  ON knowledge_state_vector FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert KSV (via service role)"
  ON knowledge_state_vector FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 2. HELPER FUNCTION: Calculate Recommendation Score
-- ============================================
CREATE OR REPLACE FUNCTION calculate_recommendation_score(
  p_weakness_score NUMERIC,
  p_importance_score NUMERIC,
  p_recency_score NUMERIC,
  p_final_packs_score NUMERIC,
  p_confusion_score NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    0.40 * COALESCE(p_weakness_score, 0) +
    0.25 * COALESCE(p_importance_score, 0) +
    0.20 * COALESCE(p_recency_score, 0) +
    0.10 * COALESCE(p_final_packs_score, 0) +
    0.05 * COALESCE(p_confusion_score, 0)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. MAIN FUNCTION: Compute Knowledge State Vector
-- ============================================
CREATE OR REPLACE FUNCTION compute_knowledge_state_vector(
  p_user_id UUID,
  p_course_id UUID
) RETURNS TABLE (
  user_id UUID,
  course_id UUID,
  topic_id UUID,
  knowledge_strength NUMERIC,
  mastery_score INTEGER,
  error_rate NUMERIC,
  time_spent_sec INTEGER,
  coverage NUMERIC,
  graph_in_degree INTEGER,
  graph_out_degree INTEGER,
  last_reviewed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  engagement_score NUMERIC,
  recommendation_score NUMERIC
) AS $$
  DECLARE
  v_max_out_degree INTEGER;
  v_topic_record RECORD;
  v_knowledge_strength NUMERIC := 0.0;
  v_mastery_score INTEGER := 0;
  v_num_correct INTEGER := 0;
  v_error_rate NUMERIC := 0.0;
  v_time_spent_sec INTEGER := 0;
  v_coverage NUMERIC := 0.0;
  v_graph_in_degree INTEGER := 0;
  v_graph_out_degree INTEGER := 0;
  v_last_reviewed_at TIMESTAMPTZ;
  v_last_attempt_at TIMESTAMPTZ;
  v_engagement_score NUMERIC := 0.0;
  v_weakness_score NUMERIC;
  v_importance_score NUMERIC;
  v_recency_score NUMERIC;
  v_final_packs_score NUMERIC;
  v_confusion_score NUMERIC;
  v_recommendation_score NUMERIC;
BEGIN
  -- Get max out degree for normalization
  SELECT COALESCE(MAX(graph_out_degree), 1) INTO v_max_out_degree
  FROM (
    SELECT COUNT(*) as graph_out_degree
    FROM course_graph_edges
    WHERE course_id = p_course_id
    GROUP BY topic_a
  ) subq;

  -- Loop through all topics in course
  FOR v_topic_record IN 
    SELECT t.id as topic_id, t.name
    FROM topics t
    WHERE t.course_id = p_course_id
  LOOP
    -- Calculate knowledge_strength from mastery
    SELECT 
      COALESCE(
        CASE 
          WHEN tm.mastery_level = 'strong' THEN 0.8
          WHEN tm.mastery_level = 'moderate' THEN 0.5
          WHEN tm.mastery_level = 'weak' THEN 0.2
          ELSE 0.0
        END,
        0.0
      ),
      COALESCE(tm.num_attempts, 0),
      COALESCE(tm.num_correct, 0),
      tm.last_practiced_at
    INTO 
      v_knowledge_strength,
      v_mastery_score,
      v_num_correct,
      v_last_reviewed_at
    FROM topic_mastery tm
    WHERE tm.user_id = p_user_id 
      AND tm.topic_id = v_topic_record.topic_id
    LIMIT 1;

    -- Calculate error_rate from question_attempts
    SELECT 
      COALESCE(
        CASE 
          WHEN COUNT(*) > 0 THEN 
            (COUNT(*) FILTER (WHERE NOT is_correct))::NUMERIC / COUNT(*)::NUMERIC
          ELSE 0.0
        END,
        0.0
      ),
      COALESCE(SUM(time_taken_sec), 0),
      MAX(created_at)
    INTO 
      v_error_rate,
      v_time_spent_sec,
      v_last_attempt_at
    FROM question_attempts qa
    JOIN questions q ON q.id = qa.question_id
    WHERE qa.user_id = p_user_id
      AND q.topic_id = v_topic_record.topic_id;

    -- Calculate graph in/out degrees
    SELECT 
      COUNT(*) FILTER (WHERE topic_b = v_topic_record.topic_id AND relation = 'prerequisite'),
      COUNT(*) FILTER (WHERE topic_a = v_topic_record.topic_id)
    INTO 
      v_graph_in_degree,
      v_graph_out_degree
    FROM course_graph_edges
    WHERE course_id = p_course_id;

    -- Calculate engagement_score (simplified: based on recent activity)
    v_engagement_score := COALESCE(
      CASE 
        WHEN v_last_reviewed_at > NOW() - INTERVAL '7 days' THEN 0.8
        WHEN v_last_reviewed_at > NOW() - INTERVAL '14 days' THEN 0.5
        WHEN v_last_reviewed_at > NOW() - INTERVAL '30 days' THEN 0.2
        ELSE 0.0
      END,
      0.0
    );

    -- Calculate coverage (simplified: based on question attempts)
    v_coverage := COALESCE(
      CASE 
        WHEN v_mastery_score >= 3 THEN 1.0
        WHEN v_mastery_score >= 1 THEN 0.5
        ELSE 0.0
      END,
      0.0
    );

    -- Calculate recommendation score components
    v_weakness_score := 1.0 - v_knowledge_strength;
    v_importance_score := COALESCE(v_graph_out_degree::NUMERIC / NULLIF(v_max_out_degree, 0), 0);
    
    -- Recency decay: more recent = lower score (want to review older topics)
    v_recency_score := COALESCE(
      CASE 
        WHEN v_last_reviewed_at IS NULL THEN 1.0
        WHEN v_last_reviewed_at > NOW() - INTERVAL '7 days' THEN 0.2
        WHEN v_last_reviewed_at > NOW() - INTERVAL '14 days' THEN 0.5
        WHEN v_last_reviewed_at > NOW() - INTERVAL '30 days' THEN 0.8
        ELSE 1.0
      END,
      1.0
    );

    -- Final packs score (placeholder - will be enhanced later)
    v_final_packs_score := 0.5;

    -- Confusion score
    v_confusion_score := v_error_rate * LEAST(v_mastery_score::NUMERIC / 10.0, 1.0);

    -- Calculate final recommendation score
    v_recommendation_score := calculate_recommendation_score(
      v_weakness_score,
      v_importance_score,
      v_recency_score,
      v_final_packs_score,
      v_confusion_score
    );

    -- Upsert into knowledge_state_vector
    INSERT INTO knowledge_state_vector (
      user_id, course_id, topic_id,
      knowledge_strength, mastery_score, error_rate, time_spent_sec, coverage,
      graph_in_degree, graph_out_degree,
      last_reviewed_at, last_attempt_at, engagement_score,
      recommendation_score,
      updated_at
    ) VALUES (
      p_user_id, p_course_id, v_topic_record.topic_id,
      v_knowledge_strength, v_mastery_score, v_error_rate, v_time_spent_sec, v_coverage,
      v_graph_in_degree, v_graph_out_degree,
      v_last_reviewed_at, v_last_attempt_at, v_engagement_score,
      v_recommendation_score,
      NOW()
    )
    ON CONFLICT (user_id, course_id, topic_id) 
    DO UPDATE SET
      knowledge_strength = EXCLUDED.knowledge_strength,
      mastery_score = EXCLUDED.mastery_score,
      error_rate = EXCLUDED.error_rate,
      time_spent_sec = EXCLUDED.time_spent_sec,
      coverage = EXCLUDED.coverage,
      graph_in_degree = EXCLUDED.graph_in_degree,
      graph_out_degree = EXCLUDED.graph_out_degree,
      last_reviewed_at = EXCLUDED.last_reviewed_at,
      last_attempt_at = EXCLUDED.last_attempt_at,
      engagement_score = EXCLUDED.engagement_score,
      recommendation_score = EXCLUDED.recommendation_score,
      updated_at = NOW();

    -- Return the record
    RETURN QUERY SELECT 
      p_user_id,
      p_course_id,
      v_topic_record.topic_id,
      v_knowledge_strength,
      v_mastery_score,
      v_error_rate,
      v_time_spent_sec,
      v_coverage,
      v_graph_in_degree,
      v_graph_out_degree,
      v_last_reviewed_at,
      v_last_attempt_at,
      v_engagement_score,
      v_recommendation_score;
  END LOOP;

  -- Update priority_rank after all records are computed
  UPDATE knowledge_state_vector ksv1
  SET priority_rank = subq.rank
  FROM (
    SELECT 
      user_id, course_id, topic_id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, course_id 
        ORDER BY recommendation_score DESC
      ) as rank
    FROM knowledge_state_vector
    WHERE user_id = p_user_id AND course_id = p_course_id
  ) subq
  WHERE ksv1.user_id = subq.user_id
    AND ksv1.course_id = subq.course_id
    AND ksv1.topic_id = subq.topic_id;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. TRIGGER: Auto-update KSV on mastery changes
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_ksv_on_mastery_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Recompute KSV for the affected user/course/topic
  PERFORM compute_knowledge_state_vector(NEW.user_id, (
    SELECT course_id FROM topics WHERE id = NEW.topic_id
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ksv_on_mastery_change
  AFTER INSERT OR UPDATE ON topic_mastery
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_ksv_on_mastery_change();

-- ============================================
-- 5. TRIGGER: Auto-update KSV on question attempts
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_ksv_on_question_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
  v_topic_id UUID;
BEGIN
  -- Get course_id and topic_id from question
  SELECT q.course_id, q.topic_id INTO v_course_id, v_topic_id
  FROM questions q
  WHERE q.id = NEW.question_id;

  IF v_course_id IS NOT NULL THEN
    PERFORM compute_knowledge_state_vector(NEW.user_id, v_course_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ksv_on_question_attempt
  AFTER INSERT ON question_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_ksv_on_question_attempt();

