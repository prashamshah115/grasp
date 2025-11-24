#!/bin/bash

# Comprehensive Backend Test Runner
# Runs all backend tests in sequence

set -e  # Exit on error

echo "🧪 Starting Comprehensive Backend Tests..."
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase is running
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
  echo -e "${RED}❌ Supabase is not running!${NC}"
  echo "Please run: supabase start"
  exit 1
fi

echo -e "${GREEN}✅ Supabase is running${NC}"
echo ""

# Validate environment variables
if [ -z "$SUPABASE_URL" ]; then
  export SUPABASE_URL="http://localhost:54321"
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${YELLOW}⚠️  SUPABASE_ANON_KEY not set, using default${NC}"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${YELLOW}⚠️  SUPABASE_SERVICE_ROLE_KEY not set${NC}"
fi

echo ""

# Test counters
PASSED=0
FAILED=0

# Function to run tests and track results
run_test_suite() {
  local suite_name=$1
  local test_command=$2
  
  echo -e "${YELLOW}📦 Running: ${suite_name}${NC}"
  echo "----------------------------------------"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✅ ${suite_name} passed${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ ${suite_name} failed${NC}"
    ((FAILED++))
  fi
  echo ""
}

# 1. Unit Tests
run_test_suite "Unit Tests" "deno test tests/backend/unit/ --allow-net --allow-env"

# 2. Integration Tests
run_test_suite "Integration Tests" "deno test tests/backend/integration/ --allow-net --allow-env"

# 3. Database Tests
run_test_suite "Database Tests" "deno test tests/backend/database/ --allow-net --allow-env"

# 4. Security Tests
run_test_suite "Security Tests" "deno test tests/backend/security/ --allow-net --allow-env"

# 5. Performance Tests (optional)
if [ "$1" == "--performance" ]; then
  run_test_suite "Performance Tests" "deno test tests/backend/performance/ --allow-net --allow-env"
fi

# Summary
echo "=========================================="
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Failed: ${FAILED}${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
fi

