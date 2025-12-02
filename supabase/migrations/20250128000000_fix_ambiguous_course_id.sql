-- Fix ambiguous course_id reference in compute_knowledge_state_vector function
-- This migration fixes the "column reference 'course_id' is ambiguous" error
-- that occurs when inserting into question_attempts

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
    -- FIXED: Added explicit table qualifiers and course_id filter to prevent ambiguity
    SELECT 
      COALESCE(
        CASE 
          WHEN COUNT(*) > 0 THEN 
            (COUNT(*) FILTER (WHERE NOT qa.is_correct))::NUMERIC / COUNT(*)::NUMERIC
          ELSE 0.0
        END,
        0.0
      ),
      COALESCE(SUM(qa.time_taken_sec), 0),
      MAX(qa.created_at)
    INTO 
      v_error_rate,
      v_time_spent_sec,
      v_last_attempt_at
    FROM question_attempts qa
    JOIN questions q ON q.id = qa.question_id
    WHERE qa.user_id = p_user_id
      AND q.topic_id = v_topic_record.topic_id
      AND q.course_id = p_course_id;

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

