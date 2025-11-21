#!/bin/bash
# 🚀 QUICK DEPLOYMENT SCRIPT - Run this to deploy everything
# Deploys rate limiting + updated edge functions

set -e  # Exit on error

echo "🚀 GRASP Deployment Script"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if Supabase CLI is installed
echo "📋 Step 1: Checking prerequisites..."
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Step 2: Check if logged in
echo "📋 Step 2: Checking Supabase login..."
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Logging in..."
    supabase login
fi
echo -e "${GREEN}✅ Logged in to Supabase${NC}"
echo ""

# Step 3: Push database migrations
echo "📋 Step 3: Deploying database migrations..."
echo "This will create the rate_limit_usage table and functions..."
supabase db push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database migration successful${NC}"
else
    echo -e "${RED}❌ Database migration failed${NC}"
    echo "Try running manually:"
    echo "  supabase db push"
    exit 1
fi
echo ""

# Step 4: Deploy edge functions
echo "📋 Step 4: Deploying edge functions..."

echo "Deploying rag-chat..."
supabase functions deploy rag-chat
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ rag-chat deployed${NC}"
else
    echo -e "${RED}❌ rag-chat deployment failed${NC}"
fi

echo ""
echo "Deploying generate-compression..."
supabase functions deploy generate-compression
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ generate-compression deployed${NC}"
else
    echo -e "${RED}❌ generate-compression deployment failed${NC}"
fi

echo ""

# Step 5: Verify deployment
echo "📋 Step 5: Verifying deployment..."
echo "Checking edge functions..."
supabase functions list

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo ""
echo "Next steps:"
echo "1. Test rate limiting (see DEPLOYMENT_GUIDE.md)"
echo "2. Check edge function logs in Supabase Dashboard"
echo "3. Monitor rate_limit_usage table for activity"
echo ""
echo "Quick test:"
echo "  curl -X POST \"\$PUBLIC_SUPABASE_URL/functions/v1/rag-chat\" \\"
echo "    -H \"Authorization: Bearer \$USER_TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"message\": \"test\"}'"
echo ""
echo "View usage:"
echo "  SELECT * FROM rate_limit_usage ORDER BY created_at DESC LIMIT 10;"
echo ""
