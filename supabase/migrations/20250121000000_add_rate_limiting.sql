-- ✅ PRODUCTION-SAFE RATE LIMITING TABLE
-- Prevents abuse of AI endpoints (RAG chat, compression generation)
-- Service role (edge functions) writes, users can only read their own data

CREATE TABLE IF NOT EXISTS public.rate_limit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- 'rag_chat', 'generate_compression', etc.
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ✅ INDEXES for fast lookups and analytics
CREATE INDEX idx_rate_limit_user_endpoint_window
  ON public.rate_limit_usage (user_id, endpoint, window_start);

CREATE INDEX idx_rate_limit_window
  ON public.rate_limit_usage (window_start);

-- ✅ RLS POLICIES (SECURE)
ALTER TABLE public.rate_limit_usage ENABLE ROW LEVEL SECURITY;

-- Users can ONLY view their own rate limit state (for transparency)
CREATE POLICY "Users can view own usage"
  ON public.rate_limit_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- ❌ NO insert/update/delete policies for users
-- → Users MUST NOT write their own rate limits
-- → Only service role (edge functions) can write
-- → Service role bypasses RLS automatically (no policy needed)

-- ✅ CLEANUP FUNCTION (runs via cron or edge function)
-- Removes old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rate_limit_usage
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- ✅ ONLY service role can execute cleanup
-- (prevents users from wiping rate limits to bypass)
GRANT EXECUTE ON FUNCTION clean_old_rate_limits() TO service_role;

-- ✅ AUTO-UPDATE updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rate_limit_usage_updated_at
  BEFORE UPDATE ON public.rate_limit_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ✅ ATOMIC INCREMENT FUNCTION
-- Atomically increments or creates rate limit record for current minute
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_window TIMESTAMPTZ;
BEGIN
  -- Get current minute window
  v_window := date_trunc('minute', now());

  -- Try to increment existing record
  UPDATE public.rate_limit_usage
  SET request_count = request_count + 1
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start = v_window
  RETURNING request_count INTO v_count;

  -- If no row was updated, insert new one
  IF NOT FOUND THEN
    INSERT INTO public.rate_limit_usage (user_id, endpoint, request_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, v_window)
    RETURNING request_count INTO v_count;
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_rate_limit(UUID, TEXT) TO service_role;
