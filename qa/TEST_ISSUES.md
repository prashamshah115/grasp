# Test Issues Analysis

## Current Issues

### 1. API Tests - Authentication Failure

**Problem**: API tests are failing because authentication is not working.

**Root Cause**:
- The email `prashamshah115@gmail.com` either:
  - Doesn't exist in Supabase
  - Has wrong password
  - Requires email confirmation (Supabase default behavior)
- When sign up is attempted, Supabase doesn't return a session immediately if email confirmation is enabled

**Solution Options**:
1. **Use existing confirmed user**: Sign in with an account that's already confirmed
2. **Disable email confirmation** in Supabase Dashboard (Auth > Settings > Email Auth > Confirm email: OFF)
3. **Use service role** to create confirmed users programmatically
4. **Manually confirm email** before running tests

**Quick Fix**: Update test config to use a confirmed account or disable email confirmation.

### 2. E2E Tests - Taking Too Long

**Problem**: Playwright tests are hanging/running slowly.

**Root Causes**:
1. **Dev server not running**: Tests wait for `http://localhost:3000` to be available
2. **Browser launch delays**: Multiple browsers launching in parallel
3. **Network timeouts**: Waiting for API calls that never complete
4. **Test data missing**: Tests waiting for data that doesn't exist

**Solution**:
- Ensure dev server is running: `npm run dev`
- Check if test data is seeded: `psql < scripts/seed-test-data.sql`
- Reduce test parallelism in `playwright.config.ts`
- Add timeouts to prevent infinite waits

### 3. Health Check - 503 Error

**Problem**: Health check endpoint returns 503 (Service Unavailable).

**Root Cause**: 
- Edge Function `health-check` may not be deployed
- Or Supabase project is paused/not accessible

**Solution**: 
- Deploy the health-check function: `supabase functions deploy health-check`
- Or skip this test if not critical

## Immediate Actions

1. **Fix Authentication**:
   ```bash
   # Option 1: Use service role to create confirmed user
   # (requires SUPABASE_SERVICE_ROLE_KEY)
   
   # Option 2: Disable email confirmation in Supabase Dashboard
   # Auth > Settings > Email Auth > Confirm email: OFF
   
   # Option 3: Manually sign up and confirm email first
   ```

2. **Fix E2E Tests**:
   ```bash
   # Start dev server in separate terminal
   npm run dev
   
   # Then run tests
   npm run test:e2e
   ```

3. **Skip Non-Critical Tests**:
   - Health check can be skipped if function isn't deployed
   - Some tests may need test data to be seeded first

## Recommended Test Flow

1. **Setup**:
   ```bash
   # Seed test data
   psql $DATABASE_URL < scripts/seed-test-data.sql
   
   # Create test user (if needed)
   # Use Supabase Dashboard or service role
   ```

2. **Run Tests**:
   ```bash
   # Start dev server (in background)
   npm run dev &
   
   # Run API tests
   node qa/api-test-suite.js
   
   # Run E2E tests
   npm run test:e2e
   ```

3. **Fix Issues**:
   - Fix authentication first (most critical)
   - Then fix E2E test setup
   - Finally, address edge cases

