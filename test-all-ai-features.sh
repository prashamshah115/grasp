#!/bin/bash

# 🧪 Comprehensive AI Features Testing Script
# Tests RAG Chat and Compression with quality validation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     GRASP AI Chat & Compression Testing Suite        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not found. Installing...${NC}"
    brew install jq 2>/dev/null || {
        echo -e "${RED}❌ Please install jq: brew install jq${NC}"
        exit 1
    }
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Get Supabase config
SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL}}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY}}"

# Test data IDs (from seed-test-data.sql)
TEST_COURSE_ID="${TEST_COURSE_ID:-11111111-1111-1111-1111-111111111111}"
TEST_TOPIC_ID="${TEST_TOPIC_ID:-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}"
TEST_QUESTION_ID="${TEST_QUESTION_ID:-qqqqqqqq-1111-1111-1111-111111111111}"

# Validate config
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Missing Supabase configuration!${NC}"
    echo ""
    echo "Please set:"
    echo "  export VITE_SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export VITE_SUPABASE_ANON_KEY='your-anon-key'"
    echo ""
    echo "Or create a .env file with:"
    echo "  VITE_SUPABASE_URL=https://your-project.supabase.co"
    echo "  VITE_SUPABASE_ANON_KEY=your-anon-key"
    exit 1
fi

# Set base URL for functions
BASE_URL="${SUPABASE_URL}/functions/v1"

echo -e "${GREEN}✅ Configuration loaded${NC}"
echo -e "   URL: ${CYAN}${BASE_URL}${NC}"
echo -e "   Course ID: ${CYAN}${TEST_COURSE_ID}${NC}"
echo -e "   Topic ID: ${CYAN}${TEST_TOPIC_ID}${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    local data=$3
    local expected_fields=$4
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Test: ${name}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/$endpoint" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" != "200" ]; then
        echo -e "${RED}❌ Failed (HTTP $http_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    # Check for expected fields
    if [ -n "$expected_fields" ]; then
        for field in $expected_fields; do
            if ! echo "$body" | jq -e ".$field" > /dev/null 2>&1; then
                echo -e "${RED}❌ Missing field: $field${NC}"
                TESTS_FAILED=$((TESTS_FAILED + 1))
                return 1
            fi
        done
    fi
    
    echo -e "${GREEN}✅ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo ""
    return 0
}

# Function to validate response quality
validate_response_quality() {
    local response=$1
    local type=$2
    
    local score=0
    local max_score=0
    
    if [ "$type" = "rag" ]; then
        max_score=5
        answer=$(echo "$response" | jq -r '.answer // ""')
        
        # Check length (should be comprehensive)
        length=$(echo "$answer" | wc -c)
        if [ "$length" -gt 500 ]; then
            echo -e "  ${GREEN}✓${NC} Comprehensive response ($length chars)"
            score=$((score + 1))
        else
            echo -e "  ${YELLOW}⚠${NC}  Response might be too short ($length chars)"
        fi
        
        # Check for citations
        if echo "$response" | jq -e '.citations' > /dev/null 2>&1; then
            citations=$(echo "$response" | jq '.citations | length')
            if [ "$citations" -gt 0 ]; then
                echo -e "  ${GREEN}✓${NC} Has citations ($citations sources)"
                score=$((score + 1))
            fi
        fi
        
        # Check for structure (bullets, numbers, headers)
        if echo "$answer" | grep -qE "(^[-*]|^[0-9]+\.|^##)"; then
            echo -e "  ${GREEN}✓${NC} Structured format"
            score=$((score + 1))
        fi
        
        # Check for examples/analogies
        if echo "$answer" | grep -qiE "(example|for instance|such as|analogy|like)"; then
            echo -e "  ${GREEN}✓${NC} Includes examples"
            score=$((score + 1))
        fi
        
        # Check for core concept explanation
        if echo "$answer" | grep -qiE "(is|are|means|refers to|definition)"; then
            echo -e "  ${GREEN}✓${NC} Explains core concepts"
            score=$((score + 1))
        fi
        
    elif [ "$type" = "compression" ]; then
        max_score=7
        content=$(echo "$response" | jq -r '.content // ""')
        
        # Check for section headers
        if echo "$content" | grep -q "^##"; then
            headers=$(echo "$content" | grep -c "^##" || echo "0")
            echo -e "  ${GREEN}✓${NC} Has section headers ($headers sections)"
            score=$((score + 1))
        fi
        
        # Check for bold terms
        if echo "$content" | grep -q "\*\*"; then
            bold_count=$(echo "$content" | grep -o "\*\*[^*]*\*\*" | wc -l | tr -d ' ')
            echo -e "  ${GREEN}✓${NC} Has bold terms ($bold_count terms)"
            score=$((score + 1))
        fi
        
        # Check for code blocks
        if echo "$content" | grep -q '\`\`\`'; then
            echo -e "  ${GREEN}✓${NC} Has code blocks"
            score=$((score + 1))
        fi
        
        # Check bullet count
        bullets=$(echo "$content" | grep -c "^-" || echo "0")
        if [ "$bullets" -ge 15 ]; then
            echo -e "  ${GREEN}✓${NC} Sufficient bullets ($bullets points)"
            score=$((score + 1))
        else
            echo -e "  ${YELLOW}⚠${NC}  Fewer than 15 bullets ($bullets points)"
        fi
        
        # Check for 7 categories (approximate)
        category_keywords=("Definition" "Concept" "Process" "Formula" "Application" "Pitfall" "Exam")
        found_categories=0
        for keyword in "${category_keywords[@]}"; do
            if echo "$content" | grep -qi "$keyword"; then
                found_categories=$((found_categories + 1))
            fi
        done
        if [ "$found_categories" -ge 5 ]; then
            echo -e "  ${GREEN}✓${NC} Multiple categories covered ($found_categories/7)"
            score=$((score + 1))
        fi
        
        # Check length
        length=$(echo "$content" | wc -c)
        if [ "$length" -gt 2000 ]; then
            echo -e "  ${GREEN}✓${NC} Comprehensive content ($length chars)"
            score=$((score + 1))
        fi
        
        # Check for ground-up explanations
        if echo "$content" | grep -qiE "(fundamental|basic|core|first|principle|ground)"; then
            echo -e "  ${GREEN}✓${NC} Ground-up explanations"
            score=$((score + 1))
        fi
    fi
    
    echo ""
    echo -e "  ${CYAN}Quality Score: $score/$max_score${NC}"
    if [ "$score" -ge $((max_score * 3 / 4)) ]; then
        echo -e "  ${GREEN}✅ Excellent quality!${NC}"
    elif [ "$score" -ge $((max_score / 2)) ]; then
        echo -e "  ${YELLOW}⚠️  Good, but could be improved${NC}"
    else
        echo -e "  ${RED}❌ Needs improvement${NC}"
    fi
    echo ""
}

