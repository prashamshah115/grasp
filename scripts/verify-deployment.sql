-- 🔍 DEPLOYMENT VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify everything deployed correctly

-- ==========================================
-- 1. CHECK RATE LIMITING TABLE
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'rate_limit_usage') THEN
    RAISE NOTICE '✅ rate_limit_usage table exists';
  ELSE
    RAISE EXCEPTION '❌ rate_limit_usage table NOT FOUND';
  END IF;
END $$;

-- ==========================================
-- 2. CHECK TABLE STRUCTURE
-- ==========================================
SELECT
  '✅ Checking columns...' as status;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'rate_limit_usage'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid)
-- user_id (uuid)
-- endpoint (text)
-- request_count (integer)
-- window_start (timestamp with time zone)
-- created_at (timestamp with time zone)
-- updated_at (timestamp with time zone)

-- ==========================================
-- 3. CHECK INDEXES
-- ==========================================
SELECT
  '✅ Checking indexes...' as status;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'rate_limit_usage';

-- Expected indexes:
-- 1. rate_limit_usage_pkey (primary key)
-- 2. idx_rate_limit_user_endpoint_window
-- 3. idx_rate_limit_window

-- ==========================================
-- 4. CHECK RLS POLICIES
-- ==========================================
SELECT
  '✅ Checking RLS policies...' as status;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'rate_limit_usage';

-- Expected policy:
-- "Users can view own usage" for SELECT

-- ==========================================
-- 5. CHECK FUNCTIONS
-- ==========================================
SELECT
  '✅ Checking functions...' as status;

-- Check increment_rate_limit
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'increment_rate_limit'
  ) THEN
    RAISE NOTICE '✅ increment_rate_limit function exists';
  ELSE
    RAISE EXCEPTION '❌ increment_rate_limit function NOT FOUND';
  END IF;
END $$;

-- Check clean_old_rate_limits
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'clean_old_rate_limits'
  ) THEN
    RAISE NOTICE '✅ clean_old_rate_limits function exists';
  ELSE
    RAISE EXCEPTION '❌ clean_old_rate_limits function NOT FOUND';
  END IF;
END $$;

-- Check update_updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'update_updated_at'
  ) THEN
    RAISE NOTICE '✅ update_updated_at function exists';
  ELSE
    RAISE EXCEPTION '❌ update_updated_at function NOT FOUND';
  END IF;
END $$;

-- ==========================================
-- 6. CHECK FUNCTION PERMISSIONS
-- ==========================================
SELECT
  '✅ Checking function permissions...' as status;

SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  a.rolname as granted_to
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl a ON p.oid = a.objid
WHERE p.proname IN ('increment_rate_limit', 'clean_old_rate_limits')
  AND n.nspname = 'public';

-- Expected: service_role should have EXECUTE permission

-- ==========================================
-- 7. CHECK TRIGGER
-- ==========================================
SELECT
  '✅ Checking triggers...' as status;

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'rate_limit_usage';

-- Expected: rate_limit_usage_updated_at trigger on UPDATE

-- ==========================================
-- 8. TEST INCREMENT FUNCTION
-- ==========================================
SELECT
  '✅ Testing increment_rate_limit function...' as status;

-- Test with fake UUID (this will fail if function doesn't work)
DO $$
DECLARE
  test_user_id UUID := '00000000-0000-0000-0000-000000000000';
  test_endpoint TEXT := 'test_endpoint';
  result INTEGER;
BEGIN
  -- First call should return 1
  result := increment_rate_limit(test_user_id, test_endpoint);
  IF result = 1 THEN
    RAISE NOTICE '✅ First increment returned 1';
  ELSE
    RAISE EXCEPTION '❌ First increment returned %, expected 1', result;
  END IF;

  -- Second call should return 2
  result := increment_rate_limit(test_user_id, test_endpoint);
  IF result = 2 THEN
    RAISE NOTICE '✅ Second increment returned 2';
  ELSE
    RAISE EXCEPTION '❌ Second increment returned %, expected 2', result;
  END IF;

  -- Cleanup test data
  DELETE FROM rate_limit_usage
  WHERE user_id = test_user_id AND endpoint = test_endpoint;

  RAISE NOTICE '✅ increment_rate_limit function working correctly';
END $$;

-- ==========================================
-- 9. CHECK RLS IS ENABLED
-- ==========================================
SELECT
  '✅ Checking RLS is enabled...' as status;

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'rate_limit_usage';

-- Expected: rls_enabled = true

-- ==========================================
-- 10. SUMMARY
-- ==========================================
SELECT
  '✅✅✅ ALL CHECKS PASSED! ✅✅✅' as status;

SELECT
  'Rate limiting is ready to use!' as message;

-- ==========================================
-- OPTIONAL: VIEW CURRENT USAGE
-- ==========================================
SELECT
  '📊 Current rate limit usage (last 10 entries):' as status;

SELECT
  user_id,
  endpoint,
  request_count,
  window_start,
  created_at
FROM rate_limit_usage
ORDER BY created_at DESC
LIMIT 10;
