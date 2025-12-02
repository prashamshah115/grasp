#!/bin/bash

# GRASP Edge Functions Deployment Script
# Deploys all Supabase Edge Functions and sets secrets

set -e  # Exit on error

echo "🚀 Starting GRASP Edge Functions Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Check if supabase/.env exists
if [ ! -f "supabase/.env" ]; then
    echo -e "${YELLOW}⚠️  Warning: supabase/.env not found${NC}"
    echo "Creating from template..."
    echo ""
    echo "# Supabase Edge Functions Environment Variables" > supabase/.env
    echo "# Add your secrets here before deploying" >> supabase/.env
    echo ""
    echo -e "${YELLOW}Please create supabase/.env with your secrets, then run this script again${NC}"
    exit 1
fi

# Functions to deploy (in dependency order)
FUNCTIONS=(
    # Core ingestion pipeline
    "ingest-document"
    "finalize-document"
    
    # RAG and chat
    "rag-chat"
    "get-relevant-content"
    "search-web"
    
    # Practice and questions
    "next-global-question"
    "update-question-history"
    "update-mastery"
    
    # Compression and knowledge
    "generate-compression"
    "trigger-knowledge-graph"
    "trigger-final-packs"
    "compute-ksv"
    
    # Exam functionality
    "start-exam-session"
    "submit-exam"
    "analyze-graded-assignment"
    
    # Batch operations
    "batch-ingest-storage"
    "batch-reingest-documents"
    
    # Utility
    "health-check"
)

echo -e "${GREEN}📦 Deploying ${#FUNCTIONS[@]} Edge Functions...${NC}"
echo ""

# Deploy each function
SUCCESS_COUNT=0
FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}Deploying: ${func}${NC}"
    if supabase functions deploy "$func" --no-verify-jwt 2>&1 | tee /tmp/deploy_${func}.log; then
        echo -e "${GREEN}✅ ${func} deployed successfully${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}❌ ${func} deployment failed${NC}"
        FAILED_FUNCTIONS+=("$func")
    fi
    echo ""
done

# Set secrets
echo -e "${GREEN}🔐 Setting secrets from supabase/.env...${NC}"
if supabase secrets set --env-file ./supabase/.env; then
    echo -e "${GREEN}✅ Secrets set successfully${NC}"
else
    echo -e "${RED}❌ Failed to set secrets${NC}"
    echo "You may need to set secrets manually:"
    echo "  supabase secrets set KEY=value"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📊 Deployment Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "✅ Successful: ${SUCCESS_COUNT}/${#FUNCTIONS[@]}"
echo ""

if [ ${#FAILED_FUNCTIONS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed Functions:${NC}"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "  - $func"
        echo "    Check logs: /tmp/deploy_${func}.log"
    done
    echo ""
    echo -e "${YELLOW}⚠️  Some functions failed to deploy. Review logs above.${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 All functions deployed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify functions in Supabase Dashboard"
    echo "  2. Test functions with curl or Postman"
    echo "  3. Check function logs for any errors"
    exit 0
fi