# Run tests
echo -e "${GREEN}Starting comprehensive tests...${NC}"
echo ""

# Test 1: Basic RAG Chat
test_endpoint "Basic RAG Chat (No Context)" "rag-chat" "{
    \"message\": \"What is virtual memory? Explain it comprehensively.\",
    \"courseId\": \"$TEST_COURSE_ID\"
}" "answer citations"

if [ $? -eq 0 ]; then
    response=$(curl -s -X POST "$BASE_URL/rag-chat" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"message\": \"What is virtual memory? Explain it comprehensively.\",
            \"courseId\": \"$TEST_COURSE_ID\"
        }")
    echo -e "${CYAN}Quality Validation:${NC}"
    validate_response_quality "$response" "rag"
fi

# Test 2: Topic-Specific RAG Chat
test_endpoint "Topic-Specific RAG Chat" "rag-chat" "{
    \"message\": \"Explain processes and threads in detail. Compare and contrast them.\",
    \"courseId\": \"$TEST_COURSE_ID\",
    \"topicId\": \"$TEST_TOPIC_ID\"
}" "answer citations"

if [ $? -eq 0 ]; then
    response=$(curl -s -X POST "$BASE_URL/rag-chat" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"message\": \"Explain processes and threads in detail. Compare and contrast them.\",
            \"courseId\": \"$TEST_COURSE_ID\",
            \"topicId\": \"$TEST_TOPIC_ID\"
        }")
    echo -e "${CYAN}Quality Validation:${NC}"
    validate_response_quality "$response" "rag"
fi

# Test 3: Question Context Chat
test_endpoint "Question Context Chat" "rag-chat" "{
    \"message\": \"Help me understand this question better\",
    \"courseId\": \"$TEST_COURSE_ID\",
    \"topicId\": \"$TEST_TOPIC_ID\",
    \"questionId\": \"$TEST_QUESTION_ID\"
}" "answer"

# Test 4: Complex Multi-Part Question
test_endpoint "Complex Multi-Part Question" "rag-chat" "{
    \"message\": \"Compare and contrast processes and threads. Include examples, use cases, and explain when to use each. Provide step-by-step explanations.\",
    \"courseId\": \"$TEST_COURSE_ID\",
    \"topicId\": \"$TEST_TOPIC_ID\"
}" "answer citations"

# Test 5: Compression Generation
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Test: Compression Generation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Generating compression notes (this may take 30-60 seconds)..."
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/generate-compression" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"topicId\": \"$TEST_TOPIC_ID\"
    }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Compression Generated${NC}"
    echo ""
    echo -e "${CYAN}Content Preview (first 500 chars):${NC}"
    echo "$body" | jq -r '.content' | head -c 500
    echo "..."
    echo ""
    echo ""
    echo -e "${CYAN}Quality Validation:${NC}"
    validate_response_quality "$body" "compression"
    
    # Show full structure
    echo -e "${CYAN}Full Content Structure:${NC}"
    echo "$body" | jq -r '.content' | head -100
    echo ""
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Compression Failed (HTTP $http_code)${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Test Summary                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}❌ Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your AI features are working perfectly!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above for details.${NC}"
    exit 1
fi

