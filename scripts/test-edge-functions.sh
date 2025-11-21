#!/bin/bash
###############################################################################
# GRASP Edge Function Test Suite
# Automated curl-based integration tests for all edge functions
#
# Usage:
#   ./scripts/test-edge-functions.sh [options]
#
# Options:
#   --skip-setup    Skip environment setup prompts
#   --verbose       Show detailed request/response
#   --exam-only     Test only exam functions
#
# Environment Variables (required):
#   PUBLIC_SUPABASE_URL   - Your Supabase project URL
#   SUPABASE_ANON_KEY     - Your anon key
#   TEST_USER_EMAIL       - Test user email
#   TEST_USER_PASSWORD    - Test user password
#
# Example:
#   export PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
#   export SUPABASE_ANON_KEY="your-anon-key"
#   export TEST_USER_EMAIL="test@example.com"
#   export TEST_USER_PASSWORD="password123"
#   ./scripts/test-edge-functions.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
SKIPPED=0

# Options
VERBOSE=false
EXAM_ONLY=false
SKIP_SETUP=false

# Parse command line options
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --verbose) VERBOSE=true ;;
    --exam-only) EXAM_ONLY=true ;;
    --skip-setup) SKIP_SETUP=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Header
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║              🧪 GRASP EDGE FUNCTION TEST SUITE 🧪              ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ==================== ENVIRONMENT SETUP ====================

if [ "$SKIP_SETUP" = false ]; then
  echo -e "${YELLOW}📋 Checking environment variables...${NC}"

  if [ -z "$PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}ERROR: PUBLIC_SUPABASE_URL not set${NC}"
    echo "Set it with: export PUBLIC_SUPABASE_URL=\"https://xxxxx.supabase.co\""
    exit 1
  fi

  if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}ERROR: SUPABASE_ANON_KEY not set${NC}"
    exit 1
  fi

  if [ -z "$TEST_USER_EMAIL" ] || [ -z "$TEST_USER_PASSWORD" ]; then
    echo -e "${YELLOW}WARNING: Test credentials not set. Some tests will be skipped.${NC}"
    echo "Set with: export TEST_USER_EMAIL=\"test@example.com\""
    echo "          export TEST_USER_PASSWORD=\"password123\""
  fi

  echo -e "${GREEN}✓ Environment configured${NC}"
  echo ""
fi

# ==================== HELPER FUNCTIONS ====================

# Test a single endpoint
test_endpoint() {
  local test_name="$1"
  local url="$2"
  local method="$3"
  local data="$4"
  local expected_status="$5"
  local auth_token="$6"

  echo -n "Testing: ${test_name}... "

  local auth_header=""
  if [ -n "$auth_token" ]; then
    auth_header="-H \"Authorization: Bearer $auth_token\""
  fi

  if [ "$VERBOSE" = true ]; then
    echo ""
    echo "  URL: $url"
    echo "  Method: $method"
    echo "  Data: $data"
  fi

  local response
  response=$(eval curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" \
    $auth_header \
    -d "'$data'" 2>&1)

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | head -n-1)

  if [ "$VERBOSE" = true ]; then
    echo "  Response code: $http_code"
    echo "  Response body: $body"
  fi

  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} ($http_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $http_code)"
    echo "  Response: $body"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Skip a test
skip_test() {
  local test_name="$1"
  local reason="$2"
  echo -e "Testing: ${test_name}... ${YELLOW}⊘ SKIP${NC} ($reason)"
  SKIPPED=$((SKIPPED + 1))
}

# ==================== AUTHENTICATION ====================

USER_TOKEN=""

