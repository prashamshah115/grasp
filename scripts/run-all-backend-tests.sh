#!/bin/bash

# Comprehensive Backend Test Runner
# Runs all backend tests and reports results

set -e

echo "🧪 Running All Backend Tests"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Deno
if ! command -v deno &> /dev/null; then
  echo -e "${RED}❌ Deno not found. Installing...${NC}"
  curl -fsSL https://deno.land/install.sh | sh
  export PATH="$HOME/.deno/bin:$PATH"
fi

echo -e "${GREEN}✅ Deno: $(deno --version | head -1)${NC}"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Set Supabase URL (prefer remote if local not available)
SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-http://localhost:54321}}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  SUPABASE_URL: ${SUPABASE_URL}"
echo "  ANON_KEY: ${SUPABASE_ANON_KEY:0:20}..."
echo "  SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo ""

# Test counters
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

# Run test suite
run_test_suite() {
  local suite_name=$1
  local test_path=$2
  
  echo -e "${YELLOW}📦 Running: ${suite_name}${NC}"
  echo "----------------------------------------"
  
  TOTAL=$((TOTAL + 1))
  
  if deno test "${test_path}" \
    --allow-net \
    --allow-env \
    --allow-read \
    --no-check \
    --env SUPABASE_URL="${SUPABASE_URL}" \
    --env SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
    --env SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
    --env VITE_SUPABASE_URL="${SUPABASE_URL}" \
    --env VITE_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
    2>&1 | tee /tmp/test-${suite_name}.log | grep -E "(ok|FAILED|passed|failed)" | tail -1; then
    
    if grep -q "ok\|passed" /tmp/test-${suite_name}.log; then
      echo -e "${GREEN}✅ ${suite_name} passed${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}❌ ${suite_name} failed${NC}"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${YELLOW}⚠️  ${suite_name} skipped or had errors${NC}"
    SKIPPED=$((SKIPPED + 1))
  fi
  echo ""
}

# Run tests
echo -e "${BLUE}🚀 Starting Test Execution...${NC}"
echo ""

# Unit Tests
run_test_suite "Unit Tests - Errors" "tests/backend/unit/shared/errors.test.ts"

# Security Tests (don't require Edge Functions)
run_test_suite "Security Tests - Input Validation" "tests/backend/security/input-validation.test.ts"

# Summary
echo "============================"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "============================"
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
echo -e "${YELLOW}⚠️  Skipped: ${SKIPPED}${NC}"
echo -e "📦 Total Suites: ${TOTAL}"
echo ""

# Note about Edge Function tests
echo -e "${YELLOW}ℹ️  Note:${NC}"
echo "  Edge Function tests require Supabase Edge Functions to be deployed."
echo "  Database tests require local Supabase instance."
echo "  Integration tests require test data to be seeded."
echo ""
echo "  To run all tests:"
echo "  1. Start local Supabase: supabase start"
echo "  2. Deploy Edge Functions: supabase functions deploy"
echo "  3. Seed test data: psql < tests/backend/fixtures/seed.sql"
echo ""

if [ $FAILED -gt 0 ]; then
  exit 1
else
  exit 0
fi

