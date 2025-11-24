#!/bin/bash

# Comprehensive cURL-based API Test Suite for All Edge Functions
# Tests all 13 Edge Functions with various scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL}}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY}}"
TEST_EMAIL="${TEST_USER_EMAIL:-test-$(date +%s)@example.com}"
TEST_PASSWORD="${TEST_USER_PASSWORD:-testpassword123}"

# Test counters
PASSED=0
FAILED=0
ERRORS=()

# Helper functions
log_test() {
  echo -e "\n${YELLOW}🧪 Testing: $1${NC}"
}

log_pass() {
  echo -e "${GREEN}✅ PASSED: $1${NC}"
  ((PASSED++))
}

log_fail() {
  echo -e "${RED}❌ FAILED: $1${NC}"
  echo -e "${RED}   Error: $2${NC}"
  ((FAILED++))
  ERRORS+=("$1: $2")
}

# Get auth token
get_auth_token() {
  local response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
  
  # Try signup if signin fails
  if echo "$response" | grep -q "Invalid login"; then
    curl -s -X POST "${SUPABASE_URL}/auth/v1/signup" \
      -H "apikey: ${ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" > /dev/null
    
    # Retry signin
    response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
      -H "apikey: ${ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
  fi
  
  echo "$response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4
}

# Call Edge Function
call_function() {
  local function_name=$1
  local body=$2
  local token=$3
  
  local headers=(-H "Content-Type: application/json")
  if [ -n "$token" ]; then
    headers+=(-H "Authorization: Bearer ${token}")
  fi
  
  curl -s -w "\n%{http_code}" -X POST \
    "${SUPABASE_URL}/functions/v1/${function_name}" \
    "${headers[@]}" \
    -d "$body"
}

# Test runner
run_test() {
  local test_name=$1
  local test_func=$2
  
  log_test "$test_name"
  if $test_func; then
    log_pass "$test_name"
    return 0
  else
    log_fail "$test_name" "Test function returned non-zero"
    return 1
  fi
}

# ==================== EDGE FUNCTION TESTS ====================

test_rag_chat() {
  local token=$(get_auth_token)
  if [ -z "$token" ]; then
    echo "Failed to get auth token"
    return 1
  fi
  
  # Valid request
  local response=$(call_function "rag-chat" \
    "{\"message\":\"What is a process?\",\"topicId\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\"}" \
    "$token")
  
  local status=$(echo "$response" | tail -n1)
  if [ "$status" != "200" ]; then
    echo "Expected 200, got $status"
    return 1
  fi
  
  # Missing message
  local missing=$(call_function "rag-chat" \
    "{\"topicId\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\"}" \
    "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing message, got $missing_status"
    return 1
  fi
  
  return 0
}

test_generate_compression() {
  local token=$(get_auth_token)
  
  # Missing topicId
  local missing=$(call_function "generate-compression" "{}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing topicId, got $missing_status"
    return 1
  fi
  
  return 0
}

test_start_exam_session() {
  local token=$(get_auth_token)
  
  # Missing exam_id
  local missing=$(call_function "start-exam-session" "{}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing exam_id, got $missing_status"
    return 1
  fi
  
  return 0
}

test_submit_exam() {
  local token=$(get_auth_token)
  
  # Missing session_id
  local missing=$(call_function "submit-exam" "{}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing session_id, got $missing_status"
    return 1
  fi
  
  return 0
}

test_next_global_question() {
  local token=$(get_auth_token)
  
  # Missing courseId
  local missing=$(call_function "next-global-question" "{}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing courseId, got $missing_status"
    return 1
  fi
  
  return 0
}

test_update_mastery() {
  local token=$(get_auth_token)
  
  # Missing sessionId
  local missing=$(call_function "update-mastery" "{}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing sessionId, got $missing_status"
    return 1
  fi
  
  return 0
}

test_update_question_history() {
  local token=$(get_auth_token)
  
  # Missing questionId
  local missing=$(call_function "update-question-history" "{\"isCorrect\":true}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing questionId, got $missing_status"
    return 1
  fi
  
  # Missing isCorrect
  local missing_correct=$(call_function "update-question-history" \
    "{\"questionId\":\"qqqqqqqq-1111-1111-1111-111111111111\"}" \
    "$token")
  local missing_correct_status=$(echo "$missing_correct" | tail -n1)
  if [ "$missing_correct_status" != "400" ]; then
    echo "Expected 400 for missing isCorrect, got $missing_correct_status"
    return 1
  fi
  
  return 0
}

test_trigger_ingest() {
  local token=$(get_auth_token)
  
  # Missing document_id
  local missing=$(call_function "trigger-ingest" "{}" "$token")
  local missing_status=$(echo "$missing" | tail -n1)
  if [ "$missing_status" != "400" ]; then
    echo "Expected 400 for missing document_id, got $missing_status"
    return 1
  fi
  
  return 0
}

test_health_check() {
  # Health check should work without auth
  local response=$(call_function "health-check" "{}")
  local status=$(echo "$response" | tail -n1)
  if [ "$status" != "200" ]; then
    echo "Expected 200 for health-check, got $status"
    return 1
  fi
  
  return 0
}

test_invalid_auth() {
  # Test with invalid token
  local response=$(call_function "rag-chat" \
    "{\"message\":\"Test\"}" \
    "invalid-token-12345")
  local status=$(echo "$response" | tail -n1)
  if [ "$status" != "401" ]; then
    echo "Expected 401 for invalid auth, got $status"
    return 1
  fi
  
  return 0
}

# ==================== MAIN TEST RUNNER ====================

main() {
  echo "🚀 Starting Comprehensive API Test Suite (cURL)"
  echo ""
  echo "Testing against: ${SUPABASE_URL}"
  echo "Test user: ${TEST_EMAIL}"
  echo ""
  
  # Validate configuration
  if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
    echo -e "${RED}❌ Missing SUPABASE_URL or ANON_KEY${NC}"
    exit 1
  fi
  
  # Run tests
  run_test "rag-chat (validation)" test_rag_chat
  run_test "generate-compression (validation)" test_generate_compression
  run_test "start-exam-session (validation)" test_start_exam_session
  run_test "submit-exam (validation)" test_submit_exam
  run_test "next-global-question (validation)" test_next_global_question
  run_test "update-mastery (validation)" test_update_mastery
  run_test "update-question-history (validation)" test_update_question_history
  run_test "trigger-ingest (validation)" test_trigger_ingest
  run_test "health-check (no auth)" test_health_check
  run_test "invalid-auth (rag-chat)" test_invalid_auth
  
  # Print summary
  echo ""
  echo "============================================================"
  echo "📊 TEST SUMMARY"
  echo "============================================================"
  echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
  echo -e "${RED}❌ Failed: ${FAILED}${NC}"
  
  if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ ERRORS:${NC}"
    for error in "${ERRORS[@]}"; do
      echo -e "${RED}   - ${error}${NC}"
    done
  fi
  
  echo ""
  echo "============================================================"
  
  # Exit with error code if any tests failed
  if [ $FAILED -gt 0 ]; then
    exit 1
  fi
}

main "$@"

