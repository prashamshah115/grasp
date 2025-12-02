#!/bin/bash

# Production Deployment Script
# Deploys all changes for production readiness

set -e  # Exit on error

echo "🚀 Starting Production Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Apply Database Migrations
echo -e "${YELLOW}Step 1: Applying Database Migrations...${NC}"
echo "This will apply:"
echo "  - RLS policies migration (security critical)"
echo "  - Performance indexes migration"
echo ""
read -p "Continue with database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Applying migrations..."
  supabase db push
  echo -e "${GREEN}✓ Migrations applied${NC}"
else
  echo -e "${RED}✗ Skipped migrations${NC}"
  echo "⚠️  WARNING: RLS policies and indexes are critical for production!"
fi

echo ""

# Step 2: Deploy Edge Functions
echo -e "${YELLOW}Step 2: Deploying Edge Functions...${NC}"
echo "This will deploy all edge functions with rate limiting:"
echo "  - rag-chat"
echo "  - generate-compression"
echo "  - compute-ksv"
echo "  - next-global-question"
echo "  - update-question-history"
echo "  - update-mastery"
echo "  - start-exam-session"
echo "  - submit-exam"
echo ""
read -p "Continue with edge function deployment? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Deploying edge functions..."
  
  # Deploy functions with rate limiting
  supabase functions deploy rag-chat
  supabase functions deploy generate-compression
  supabase functions deploy compute-ksv
  supabase functions deploy next-global-question
  supabase functions deploy update-question-history
  supabase functions deploy update-mastery
  supabase functions deploy start-exam-session
  supabase functions deploy submit-exam
  
  echo -e "${GREEN}✓ Edge functions deployed${NC}"
else
  echo -e "${RED}✗ Skipped edge function deployment${NC}"
fi

echo ""

# Step 3: Verify Secrets
echo -e "${YELLOW}Step 3: Verifying Edge Function Secrets...${NC}"
echo "Checking required secrets..."
supabase secrets list

echo ""
read -p "Are all required secrets set? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}⚠️  WARNING: Missing secrets may cause edge functions to fail!${NC}"
  echo "Required secrets:"
  echo "  - OPENAI_API_KEY"
  echo "  - JINA_API_KEY"
  echo "  - TAVILY_API_KEY (optional)"
  echo "  - SERVICE_ROLE_KEY"
  echo "  - PUBLIC_SUPABASE_URL"
fi

echo ""

# Step 4: Production Configuration Reminder
echo -e "${YELLOW}Step 4: Production Configuration${NC}"
echo "⚠️  IMPORTANT: Verify these settings manually:"
echo ""
echo "1. Supabase Dashboard → Settings → API → Site URL"
echo "   Must be: https://novalo.io (NOT localhost)"
echo ""
echo "2. Supabase Dashboard → Authentication → URL Configuration"
echo "   Must include: https://novalo.io and https://novalo.io/**"
echo ""
echo "3. Vercel Dashboard → Settings → Environment Variables"
echo "   Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set"
echo ""
echo "4. Google Cloud Console → OAuth Credentials"
echo "   Verify redirect URI points to Supabase callback"
echo ""
echo "See PRODUCTION_CONFIG_CHECKLIST.md for detailed instructions"
echo ""

# Step 5: Summary
echo -e "${GREEN}✓ Deployment script completed${NC}"
echo ""
echo "Next steps:"
echo "1. Verify production configuration (see above)"
echo "2. Deploy frontend to Vercel (push to main branch or trigger manually)"
echo "3. Run smoke tests on production URL"
echo "4. Monitor Supabase logs for errors"
echo ""
echo "For detailed information, see:"
echo "  - PRODUCTION_READINESS_SUMMARY.md"
echo "  - PRODUCTION_CONFIG_CHECKLIST.md"
echo ""