login_test_user() {
  if [ -z "$TEST_USER_EMAIL" ] || [ -z "$TEST_USER_PASSWORD" ]; then
    return 1
  fi

  echo -e "${YELLOW}🔐 Authenticating test user...${NC}"

  local response
  response=$(curl -s -X POST "$PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_USER_EMAIL\",
      \"password\": \"$TEST_USER_PASSWORD\"
    }")

  USER_TOKEN=$(echo "$response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

  if [ -z "$USER_TOKEN" ]; then
    echo -e "${RED}✗ Authentication failed${NC}"
    echo "Response: $response"
    return 1
  fi

  echo -e "${GREEN}✓ User authenticated${NC}"
  echo ""
  return 0
}

# ==================== TEST SUITES ====================

test_health_check() {
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  1. HEALTH CHECK${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

  test_endpoint \
    "health-check (no auth required)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/health-check" \
    "POST" \
    "{}" \
    200 \
    ""

  echo ""
}

test_practice_module() {
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  2. PRACTICE MODULE${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

  if [ -z "$USER_TOKEN" ]; then
    skip_test "next-global-question" "no auth token"
    skip_test "update-question-history" "no auth token"
    echo ""
    return
  fi

  test_endpoint \
    "next-global-question (missing courseId)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/next-global-question" \
    "POST" \
    "{}" \
    400 \
    "$USER_TOKEN"

  # Note: Can't fully test without valid courseId from database
  echo ""
}

test_rag_module() {
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  3. RAG CHAT MODULE${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

  if [ -z "$USER_TOKEN" ]; then
    skip_test "rag-chat" "no auth token"
    echo ""
    return
  fi

  test_endpoint \
    "rag-chat (no auth)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/rag-chat" \
    "POST" \
    "{\"message\": \"test\"}" \
    401 \
    ""

  # Note: Full test requires valid topic/course IDs
  echo ""
}

test_compression_module() {
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  4. COMPRESSION MODULE${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

  if [ -z "$USER_TOKEN" ]; then
    skip_test "generate-compression" "no auth token"
    echo ""
    return
  fi

  test_endpoint \
    "generate-compression (no auth)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/generate-compression" \
    "POST" \
    "{\"topicId\": \"test\"}" \
    401 \
    ""

  echo ""
}

test_exam_module() {
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  5. EXAM MODULE (NEW)${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

  # Test 1: No auth
  test_endpoint \
    "start-exam-session (no auth)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/start-exam-session" \
    "POST" \
    "{\"exam_id\": \"test\"}" \
    401 \
    ""

  test_endpoint \
    "submit-exam (no auth)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/submit-exam" \
    "POST" \
    "{\"session_id\": \"test\"}" \
    401 \
    ""

  if [ -z "$USER_TOKEN" ]; then
    skip_test "start-exam-session (authenticated)" "no auth token"
    skip_test "submit-exam (authenticated)" "no auth token"
    echo ""
    return
  fi

  # Test 2: Missing required fields
  test_endpoint \
    "start-exam-session (missing exam_id)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/start-exam-session" \
    "POST" \
    "{}" \
    422 \
    "$USER_TOKEN"

  test_endpoint \
    "submit-exam (missing session_id)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/submit-exam" \
    "POST" \
    "{}" \
    422 \
    "$USER_TOKEN"

  # Test 3: Invalid UUID format
  test_endpoint \
    "start-exam-session (invalid UUID)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/start-exam-session" \
    "POST" \
    "{\"exam_id\": \"not-a-uuid\"}" \
    422 \
    "$USER_TOKEN"

  test_endpoint \
    "submit-exam (invalid UUID)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/submit-exam" \
    "POST" \
    "{\"session_id\": \"not-a-uuid\"}" \
    422 \
    "$USER_TOKEN"

  # Test 4: Non-existent resources
  test_endpoint \
    "start-exam-session (non-existent exam)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/start-exam-session" \
    "POST" \
    "{\"exam_id\": \"00000000-0000-0000-0000-000000000000\"}" \
    404 \
    "$USER_TOKEN"

  test_endpoint \
    "submit-exam (non-existent session)" \
    "$PUBLIC_SUPABASE_URL/functions/v1/submit-exam" \
    "POST" \
    "{\"session_id\": \"00000000-0000-0000-0000-000000000000\"}" \
    404 \
    "$USER_TOKEN"

  echo ""
  echo -e "${YELLOW}Note: Full end-to-end exam tests require valid exam/session IDs${NC}"
  echo -e "${YELLOW}Run manual E2E tests with: ./scripts/test-exam-e2e.sh${NC}"
  echo ""
}

test_cors() {
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  6. CORS HEADERS${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════${NC}"

  test_endpoint \
    "start-exam-session OPTIONS" \
    "$PUBLIC_SUPABASE_URL/functions/v1/start-exam-session" \
    "OPTIONS" \
    "" \
    200 \
    ""

  test_endpoint \
    "submit-exam OPTIONS" \
    "$PUBLIC_SUPABASE_URL/functions/v1/submit-exam" \
    "OPTIONS" \
    "" \
    200 \
    ""

  echo ""
}

# ==================== MAIN EXECUTION ====================

# Authenticate
login_test_user || echo -e "${YELLOW}⚠ Continuing without authentication (limited tests)${NC}\n"

# Run tests
if [ "$EXAM_ONLY" = true ]; then
  test_exam_module
  test_cors
else
  test_health_check
  test_practice_module
  test_rag_module
  test_compression_module
  test_exam_module
  test_cors
fi

# ==================== SUMMARY ====================

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  SUMMARY${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

TOTAL=$((PASSED + FAILED + SKIPPED))

echo -e "  Total tests:  $TOTAL"
echo -e "  ${GREEN}✓ Passed:     $PASSED${NC}"
echo -e "  ${RED}✗ Failed:     $FAILED${NC}"
echo -e "  ${YELLOW}⊘ Skipped:    $SKIPPED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
fi
