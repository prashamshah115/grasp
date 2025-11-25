-- Migration: Implement Event Log + Snapshot Pattern for Exam State
-- Purpose: Add event log table and enhance exam_sessions with snapshot fields
-- Pattern: Industry-standard event sourcing + snapshot for fault tolerance and resume capability

-- ============================================
-- 1. CREATE EVENTS TABLE (Append-only log)
-- ============================================

CREATE TABLE IF NOT EXISTS events_exam_progress (
    id bigserial PRIMARY KEY,
    session_id uuid REFERENCES exam_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type text NOT NULL CHECK (event_type IN ('answer', 'flag', 'navigate', 'start', 'submit', 'time_update')),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast replay and analytics
CREATE INDEX IF NOT EXISTS idx_events_exam_progress_session_created 
    ON events_exam_progress(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_exam_progress_user_created 
    ON events_exam_progress(user_id, created_at DESC);

-- ============================================
-- 2. ENHANCE EXAM_SESSIONS (Snapshot fields)
-- ============================================

-- Add snapshot fields to exam_sessions
ALTER TABLE exam_sessions
    ADD COLUMN IF NOT EXISTS current_question_index int DEFAULT 0,
    ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS state jsonb DEFAULT '{}'::jsonb;

-- Add index for fast active session lookup
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_exam_active 
    ON exam_sessions(user_id, exam_id, is_completed) 
    WHERE is_completed = false;

-- ============================================
-- 3. RLS POLICIES FOR EVENTS TABLE
-- ============================================

ALTER TABLE events_exam_progress ENABLE ROW LEVEL SECURITY;

-- Users can read their own events
CREATE POLICY "Users can read their own exam events"
    ON events_exam_progress
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert events for their own sessions
CREATE POLICY "Users can insert events for their own sessions"
    ON events_exam_progress
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM exam_sessions 
            WHERE id = session_id 
            AND user_id = auth.uid()
        )
    );

-- Deny updates and deletes (append-only)
CREATE POLICY "Events are append-only"
    ON events_exam_progress
    FOR UPDATE
    USING (false);

CREATE POLICY "Events cannot be deleted"
    ON events_exam_progress
    FOR DELETE
    USING (false);

-- ============================================
-- 4. HELPER FUNCTION: Update snapshot atomically
-- ============================================

CREATE OR REPLACE FUNCTION update_exam_snapshot(
    p_session_id uuid,
    p_event_type text,
    p_payload jsonb
) RETURNS void AS $$
BEGIN
    CASE p_event_type
        WHEN 'answer' THEN
            UPDATE exam_sessions
            SET 
                answers = jsonb_set(
                    COALESCE(answers, '{}'::jsonb), 
                    ARRAY[p_payload->>'questionId'], 
                    to_jsonb(p_payload->>'answer')
                )
            WHERE id = p_session_id;
            
        WHEN 'flag' THEN
            UPDATE exam_sessions
            SET 
                state = jsonb_set(
                    COALESCE(state, '{}'::jsonb),
                    ARRAY['flags', p_payload->>'questionId'],
                    to_jsonb((p_payload->>'isFlagged')::boolean)
                )
            WHERE id = p_session_id;
            
        WHEN 'navigate' THEN
            UPDATE exam_sessions
            SET 
                current_question_index = (p_payload->>'toIndex')::int
            WHERE id = p_session_id;
            
        WHEN 'time_update' THEN
            UPDATE exam_sessions
            SET 
                time_remaining_sec = (p_payload->>'timeRemainingSec')::int
            WHERE id = p_session_id;
            
        WHEN 'submit' THEN
            UPDATE exam_sessions
            SET 
                is_completed = true,
                submitted_at = now()
            WHERE id = p_session_id;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGER: Auto-update snapshot on event insert
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_exam_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_exam_snapshot(NEW.session_id, NEW.event_type, NEW.payload);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_snapshot_on_event
    AFTER INSERT ON events_exam_progress
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_exam_snapshot();

-- ============================================
-- 6. MIGRATE EXISTING DATA (Convert exam_answers to events)
-- ============================================

-- Migrate existing exam_answers to events
INSERT INTO events_exam_progress (session_id, user_id, event_type, payload, created_at)
SELECT 
    ea.session_id,
    es.user_id,
    'answer' as event_type,
    jsonb_build_object(
        'questionId', ea.question_id::text,
        'answer', ea.user_answer::text,
        'isFlagged', COALESCE(ea.is_flagged, false)
    ) as payload,
    COALESCE(ea.answered_at, es.started_at) as created_at
FROM exam_answers ea
JOIN exam_sessions es ON es.id = ea.session_id
WHERE NOT EXISTS (
    SELECT 1 FROM events_exam_progress eep
    WHERE eep.session_id = ea.session_id
    AND eep.event_type = 'answer'
    AND eep.payload->>'questionId' = ea.question_id::text
);

-- Rebuild snapshots from events for existing sessions
DO $$
DECLARE
    session_record RECORD;
    answer_record RECORD;
BEGIN
    FOR session_record IN 
        SELECT DISTINCT session_id FROM events_exam_progress
    LOOP
        -- Rebuild answers jsonb
        UPDATE exam_sessions es
        SET answers = (
            SELECT jsonb_object_agg(
                payload->>'questionId',
                payload->>'answer'
            )
            FROM events_exam_progress
            WHERE session_id = es.id
            AND event_type = 'answer'
        )
        WHERE id = session_record.session_id;
        
        -- Rebuild flags in state jsonb
        UPDATE exam_sessions es
        SET state = jsonb_build_object(
            'flags', (
                SELECT jsonb_object_agg(
                    payload->>'questionId',
                    (payload->>'isFlagged')::boolean
                )
                FROM events_exam_progress
                WHERE session_id = es.id
                AND event_type = 'flag'
            )
        )
        WHERE id = session_record.session_id;
    END LOOP;
END $$;

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE events_exam_progress IS 'Append-only event log for exam progress. Provides audit trail and recovery capability.';
COMMENT ON COLUMN exam_sessions.answers IS 'Snapshot of all answers as jsonb: {questionId: answer}';
COMMENT ON COLUMN exam_sessions.state IS 'Snapshot of exam state: {flags: {questionId: boolean}, ...}';
COMMENT ON COLUMN exam_sessions.current_question_index IS 'Current question index for resume capability';

