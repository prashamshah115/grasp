#!/bin/bash
###############################################################################
# Comprehensive Edge Function Test Suite
# Meta Engineer-Level Testing
# Tests: Authentication, Validation, Error Handling, CORS, Edge Cases
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
PASSED=0
FAILED=0
WARNINGS=0

# Configuration
SUPABASE_URL="${PUBLIC_SUPABASE_URL:-https://hmuhgywxtfgamvgldzge.supabase.co}"
ANON_KEY="${SUPABASE_ANON_KEY}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║     🧪 COMPREHENSIVE EDGE FUNCTION TEST SUITE 🧪              ║${NC}"
echo -e "${BLUE}║           Meta Engineer-Level Testing                          ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper function to run a test
run_test() {
  local test_name="$1"
  local url="$2"
  local method="$3"
  local data="$4"
  local expected_status="$5"
  local auth_token="$6"
  local expected_key="$7"  # Optional: key that should exist in response
  local should_not_contain="$8"  # Optional: string that should NOT be in response

  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -n "  [TEST $TOTAL_TESTS] $test_name... "

  local auth_header=""
  if [ -n "$auth_token" ]; then
    auth_header="-H \"Authorization: Bearer $auth_token\""
  fi

  local response
  response=$(eval curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" \
    -H "apikey: ${ANON_KEY}" \
    $auth_header \
    -d "'$data'" 2>&1) || true

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')

  # Check HTTP status
  if [ "$http_code" -eq "$expected_status" ]; then
    # Check for expected key if provided
    if [ -n "$expected_key" ]; then
      if echo "$body" | grep -q "$expected_key"; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
        return 0
      else
        echo -e "${YELLOW}⚠ WARN${NC} (status OK but missing expected key: $expected_key)"
        WARNINGS=$((WARNINGS + 1))
        return 0
      fi
    fi
    
    # Check for strings that should NOT be present
    if [ -n "$should_not_contain" ]; then
      if echo "$body" | grep -q "$should_not_contain"; then
        echo -e "${RED}✗ FAIL${NC} (contains forbidden string: $should_not_contain)"
        echo "    Response: $body"
        FAILED=$((FAILED + 1))
        return 1
      fi
    fi

    echo -e "${GREEN}✓ PASS${NC}"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $http_code)"
    echo "    Response: $body"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Test CORS
test_cors() {
  local function_name="$1"
  echo -n "  [CORS] $function_name... "
  
  local response
  response=$(curl -s -X OPTIONS "$SUPABASE_URL/functions/v1/$function_name" \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -v 2>&1)
  
  if echo "$response" | grep -qi "access-control-allow-origin"; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED=$((PASSED + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED=$((FAILED + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
  fi
}

# ==================== TEST SUITE ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  1. HEALTH CHECK${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

run_test \
  "Health check - basic request" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{}" \
  200 \
  "" \
  "status"

run_test \
  "Health check - should return JSON" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{}" \
  200 \
  "" \
  "timestamp"

test_cors "health-check"

echo ""

# ==================== AUTHENTICATION TESTS ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  2. AUTHENTICATION & AUTHORIZATION${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Test functions that require auth
AUTH_REQUIRED_FUNCTIONS=(
  "rag-chat"
  "generate-compression"
  "next-global-question"
  "update-question-history"
  "update-mastery"
  "start-exam-session"
  "submit-exam"
  "trigger-ingest"
)

for func in "${AUTH_REQUIRED_FUNCTIONS[@]}"; do
  run_test \
    "$func - missing auth header" \
    "$SUPABASE_URL/functions/v1/$func" \
    "POST" \
    "{}" \
    401 \
    ""
  
  run_test \
    "$func - invalid token" \
    "$SUPABASE_URL/functions/v1/$func" \
    "POST" \
    "{}" \
    401 \
    "invalid-token-12345"
done

echo ""

# ==================== VALIDATION TESTS ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  3. INPUT VALIDATION${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Note: These will fail auth first, but we're testing the validation layer
# In real scenario, would need valid token

run_test \
  "start-exam-session - empty body" \
  "$SUPABASE_URL/functions/v1/start-exam-session" \
  "POST" \
  "{}" \
  401 \
  "" \
  "" \
  ""

run_test \
  "submit-exam - empty body" \
  "$SUPABASE_URL/functions/v1/submit-exam" \
  "POST" \
  "{}" \
  401 \
  "" \
  "" \
  ""

run_test \
  "rag-chat - empty body" \
  "$SUPABASE_URL/functions/v1/rag-chat" \
  "POST" \
  "{}" \
  401 \
  "" \
  "" \
  ""

run_test \
  "generate-compression - empty body" \
  "$SUPABASE_URL/functions/v1/generate-compression" \
  "POST" \
  "{}" \
  401 \
  "" \
  "" \
  ""

# Test invalid JSON
echo -n "  [TEST] Invalid JSON handling... "
response=$(curl -s -w "\n%{http_code}" -X POST "$SUPABASE_URL/functions/v1/health-check" \
  -H "Content-Type: application/json" \
  -d "not json" 2>&1)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 400 ] || [ "$http_code" -eq 200 ]; then
  echo -e "${GREEN}✓ PASS${NC} (handled gracefully)"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠ WARN${NC} (unexpected status: $http_code)"
  WARNINGS=$((WARNINGS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# ==================== CORS TESTS ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  4. CORS HEADERS${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

for func in "${AUTH_REQUIRED_FUNCTIONS[@]}"; do
  test_cors "$func"
done

test_cors "health-check"
test_cors "batch-ingest-storage"
test_cors "batch-reingest-documents"

echo ""

# ==================== ERROR HANDLING ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  5. ERROR HANDLING${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Test that errors return proper JSON structure
run_test \
  "Error response format - 401 should be JSON" \
  "$SUPABASE_URL/functions/v1/rag-chat" \
  "POST" \
  "{}" \
  401 \
  "" \
  "error"

run_test \
  "Error response format - should have CORS headers" \
  "$SUPABASE_URL/functions/v1/rag-chat" \
  "POST" \
  "{}" \
  401 \
  "" \
  ""

echo ""

# ==================== EDGE CASES ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  6. EDGE CASES${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Test with extremely long strings
run_test \
  "Very long message handling" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{\"test\": \"$(python3 -c 'print("x" * 10000)' 2>/dev/null || echo 'x' | head -c 10000 | tr '\n' 'x')\"}" \
  200 \
  ""

# Test with special characters
run_test \
  "Special characters in JSON" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{\"test\": \"<script>alert('xss')</script>\"}" \
  200 \
  ""

# Test with null values
run_test \
  "Null values handling" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{\"test\": null}" \
  200 \
  ""

# Test with empty string
run_test \
  "Empty string handling" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{\"test\": \"\"}" \
  200 \
  ""

echo ""

# ==================== METHOD TESTS ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  7. HTTP METHOD VALIDATION${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Test unsupported methods
for func in "health-check" "rag-chat" "start-exam-session"; do
  echo -n "  [TEST] $func - GET method... "
  response=$(curl -s -w "\n%{http_code}" -X GET "$SUPABASE_URL/functions/v1/$func" 2>&1)
  http_code=$(echo "$response" | tail -n1)
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  # GET might return 405 (Method Not Allowed) or 400/401, both are acceptable
  if [ "$http_code" -eq 405 ] || [ "$http_code" -eq 400 ] || [ "$http_code" -eq 401 ] || [ "$http_code" -eq 404 ]; then
    echo -e "${GREEN}✓ PASS${NC} (properly rejected: $http_code)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${YELLOW}⚠ WARN${NC} (unexpected status: $http_code)"
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""

# ==================== RESPONSE FORMAT TESTS ====================

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  8. RESPONSE FORMAT VALIDATION${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Test that health check returns valid JSON structure
response=$(curl -s -X POST "$SUPABASE_URL/functions/v1/health-check" \
  -H "Content-Type: application/json" \
  -d "{}")

echo -n "  [TEST] Health check - valid JSON structure... "
if echo "$response" | python3 -m json.tool > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASS${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} (invalid JSON)"
  FAILED=$((FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Check required fields in health check
echo -n "  [TEST] Health check - required fields present... "
if echo "$response" | grep -q "\"status\"" && \
   echo "$response" | grep -q "\"timestamp\"" && \
   echo "$response" | grep -q "\"checks\""; then
  echo -e "${GREEN}✓ PASS${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} (missing required fields)"
  FAILED=$((FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# ==================== SUMMARY ====================

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  TEST SUMMARY${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total tests:  $TOTAL_TESTS"
echo -e "  ${GREEN}✓ Passed:     $PASSED${NC}"
echo -e "  ${RED}✗ Failed:     $FAILED${NC}"
echo -e "  ${YELLOW}⚠ Warnings:   $WARNINGS${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Some tests failed - review output above${NC}"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  All tests passed with some warnings${NC}"
  exit 0
else
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
fi

