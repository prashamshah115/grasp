-- ==========================================
-- CHECK EMBEDDINGS TABLE STATUS
-- Verify document_page_embeddings table exists and has data
-- ==========================================

-- 1. Check if table exists
SELECT 
    EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_page_embeddings'
    ) as table_exists;

-- 2. Check table structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'document_page_embeddings'
ORDER BY ordinal_position;

-- 3. Check RLS status on embeddings table
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename = 'document_page_embeddings';

-- 4. Check RLS policies on embeddings table
SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'document_page_embeddings';

-- 5. Count embeddings
SELECT 
    COUNT(*) as total_embeddings,
    COUNT(DISTINCT page_id) as pages_with_embeddings,
    COUNT(DISTINCT document_id) as documents_with_embeddings
FROM document_page_embeddings;

-- 6. Check embedding dimensions (should be 768 for BGE)
SELECT 
    array_length(embedding, 1) as embedding_dimension,
    COUNT(*) as count
FROM document_page_embeddings
GROUP BY array_length(embedding, 1)
ORDER BY embedding_dimension;

-- 7. Sample embeddings to verify structure
SELECT 
    id,
    page_id,
    document_id,
    array_length(embedding, 1) as embedding_dimension,
    created_at
FROM document_page_embeddings
LIMIT 5;

-- 8. Check which documents have embeddings
SELECT 
    d.id as document_id,
    d.title,
    d.course_id,
    COUNT(DISTINCT dpe.page_id) as pages_with_embeddings,
    COUNT(DISTINCT dp.id) as total_pages,
    ROUND(
        COUNT(DISTINCT dpe.page_id)::numeric / NULLIF(COUNT(DISTINCT dp.id), 0) * 100, 
        2
    ) as embedding_coverage_percent
FROM documents d
LEFT JOIN document_pages dp ON dp.document_id = d.id
LEFT JOIN document_page_embeddings dpe ON dpe.page_id = dp.id
GROUP BY d.id, d.title, d.course_id
ORDER BY embedding_coverage_percent DESC, d.title
LIMIT 20;

-- 9. Check for pages without embeddings
SELECT 
    dp.id as page_id,
    dp.document_id,
    dp.page_number,
    d.title as document_title,
    d.course_id
FROM document_pages dp
JOIN documents d ON dp.document_id = d.id
LEFT JOIN document_page_embeddings dpe ON dpe.page_id = dp.id
WHERE dpe.id IS NULL
ORDER BY d.course_id, d.title, dp.page_number
LIMIT 20;

