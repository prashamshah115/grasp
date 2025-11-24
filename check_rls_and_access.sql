-- ==========================================
-- COMPREHENSIVE RLS & ACCESS STATUS CHECK
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- 0. CHECK ALL TABLES THAT EXIST (to find correct names)
-- ==========================================
SELECT 
    tablename
FROM pg_tables
WHERE schemaname = 'public'
    AND (
        tablename LIKE '%embed%' OR
        tablename LIKE '%document%' OR
        tablename LIKE '%course%' OR
        tablename LIKE '%user%' OR
        tablename LIKE '%topic%'
    )
ORDER BY tablename;

-- ==========================================
-- 1. CHECK RLS STATUS ON ALL RELEVANT TABLES
-- ==========================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'courses',
        'documents',
        'document_pages',
        'document_page_embeddings',
        'user_courses',
        'topics',
        'course_uploads'
    )
ORDER BY tablename;

-- ==========================================
-- 2. CHECK ALL RLS POLICIES
-- ==========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command, -- SELECT, INSERT, UPDATE, DELETE
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'courses',
        'documents',
        'document_pages',
        'user_courses',
        'topics',
        'course_uploads'
    )
ORDER BY tablename, policyname;

-- ==========================================
-- 3. CHECK COURSES TABLE POLICIES
-- ==========================================
SELECT 
    'courses' as table_name,
    policyname,
    cmd as command,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'courses';

-- ==========================================
-- 4. CHECK DOCUMENTS TABLE POLICIES
-- ==========================================
SELECT 
    'documents' as table_name,
    policyname,
    cmd as command,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'documents';

-- ==========================================
-- 5. CHECK DOCUMENT_PAGES TABLE POLICIES
-- ==========================================
SELECT 
    'document_pages' as table_name,
    policyname,
    cmd as command,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'document_pages';

-- ==========================================
-- 6. CHECK USER_COURSES TABLE POLICIES
-- ==========================================
SELECT 
    'user_courses' as table_name,
    policyname,
    cmd as command,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_courses';

-- ==========================================
-- 7. CHECK IF RPC FUNCTION EXISTS
-- ==========================================
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosecdef as security_definer,
    p.proacl as access_privileges
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'search_document_pages';

-- ==========================================
-- 8. CHECK DOCUMENT ACCESS PATTERNS
-- ==========================================
SELECT 
    COUNT(*) as total_documents,
    COUNT(CASE WHEN owner_user_id IS NULL THEN 1 END) as public_documents,
    COUNT(CASE WHEN owner_user_id IS NOT NULL THEN 1 END) as owned_documents,
    COUNT(DISTINCT course_id) as unique_courses,
    COUNT(DISTINCT topic_id) as unique_topics
FROM documents;

-- ==========================================
-- 9. CHECK DOCUMENT PAGES STATUS
-- ==========================================
SELECT 
    COUNT(*) as total_pages,
    COUNT(DISTINCT document_id) as documents_with_pages,
    COUNT(DISTINCT d.course_id) as courses_with_documents
FROM document_pages dp
JOIN documents d ON dp.document_id = d.id;

-- ==========================================
-- 10. CHECK EMBEDDINGS STATUS
-- ==========================================
-- Check for document_page_embeddings table (with underscores)
SELECT 
    COUNT(*) as total_embeddings,
    COUNT(DISTINCT page_id) as pages_with_embeddings
FROM document_page_embeddings;

-- ==========================================
-- 11. CHECK USER ENROLLMENTS
-- ==========================================
SELECT 
    COUNT(*) as total_enrollments,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT course_id) as unique_courses
FROM user_courses;

-- ==========================================
-- 12. CHECK COURSES ACCESSIBLE TO CURRENT USER
-- ==========================================
-- Note: This will show courses for the authenticated user
-- Run this while authenticated as a test user
SELECT 
    c.id,
    c.code,
    c.name,
    c.term,
    CASE 
        WHEN uc.user_id IS NOT NULL THEN 'Enrolled'
        ELSE 'Not Enrolled'
    END as enrollment_status
FROM courses c
LEFT JOIN user_courses uc ON c.id = uc.course_id 
    AND uc.user_id = auth.uid()
ORDER BY c.code;

-- ==========================================
-- 13. CHECK DOCUMENTS ACCESSIBLE TO CURRENT USER
-- ==========================================
-- Note: This tests RLS policies - run while authenticated
SELECT 
    d.id,
    d.title,
    d.course_id,
    d.topic_id,
    d.owner_user_id,
    CASE 
        WHEN d.owner_user_id IS NULL THEN 'Public'
        WHEN d.owner_user_id = auth.uid() THEN 'Owned by me'
        ELSE 'Other'
    END as access_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM user_courses uc 
            WHERE uc.course_id = d.course_id 
            AND uc.user_id = auth.uid()
        ) THEN 'Enrolled in course'
        ELSE 'Not enrolled'
    END as enrollment_status
FROM documents d
ORDER BY d.course_id, d.title
LIMIT 20;

-- ==========================================
-- 14. CHECK DOCUMENT PAGES ACCESSIBLE TO CURRENT USER
-- ==========================================
-- Note: This tests RLS policies - run while authenticated
SELECT 
    dp.id,
    dp.page_number,
    dp.document_id,
    d.title as document_title,
    d.course_id,
    d.owner_user_id
FROM document_pages dp
JOIN documents d ON dp.document_id = d.id
ORDER BY d.course_id, d.title, dp.page_number
LIMIT 20;

-- ==========================================
-- 15. CHECK IF MIGRATIONS WERE APPLIED
-- ==========================================
-- Check for migration files that should have been applied
SELECT 
    version,
    name,
    inserted_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%rls%' OR name LIKE '%courses%' OR name LIKE '%documents%'
ORDER BY inserted_at DESC;

-- ==========================================
-- 16. TEST RPC FUNCTION (if it exists)
-- ==========================================
-- This will fail if function doesn't exist or has wrong signature
-- Replace with actual values for testing
/*
SELECT * FROM search_document_pages(
    query_embedding := ARRAY[0.1]::float[] || ARRAY(SELECT 0.1 FROM generate_series(1, 767))::float[],
    filter_course_id := NULL,
    filter_topic_id := NULL,
    filter_user_id := auth.uid(),
    match_threshold := 0.6,
    match_count := 10
);
*/

-- ==========================================
-- 17. CHECK FOR MISSING INDEXES (performance)
-- ==========================================
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'documents', 
        'document_pages', 
        'document_page_embeddings',
        'user_courses'
    )
ORDER BY tablename, indexname;

-- ==========================================
-- 19. CHECK EMBEDDINGS TABLE STRUCTURE
-- ==========================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'document_page_embeddings'
ORDER BY ordinal_position;

-- ==========================================
-- 18. SUMMARY REPORT
-- ==========================================
SELECT 
    'RLS Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'courses' 
            AND rowsecurity = true
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as courses_rls,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'documents' 
            AND rowsecurity = true
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as documents_rls,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'document_pages' 
            AND rowsecurity = true
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as document_pages_rls,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'search_document_pages'
        ) THEN '✅ Exists'
        ELSE '❌ Missing'
    END as rpc_function;

