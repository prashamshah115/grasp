-- ==========================================
-- QUICK ACCESS CHECK (Run while authenticated)
-- Tests if current user can access documents
-- ==========================================

-- 1. Check current user
SELECT 
    auth.uid() as current_user_id,
    auth.email() as current_user_email;

-- 2. Check user enrollments
SELECT 
    uc.course_id,
    c.code,
    c.name,
    uc.created_at as enrolled_at
FROM user_courses uc
JOIN courses c ON uc.course_id = c.id
WHERE uc.user_id = auth.uid();

-- 3. Check accessible documents (tests RLS)
SELECT 
    d.id,
    d.title,
    d.course_id,
    c.code as course_code,
    d.topic_id,
    t.name as topic_name,
    d.owner_user_id,
    CASE 
        WHEN d.owner_user_id IS NULL THEN 'Public'
        WHEN d.owner_user_id = auth.uid() THEN 'Owned'
        ELSE 'Other'
    END as ownership,
    (SELECT COUNT(*) FROM document_pages WHERE document_id = d.id) as page_count
FROM documents d
LEFT JOIN courses c ON d.course_id = c.id
LEFT JOIN topics t ON d.topic_id = t.id
ORDER BY c.code, d.title
LIMIT 50;

-- 4. Check accessible document pages (tests RLS)
SELECT 
    dp.id,
    dp.page_number,
    d.title as document_title,
    c.code as course_code,
    d.owner_user_id,
    CASE 
        WHEN d.owner_user_id IS NULL THEN 'Public'
        WHEN d.owner_user_id = auth.uid() THEN 'Owned'
        ELSE 'Other'
    END as ownership
FROM document_pages dp
JOIN documents d ON dp.document_id = d.id
LEFT JOIN courses c ON d.course_id = c.id
ORDER BY c.code, d.title, dp.page_number
LIMIT 50;

-- 5. Check if RPC function works (if embeddings exist)
-- Uncomment and replace with actual course_id to test
/*
SELECT COUNT(*) as matching_pages
FROM search_document_pages(
    query_embedding := ARRAY[0.1]::float[] || ARRAY(SELECT 0.1 FROM generate_series(1, 767))::float[],
    filter_course_id := 'YOUR_COURSE_ID_HERE'::uuid,
    filter_topic_id := NULL,
    filter_user_id := auth.uid(),
    match_threshold := 0.6,
    match_count := 10
);
*/

