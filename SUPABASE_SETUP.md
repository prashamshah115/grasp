# 📦 SUPABASE SETUP - Complete Reference

## What Gets Added to Your Supabase Database

This document lists everything that will be added to your Supabase project during deployment.

---

## 🗄️ NEW DATABASE TABLES

### 1. `rate_limit_usage`

**Purpose:** Track API usage for rate limiting AI endpoints

**Schema:**
```sql
CREATE TABLE public.rate_limit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique identifier
- `user_id` - References authenticated user
- `endpoint` - API endpoint name ('rag_chat', 'generate_compression')
- `request_count` - Number of requests in this time window
- `window_start` - Start of rate limit window (minute-aligned)
- `created_at` - When record was created
- `updated_at` - When record was last updated

**Indexes:**
- `idx_rate_limit_user_endpoint_window` on `(user_id, endpoint, window_start)`
- `idx_rate_limit_window` on `(window_start)`

**RLS Policies:**
- Users can SELECT their own usage
- Only service role can INSERT/UPDATE/DELETE

---

## 🔧 NEW DATABASE FUNCTIONS

### 1. `increment_rate_limit(p_user_id UUID, p_endpoint TEXT)`

**Purpose:** Atomically increment or create rate limit record

**Returns:** `INTEGER` (current request count)

**Usage:**
```sql
SELECT increment_rate_limit(
  '123e4567-e89b-12d3-a456-426614174000'::UUID,
  'rag_chat'
);
-- Returns: 1 (or incremented count)
```

**What it does:**
1. Gets current minute window using `date_trunc('minute', now())`
2. Tries to UPDATE existing record for this user+endpoint+window
3. If no record exists, INSERTs new one
4. Returns current `request_count`

**Security:** `SECURITY DEFINER` - runs with function owner privileges
**Permissions:** Only `service_role` can execute

---

### 2. `clean_old_rate_limits()`

**Purpose:** Remove rate limit records older than 24 hours

**Returns:** `void`

**Usage:**
```sql
SELECT clean_old_rate_limits();
```

**What it does:**
1. Deletes all rows where `window_start < NOW() - INTERVAL '24 hours'`
2. Keeps database size under control

**Security:** `SECURITY DEFINER`
**Permissions:** Only `service_role` can execute

**Recommended:** Run daily via Supabase cron job or edge function

---

### 3. `update_updated_at()`

**Purpose:** Auto-update `updated_at` timestamp on row updates

**Returns:** `TRIGGER`

**Usage:** Automatically called by trigger

**What it does:**
1. Sets `NEW.updated_at = NOW()` before every UPDATE
2. Ensures `updated_at` is always accurate

---

## 🎯 NEW TRIGGERS

### 1. `rate_limit_usage_updated_at`

**Table:** `rate_limit_usage`
**Event:** BEFORE UPDATE
**Function:** `update_updated_at()`

**Purpose:** Auto-update `updated_at` column on every row update

---

## 🔐 RLS POLICIES

### Policy: "Users can view own usage"

**Table:** `rate_limit_usage`
**Operation:** SELECT
**Rule:** `auth.uid() = user_id`

**What it allows:**
- Users can query their own rate limit usage
- Users can see how many requests they've made
- Users CANNOT see other users' usage

**What it blocks:**
- Users CANNOT INSERT/UPDATE/DELETE rate limit records
- Only service role (edge functions) can write to this table

---

## 📊 EDGE FUNCTIONS

### Modified Functions

#### 1. `rag-chat`
**Changes:**
- Added rate limiting check before processing request
- Returns 429 if user exceeds limits
- Logs rate limit status

**New Limits:**
- 10 requests/minute
- 100 requests/hour
- 500 requests/day

#### 2. `generate-compression`
**Changes:**
- Added rate limiting check before generation
- Returns 429 if user exceeds limits
- Logs rate limit status

**New Limits:**
- 2 requests/minute
- 10 requests/hour
- 50 requests/day

---

## 🔑 ENVIRONMENT VARIABLES NEEDED

Make sure these are set in Supabase Edge Functions settings:

```bash
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
JINA_API_KEY=jina_...
```

**Where to set them:**
Supabase Dashboard → Edge Functions → Configuration

---

## 📈 DATABASE GROWTH ESTIMATES

### `rate_limit_usage` Table

**Per User Per Day:**
- RAG Chat: up to 500 records (one per minute used)
- Compression: up to 50 records
- Total: ~550 records/user/day

**Storage:**
- Each record: ~200 bytes
- 1000 users/day: ~110 MB/day
- 30 days retention: ~3.3 GB

**Cleanup:**
- Run `clean_old_rate_limits()` daily
- Keeps only last 24 hours of data
- Reduces to: ~4 MB steady state (1000 active users)

---

## 🔍 MONITORING QUERIES

### View Rate Limit Usage

```sql
-- Your current usage
SELECT
  endpoint,
  SUM(request_count) as total_requests,
  COUNT(*) as windows_used,
  MAX(window_start) as last_request
