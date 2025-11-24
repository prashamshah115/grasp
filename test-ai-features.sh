#!/bin/bash

# 🧪 Comprehensive AI Chat & Compression Testing Script
# Usage: ./test-ai-features.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE VALUES
ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key-here}"
COURSE_ID="${TEST_COURSE_ID:-your-course-id-here}"
TOPIC_ID="${TEST_TOPIC_ID:-your-topic-id-here}"
QUESTION_ID="${TEST_QUESTION_ID:-your-question-id-here}"
BASE_URL="${SUPABASE_URL:-http://localhost:54321/functions/v1}"

echo -e "${BLUE}🧪 GRASP AI Chat & Compression Testing${NC}"
echo "=========================================="
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not found. Install it for better output formatting: brew install jq${NC}"
    JQ_CMD="cat"
else
    JQ_CMD="jq '.'"
fi

# Function to test endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    local data=$3
    
    echo -e "${BLUE}Testing: ${name}${NC}"
    echo "Endpoint: $endpoint"
    echo "Data: $data"
    echo ""
    
    response=$(curl -s -X POST "$BASE_URL/$endpoint" \
        -H "Authorization: Bearer $ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        echo "$response" | $JQ_CMD
    else
        echo -e "${RED}❌ Failed${NC}"
        echo "$response"
    fi
    echo ""
    echo "---"
    echo ""
}

# Test 1: Basic RAG Chat
echo -e "${GREEN}📝 Test 1: Basic RAG Chat (No Context)${NC}"
test_endpoint "Basic RAG Chat" "rag-chat" "{
    \"message\": \"What is virtual memory? Explain it comprehensively.\",
    \"courseId\": \"$COURSE_ID\"
}"

# Test 2: Topic-Specific RAG Chat
echo -e "${GREEN}📝 Test 2: Topic-Specific RAG Chat${NC}"
test_endpoint "Topic-Specific Chat" "rag-chat" "{
    \"message\": \"Explain page faults in detail. Include how they are handled.\",
    \"courseId\": \"$COURSE_ID\",
    \"topicId\": \"$TOPIC_ID\"
}"

# Test 3: Question Context Chat
if [ "$QUESTION_ID" != "your-question-id-here" ]; then
    echo -e "${GREEN}📝 Test 3: Question Context Chat${NC}"
    test_endpoint "Question Context Chat" "rag-chat" "{
        \"message\": \"Help me understand this question better\",
        \"courseId\": \"$COURSE_ID\",
        \"topicId\": \"$TOPIC_ID\",
        \"questionId\": \"$QUESTION_ID\"
    }"
else
    echo -e "${YELLOW}⚠️  Skipping Test 3: QUESTION_ID not set${NC}"
fi

# Test 4: Complex Multi-Part Question
echo -e "${GREEN}📝 Test 4: Complex Multi-Part Question${NC}"
test_endpoint "Complex Question" "rag-chat" "{
    \"message\": \"Compare and contrast processes and threads. Include examples, use cases, and explain when to use each.\",
    \"courseId\": \"$COURSE_ID\",
    \"topicId\": \"$TOPIC_ID\"
}"

# Test 5: Compression Generation
echo -e "${GREEN}📝 Test 5: Compression Generation${NC}"
echo "Generating compression notes..."
response=$(curl -s -X POST "$BASE_URL/generate-compression" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"topicId\": \"$TOPIC_ID\"
    }")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Compression Generated${NC}"
    echo ""
    echo "Content preview (first 1000 chars):"
    echo "$response" | jq -r '.content' | head -c 1000
    echo ""
    echo ""
    echo "Full response:"
    echo "$response" | $JQ_CMD
    
    # Check for quality indicators
    content=$(echo "$response" | jq -r '.content')
    echo ""
    echo -e "${BLUE}Quality Checks:${NC}"
    
    if echo "$content" | grep -q "##"; then
        echo -e "${GREEN}✅ Has section headers${NC}"
    else
        echo -e "${YELLOW}⚠️  No section headers found${NC}"
    fi
    
    if echo "$content" | grep -q "\*\*"; then
        echo -e "${GREEN}✅ Has bold terms${NC}"
    else
        echo -e "${YELLOW}⚠️  No bold terms found${NC}"
    fi
    
    if echo "$content" | grep -q "```"; then
        echo -e "${GREEN}✅ Has code blocks${NC}"
    else
        echo -e "${YELLOW}⚠️  No code blocks found${NC}"
    fi
    
    bullet_count=$(echo "$content" | grep -c "^-" || echo "0")
    echo "Bullet points: $bullet_count"
    if [ "$bullet_count" -ge 15 ]; then
        echo -e "${GREEN}✅ Sufficient bullet points (15+)${NC}"
    else
        echo -e "${YELLOW}⚠️  Fewer than 15 bullet points${NC}"
    fi
else
    echo -e "${RED}❌ Compression Failed${NC}"
    echo "$response"
fi

echo ""
echo "---"
echo ""

# Summary
echo -e "${GREEN}✅ Testing Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review response quality"
echo "2. Check citations"
echo "3. Verify compression structure"
echo "4. Test in frontend UI"
echo ""
echo "For detailed testing guide, see: TESTING_GUIDE.md"

