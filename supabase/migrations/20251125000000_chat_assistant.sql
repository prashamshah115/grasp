-- Migration: Chat Assistant Layer
-- Description: Adds persistent chat threads, messages, and RAG context tracking
-- for production-grade AI assistant with audit trail

-- ============================================
-- 1. CHAT THREADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
    
    title text,
    model text NOT NULL DEFAULT 'gpt-4-turbo-preview',
    system_prompt text,
    
    status text NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'archived')),
    
    last_user_message_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for chat_threads
CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_course ON chat_threads(course_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_topic ON chat_threads(topic_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_topic ON chat_threads(user_id, topic_id);

-- ============================================
-- 2. CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'context')),
    content text NOT NULL,
    
    token_count integer,
    model_used text,
    raw_response jsonb,
    
    created_at timestamptz DEFAULT now()
);

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at);

-- ============================================
-- 3. CHAT RAG CONTEXTS TABLE (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_rag_contexts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    
    chunk_id bigint REFERENCES document_chunks(id),
    page_id uuid REFERENCES document_pages(id),
    document_id uuid REFERENCES documents(id),
    
    source_type text CHECK (source_type IN ('page', 'chunk', 'compression_note')),
    similarity_score float8,
    content_preview text,
    
    created_at timestamptz DEFAULT now()
);

-- Indexes for chat_rag_contexts
CREATE INDEX IF NOT EXISTS idx_chat_rag_contexts_msg ON chat_rag_contexts(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_rag_contexts_doc ON chat_rag_contexts(document_id);

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rag_contexts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES - chat_threads
-- ============================================
DROP POLICY IF EXISTS "Users see own threads" ON chat_threads;
CREATE POLICY "Users see own threads" ON chat_threads
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own threads" ON chat_threads;
CREATE POLICY "Users insert own threads" ON chat_threads
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own threads" ON chat_threads;
CREATE POLICY "Users update own threads" ON chat_threads
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own threads" ON chat_threads;
CREATE POLICY "Users delete own threads" ON chat_threads
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 6. RLS POLICIES - chat_messages
-- ============================================
DROP POLICY IF EXISTS "Users see own thread messages" ON chat_messages;
CREATE POLICY "Users see own thread messages" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_threads 
            WHERE chat_threads.id = chat_messages.thread_id 
            AND chat_threads.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users insert to own threads" ON chat_messages;
CREATE POLICY "Users insert to own threads" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_threads 
            WHERE chat_threads.id = chat_messages.thread_id 
            AND chat_threads.user_id = auth.uid()
        )
    );

-- ============================================
-- 7. RLS POLICIES - chat_rag_contexts
-- ============================================
DROP POLICY IF EXISTS "Users see context for own messages" ON chat_rag_contexts;
CREATE POLICY "Users see context for own messages" ON chat_rag_contexts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_threads t ON t.id = m.thread_id
            WHERE m.id = chat_rag_contexts.message_id 
            AND t.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users insert context for own messages" ON chat_rag_contexts;
CREATE POLICY "Users insert context for own messages" ON chat_rag_contexts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_messages m
            JOIN chat_threads t ON t.id = m.thread_id
            WHERE m.id = chat_rag_contexts.message_id 
            AND t.user_id = auth.uid()
        )
    );

-- ============================================
-- 8. ENABLE REALTIME FOR CHAT MESSAGES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================
-- 9. HELPER FUNCTION: Get or Create Thread for Topic
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_thread(
    p_user_id uuid,
    p_course_id uuid,
    p_topic_id uuid,
    p_model text DEFAULT 'gpt-4-turbo-preview'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_thread_id uuid;
BEGIN
    -- Try to find existing active thread for this user + topic
    SELECT id INTO v_thread_id
    FROM chat_threads
    WHERE user_id = p_user_id
      AND topic_id = p_topic_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no thread exists, create one
    IF v_thread_id IS NULL THEN
        INSERT INTO chat_threads (user_id, course_id, topic_id, model)
        VALUES (p_user_id, p_course_id, p_topic_id, p_model)
        RETURNING id INTO v_thread_id;
    END IF;
    
    RETURN v_thread_id;
END;
$$;

-- ============================================
-- 10. HELPER FUNCTION: Get Thread Messages with Pagination
-- ============================================
CREATE OR REPLACE FUNCTION get_thread_messages(
    p_thread_id uuid,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    role text,
    content text,
    token_count integer,
    model_used text,
    created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        id,
        role,
        content,
        token_count,
        model_used,
        created_at
    FROM chat_messages
    WHERE thread_id = p_thread_id
    ORDER BY created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- ============================================
-- 11. TRIGGER: Update thread's updated_at and last_user_message_at
-- ============================================
CREATE OR REPLACE FUNCTION update_thread_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE chat_threads
    SET 
        updated_at = now(),
        last_user_message_at = CASE 
            WHEN NEW.role = 'user' THEN now() 
            ELSE last_user_message_at 
        END
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_thread_timestamps ON chat_messages;
CREATE TRIGGER trg_update_thread_timestamps
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_timestamps();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
COMMENT ON TABLE chat_threads IS 'Persistent chat threads for AI assistant conversations';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat threads';
COMMENT ON TABLE chat_rag_contexts IS 'Audit trail of RAG context used for each assistant response';