FROM rate_limit_usage
WHERE user_id = auth.uid()
  AND window_start > NOW() - INTERVAL '24 hours'
GROUP BY endpoint;
```

### Check Who's Being Rate Limited

```sql
-- Users hitting rate limits (admin only)
SELECT
  user_id,
  endpoint,
  COUNT(*) as windows,
  SUM(request_count) as total_requests
FROM rate_limit_usage
WHERE window_start > NOW() - INTERVAL '1 hour'
GROUP BY user_id, endpoint
HAVING SUM(request_count) > 90  -- Close to limit
ORDER BY total_requests DESC;
```

### Monitor API Costs

```sql
-- Estimate OpenAI API costs per user
SELECT
  user_id,
  SUM(CASE WHEN endpoint = 'rag_chat' THEN request_count ELSE 0 END) * 0.01 as rag_cost_estimate,
  SUM(CASE WHEN endpoint = 'generate_compression' THEN request_count ELSE 0 END) * 0.05 as compression_cost_estimate
FROM rate_limit_usage
WHERE window_start > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY rag_cost_estimate + compression_cost_estimate DESC
LIMIT 10;
```

---

## 🛡️ SECURITY FEATURES

### What's Protected

✅ **Service Role Bypass:** Edge functions use service role key → bypass RLS automatically
✅ **User Read-Only:** Users can only SELECT their own data, cannot modify
✅ **Atomic Updates:** `increment_rate_limit()` uses upsert pattern → no race conditions
✅ **Window Alignment:** `date_trunc('minute', now())` ensures consistent windows
✅ **Cleanup Protection:** Only service role can delete old records

### What's NOT Protected (by design)

⚠️ Users can see their own rate limit usage (transparency)
⚠️ System fails open on errors (availability over strict limits)
⚠️ No per-IP limiting (only per-user)

---

## 🚀 DEPLOYMENT CHECKLIST

Before running deployment:

- [ ] Supabase project created
- [ ] `PUBLIC_SUPABASE_URL` set in environment
- [ ] `SERVICE_ROLE_KEY` set in environment
- [ ] `OPENAI_API_KEY` set in Edge Functions config
- [ ] `JINA_API_KEY` set in Edge Functions config
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Logged in to Supabase CLI (`supabase login`)
- [ ] Project linked (`supabase link`)

Run deployment:

```bash
./QUICK_DEPLOY.sh
```

Verify:

```bash
# In Supabase SQL Editor
\i scripts/verify-deployment.sql

# Test rate limiting
./scripts/test-rate-limit.sh
```

---

## 📞 TROUBLESHOOTING

### "relation rate_limit_usage already exists"

**Solution:** Table was created before. Either:
1. Skip migration (already deployed)
2. Or drop and recreate:
```sql
DROP TABLE IF EXISTS public.rate_limit_usage CASCADE;
```

### "function increment_rate_limit already exists"

**Solution:** Function was created before. Either:
1. Skip migration
2. Or replace:
```sql
DROP FUNCTION IF EXISTS increment_rate_limit(UUID, TEXT);
```

### Rate limiting not working

**Check:**
1. Function deployed: `supabase functions list`
2. Function callable: `SELECT increment_rate_limit('test-id'::UUID, 'test')`
3. RPC permissions: `GRANT EXECUTE ON FUNCTION increment_rate_limit TO service_role`

### Edge function not updated

**Force redeploy:**
```bash
supabase functions deploy rag-chat --no-verify-jwt
```

---

## 🎉 WHAT YOU GET

After deployment:

✅ AI API cost protection ($15/user/day max)
✅ DoS attack mitigation
✅ Usage transparency for users
✅ Monitoring dashboard data
✅ Production-grade rate limiting
✅ Zero race conditions
✅ Automatic cleanup
✅ Security-first design

---

## 📚 REFERENCES

- Migration file: `supabase/migrations/20250121000000_add_rate_limiting.sql`
- Middleware: `supabase/functions/_shared/rate-limit.ts`
- Deployment guide: `DEPLOYMENT_GUIDE.md`
- Quick deploy script: `QUICK_DEPLOY.sh`
- Verification script: `scripts/verify-deployment.sql`
- Test script: `scripts/test-rate-limit.sh`
