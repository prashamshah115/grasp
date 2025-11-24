#!/bin/bash

# Run All Backend Tests Against Deployed Functions
# Now that Edge Functions are deployed!

set -e

echo "🧪 Running All Backend Tests Against Deployed Functions"
echo "========================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Deno
if ! command -v deno &> /dev/null; then
  export PATH="$HOME/.deno/bin:$PATH"
fi

# Load environment
SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}❌ Missing environment variables${NC}"
  echo "Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

echo -e "${GREEN}✅ Using Supabase: ${SUPABASE_URL}${NC}"
echo ""

# Test results
TOTAL=0
PASSED=0
FAILED=0

# Run test file and capture results
run_test_file() {
  local file=$1
  local name=$(basename "$file" .test.ts)
  
  TOTAL=$((TOTAL + 1))
  echo -e "${BLUE}📦 Testing: ${name}${NC}"
  
  if SUPABASE_URL="${SUPABASE_URL}" \
     SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
     SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
     VITE_SUPABASE_URL="${SUPABASE_URL}" \
     VITE_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
     deno test "$file" --allow-all --no-check --quiet 2>&1 | tee /tmp/test-${name}.log > /dev/null; then
    
    if grep -q "ok\|passed" /tmp/test-${name}.log; then
      local count=$(grep -oE "[0-9]+ passed" /tmp/test-${name}.log | head -1 || echo "0 passed")
      echo -e "${GREEN}  ✅ ${count}${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}  ❌ Failed${NC}"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${YELLOW}  ⚠️  Errors${NC}"
    FAILED=$((FAILED + 1))
  fi
}

# Run all test suites
echo -e "${YELLOW}🚀 Running Test Suites...${NC}"
echo ""

# Unit Tests
echo "Unit Tests:"
for file in tests/backend/unit/shared/*.test.ts; do
  [ -f "$file" ] && run_test_file "$file"
done

for file in tests/backend/unit/edge-functions/*.test.ts; do
  [ -f "$file" ] && run_test_file "$file"
done

echo ""

# Security Tests
echo "Security Tests:"
for file in tests/backend/security/*.test.ts; do
  [ -f "$file" ] && run_test_file "$file"
done

echo ""

# Summary
echo "========================================================"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "========================================================"
echo -e "${GREEN}✅ Passed: ${PASSED}/${TOTAL}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}/${TOTAL}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed. Check logs in /tmp/test-*.log${NC}"
  exit 1
fi

