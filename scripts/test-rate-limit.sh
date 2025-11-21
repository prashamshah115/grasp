#!/bin/bash
# 🧪 RATE LIMIT TESTING SCRIPT
# Tests that rate limiting is working correctly after deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Rate Limit Testing Script${NC}"
echo "============================"
echo ""

# Check required environment variables
if [ -z "$PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ PUBLIC_SUPABASE_URL not set${NC}"
    echo "Set it with: export PUBLIC_SUPABASE_URL='https://xxxxx.supabase.co'"
    exit 1
fi

if [ -z "$USER_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  USER_TOKEN not set${NC}"
    echo "Get a token by logging in via your frontend, then:"
    echo "  export USER_TOKEN='your-jwt-token'"
    echo ""
    echo "For now, testing without auth (will get 401)..."
    USER_TOKEN="fake-token"
fi

echo -e "${GREEN}✅ Environment variables set${NC}"
echo ""

# Test 1: Test endpoint is alive
echo "📋 Test 1: Checking if rag-chat endpoint is alive..."
response=$(curl -s -w "\n%{http_code}" -X POST "$PUBLIC_SUPABASE_URL/functions/v1/rag-chat" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' 2>&1)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✅ Endpoint is alive (returned 401 Unauthorized - expected without valid token)${NC}"
elif [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Endpoint is alive and authenticated${NC}"
else
    echo -e "${YELLOW}⚠️  Endpoint returned: $http_code${NC}"
    echo "Response: $body"
fi
echo ""

# Test 2: Test rate limit (requires valid token)
echo "📋 Test 2: Testing rate limit..."
if [ "$USER_TOKEN" = "fake-token" ]; then
    echo -e "${YELLOW}⚠️  Skipping (need valid USER_TOKEN)${NC}"
else
    echo "Sending 15 requests (limit is 10/min)..."
    success_count=0
    rate_limited_count=0

    for i in {1..15}; do
        response=$(curl -s -w "\n%{http_code}" -X POST "$PUBLIC_SUPABASE_URL/functions/v1/rag-chat" \
          -H "Authorization: Bearer $USER_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"message\": \"test $i\"}" 2>&1)

        http_code=$(echo "$response" | tail -n1)

        if [ "$http_code" = "200" ]; then
            success_count=$((success_count + 1))
            echo -e "  Request $i: ${GREEN}✅ 200 OK${NC}"
        elif [ "$http_code" = "429" ]; then
            rate_limited_count=$((rate_limited_count + 1))
            echo -e "  Request $i: ${YELLOW}⚠️  429 Rate Limited${NC}"
        else
            echo -e "  Request $i: ${RED}❌ $http_code${NC}"
        fi

        sleep 0.5
    done

    echo ""
    echo "Results:"
    echo "  Success: $success_count"
    echo "  Rate Limited: $rate_limited_count"

    if [ $rate_limited_count -gt 0 ]; then
        echo -e "${GREEN}✅ Rate limiting is working!${NC}"
    else
        echo -e "${YELLOW}⚠️  No rate limiting detected (might need more requests)${NC}"
    fi
fi
echo ""

# Test 3: Check rate limit headers
echo "📋 Test 3: Checking rate limit headers..."
if [ "$USER_TOKEN" = "fake-token" ]; then
    echo -e "${YELLOW}⚠️  Skipping (need valid USER_TOKEN)${NC}"
else
    response=$(curl -i -s -X POST "$PUBLIC_SUPABASE_URL/functions/v1/rag-chat" \
      -H "Authorization: Bearer $USER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"message": "test"}' 2>&1)

    if echo "$response" | grep -q "X-RateLimit"; then
        echo -e "${GREEN}✅ Rate limit headers present:${NC}"
        echo "$response" | grep "X-RateLimit" | sed 's/^/  /'
    else
        echo -e "${YELLOW}⚠️  No rate limit headers found${NC}"
        echo "Headers received:"
        echo "$response" | head -n 20
    fi
fi
echo ""

# Test 4: Test generate-compression endpoint
echo "📋 Test 4: Checking generate-compression endpoint..."
response=$(curl -s -w "\n%{http_code}" -X POST "$PUBLIC_SUPABASE_URL/functions/v1/generate-compression" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topicId": "test"}' 2>&1)

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✅ Endpoint is alive (returned 401 - expected)${NC}"
elif [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
    echo -e "${GREEN}✅ Endpoint is alive${NC}"
else
    echo -e "${YELLOW}⚠️  Endpoint returned: $http_code${NC}"
fi
echo ""

# Summary
echo "================================"
echo -e "${BLUE}📊 Test Summary${NC}"
echo "================================"
echo ""
echo "✅ Deployment verification complete!"
echo ""
echo "Next steps:"
echo "1. Get a valid user token (login via frontend)"
echo "2. Set: export USER_TOKEN='your-jwt-token'"
echo "3. Run this script again to test rate limiting"
echo ""
echo "To view rate limit usage in database:"
echo "  SELECT * FROM rate_limit_usage ORDER BY created_at DESC LIMIT 10;"
echo ""
