#!/bin/bash
###############################################################################
# Deploy ALL GRASP Edge Functions
# 
# Usage:
#   ./scripts/deploy-all-functions.sh
#
# This script deploys all 13 edge functions to Supabase
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║          🚀 DEPLOYING ALL GRASP EDGE FUNCTIONS 🚀             ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Logging in..."
    supabase login
fi

# List of all edge functions
FUNCTIONS=(
    "health-check"
    "rag-chat"
    "generate-compression"
    "next-global-question"
    "update-question-history"
    "update-mastery"
    "start-exam-session"
    "submit-exam"
    "trigger-ingest"
    "ingest-document"
    "batch-ingest-storage"
    "batch-reingest-documents"
    "test-ingest"
)

# Deploy each function
PASSED=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}📦 Deploying: ${func}...${NC}"
    
    if supabase functions deploy "$func" --no-verify-jwt 2>&1; then
        echo -e "${GREEN}✅ ${func} deployed successfully${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ ${func} deployment failed${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Summary
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DEPLOYMENT SUMMARY${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total functions: ${#FUNCTIONS[@]}"
echo -e "  ${GREEN}✓ Successfully deployed: $PASSED${NC}"
echo -e "  ${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Some deployments failed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All functions deployed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run test suite: ./scripts/test-edge-functions.sh"
    echo "2. Check function logs in Supabase Dashboard"
    echo "3. Test health-check endpoint"
    exit 0
fi

