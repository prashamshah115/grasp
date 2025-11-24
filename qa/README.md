# QA Testing Infrastructure

Comprehensive testing infrastructure for production-ready validation of the GRASP application.

## Overview

This directory contains all QA tools and scripts for:
- API testing (all 13 Edge Functions)
- Load testing
- RLS policy validation
- E2E UI testing (Playwright)
- Log auditing
- Code auditing
- Test data generation

## Quick Start

### 1. Setup

```bash
# Install dependencies (if not already installed)
npm install

# Ensure environment variables are set
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Run All Tests

```bash
# API tests
node qa/api-test-suite.js
# or
./qa/api-test-suite.sh

# E2E tests
npm run test:e2e

# Load tests
node qa/load-test.js rag-chat 10 50

# RLS validation
psql <connection-string> < qa/rls-test.sql
```

## Files

### API Testing

- **`api-test-suite.js`** - Node.js API test suite for all Edge Functions
- **`api-test-suite.sh`** - Bash/cURL version of API tests
- **`test-config.js`** - Centralized test configuration

**Usage:**
```bash
node qa/api-test-suite.js
./qa/api-test-suite.sh
```

### Load Testing

- **`load-test.js`** - Configurable load testing script

**Usage:**
```bash
# Test rag-chat with 10 concurrent requests, 50 total
node qa/load-test.js rag-chat 10 50

# Test health-check with 50 concurrent, 200 total, 100ms delay
node qa/load-test.js health-check 50 200 100
```

### RLS Validation

- **`rls-test.sql`** - Comprehensive RLS policy validation

**Usage:**
```bash
# Using Supabase CLI
supabase db execute --file qa/rls-test.sql

# Using psql
psql $DATABASE_URL < qa/rls-test.sql
```

### E2E Testing

- **`ui-comprehensive.spec.ts`** - Full user journey tests
- **`ui-edge-cases.spec.ts`** - Error scenarios and edge cases

**Usage:**
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test qa/ui-comprehensive.spec.ts

# Run with UI
npm run test:e2e:ui
```

### Log Auditing

- **`audit-logs.sh`** - Fetch Supabase Function logs
- **`parse-logs.js`** - Parse and extract errors from logs
- **`log-auditor-prompt.md`** - AI prompt template for log analysis

**Usage:**
```bash
# Fetch logs
./qa/audit-logs.sh

# Parse logs
node qa/parse-logs.js

# Use AI to analyze (see log-auditor-prompt.md)
```

### Code Auditing

- **`code-audit-prompt.md`** - Comprehensive code audit prompt for AI
- **`audit-checklist.md`** - Manual audit checklist

**Usage:**
1. Copy codebase or provide access to AI assistant
2. Use prompt from `code-audit-prompt.md`
3. Review findings and implement fixes

### Test Data

- **`test-data-generator.js`** - Generate synthetic test data

**Usage:**
```bash
# Generate 3 test users with data
node qa/test-data-generator.js 3

# Generate 5 users, 2 with rate limit data
node qa/test-data-generator.js 5 2
```

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/qa-pipeline.yml`) runs:
- API tests on every push
- E2E tests on every push
- Load tests on main branch (nightly)
- Type checking
- Linting

**Required Secrets:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (for RLS tests)
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

## Test Coverage

### Edge Functions (13 total)
- ✅ rag-chat
- ✅ generate-compression
- ✅ start-exam-session
- ✅ submit-exam
- ✅ next-global-question
- ✅ update-mastery
- ✅ update-question-history
- ✅ trigger-ingest
- ✅ ingest-document
- ✅ batch-ingest-storage
- ✅ batch-reingest-documents
- ✅ health-check
- ✅ test-ingest

### Frontend Routes (12+)
- ✅ Landing page
- ✅ Course catalog
- ✅ Course home
- ✅ Practice view
- ✅ Compression view
- ✅ Exam view
- ✅ Practice session
- ✅ Exam session
- ✅ Exam results
- ✅ RAG chat
- ✅ Navigation flows
- ✅ Error handling

### Database Tables (20+)
- ✅ RLS policies validated
- ✅ Access control tested
- ✅ Service role bypass verified
- ✅ Anonymous access blocked

## Workflow

### Daily Development
1. Run API tests before committing: `node qa/api-test-suite.js`
2. Run E2E tests for changed features: `npm run test:e2e`
3. Check type errors: `npx tsc --noEmit`

### Before Release
1. Run full test suite
2. Run load tests on critical endpoints
3. Execute RLS validation
4. Review code audit checklist
5. Fetch and analyze logs

### When Bugs Are Found
1. Fetch logs: `./qa/audit-logs.sh`
2. Parse errors: `node qa/parse-logs.js`
3. Use AI auditor (see `log-auditor-prompt.md`)
4. Implement fixes
5. Re-run tests

## Troubleshooting

### API Tests Failing
- Check environment variables are set
- Verify test user exists or can be created
- Check Supabase project is accessible
- Review error messages in test output

### E2E Tests Failing
- Ensure test data is seeded: `psql < scripts/seed-test-data.sql`
- Check Playwright browsers are installed: `npx playwright install`
- Verify dev server is running: `npm run dev`
- Check authentication state: `tests/.auth/user.json`

### Load Tests Timing Out
- Reduce concurrency or total requests
- Increase delay between batches
- Check rate limits aren't being hit
- Verify Supabase project can handle load

### RLS Tests Failing
- Ensure database connection is correct
- Verify RLS policies are deployed
- Check user IDs exist in auth.users
- Review SQL output for specific failures

## Next Steps

1. **Run initial test suite** to establish baseline
2. **Fix any failing tests** before proceeding
3. **Set up CI/CD** with GitHub Actions
4. **Configure monitoring** for production
5. **Schedule regular audits** (weekly/monthly)

## Support

For issues or questions:
1. Check test output for specific errors
2. Review log files in `qa/logs/`
3. Consult `audit-checklist.md` for common issues
4. Use AI auditor prompts for complex problems

---

**Status**: ✅ All QA infrastructure implemented and ready for use!

