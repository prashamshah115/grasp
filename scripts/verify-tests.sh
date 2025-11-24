#!/bin/bash

# Verify Test Implementation
# Checks that all test files exist and are properly structured

set -e

echo "🔍 Verifying Backend Test Implementation..."
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TOTAL=0
FOUND=0
MISSING=0

# Function to check file exists
check_file() {
  local file=$1
  TOTAL=$((TOTAL + 1))
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $file"
    FOUND=$((FOUND + 1))
    return 0
  else
    echo -e "${RED}❌${NC} $file (MISSING)"
    MISSING=$((MISSING + 1))
    return 1
  fi
}

echo "📁 Checking Test Files..."
echo ""

# Unit Tests
echo "Unit Tests:"
check_file "tests/backend/unit/edge-functions/rag-chat.test.ts"
check_file "tests/backend/unit/edge-functions/generate-compression.test.ts"
check_file "tests/backend/unit/edge-functions/start-exam-session.test.ts"
check_file "tests/backend/unit/edge-functions/submit-exam.test.ts"
check_file "tests/backend/unit/edge-functions/next-global-question.test.ts"
check_file "tests/backend/unit/edge-functions/update-question-history.test.ts"
check_file "tests/backend/unit/edge-functions/update-mastery.test.ts"
check_file "tests/backend/unit/edge-functions/ingest-document.test.ts"
check_file "tests/backend/unit/shared/errors.test.ts"
echo ""

# Integration Tests
echo "Integration Tests:"
check_file "tests/backend/integration/rag-chat.integration.test.ts"
check_file "tests/backend/integration/generate-compression.integration.test.ts"
echo ""

# Database Tests
echo "Database Tests:"
check_file "tests/backend/database/rls-policies.test.ts"
check_file "tests/backend/database/constraints.test.ts"
echo ""

# Security Tests
echo "Security Tests:"
check_file "tests/backend/security/authentication.test.ts"
check_file "tests/backend/security/input-validation.test.ts"
echo ""

# Performance Tests
echo "Performance Tests:"
check_file "tests/backend/performance/response-time.test.ts"
echo ""

# Infrastructure Files
echo "Infrastructure Files:"
check_file "tests/backend/config.ts"
check_file "tests/backend/utils/helpers.ts"
check_file "tests/backend/setup/fixtures.ts"
check_file "tests/backend/README.md"
check_file "tests/backend/QUICK_REFERENCE.md"
echo ""

# Scripts
echo "Scripts:"
check_file "scripts/test-backend.sh"
echo ""

# Summary
echo "=========================================="
echo "📊 Summary:"
echo "  Total files checked: $TOTAL"
echo -e "  ${GREEN}Found: $FOUND${NC}"
if [ $MISSING -gt 0 ]; then
  echo -e "  ${RED}Missing: $MISSING${NC}"
else
  echo -e "  ${GREEN}Missing: 0${NC}"
fi
echo ""

if [ $MISSING -eq 0 ]; then
  echo -e "${GREEN}✅ All test files are present!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Install Deno: curl -fsSL https://deno.land/install.sh | sh"
  echo "2. Start Supabase: supabase start"
  echo "3. Run tests: npm run test:backend"
  exit 0
else
  echo -e "${RED}❌ Some test files are missing${NC}"
  exit 1
fi

