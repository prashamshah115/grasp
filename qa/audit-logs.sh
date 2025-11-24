#!/bin/bash

# Supabase Log Auditing Script
# Fetches logs from Supabase Functions and prepares them for AI analysis

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
LOG_DIR="${LOG_DIR:-qa/logs}"
SINCE="${SINCE:-1h}"
FUNCTIONS=(
  "rag-chat"
  "generate-compression"
  "start-exam-session"
  "submit-exam"
  "next-global-question"
  "update-mastery"
  "update-question-history"
  "trigger-ingest"
  "ingest-document"
)

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${GREEN}🔍 Fetching Supabase Function Logs${NC}"
echo "Log directory: $LOG_DIR"
echo "Time range: $SINCE"
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
  echo -e "${YELLOW}⚠️  Supabase CLI not found. Install it first:${NC}"
  echo "  npm install -g supabase"
  echo ""
  echo "Or use Supabase Dashboard to download logs manually."
  exit 1
fi

# Fetch logs for each function
for func in "${FUNCTIONS[@]}"; do
  echo -e "${YELLOW}📥 Fetching logs for: $func${NC}"
  
  # Fetch logs using Supabase CLI
  supabase functions logs "$func" --since "$SINCE" > "$LOG_DIR/${func}.log" 2>&1 || {
    echo "  ⚠️  Failed to fetch logs for $func (may not be deployed)"
  }
  
  # Count lines
  if [ -f "$LOG_DIR/${func}.log" ]; then
    line_count=$(wc -l < "$LOG_DIR/${func}.log" | tr -d ' ')
    echo "  ✅ Fetched $line_count lines"
  fi
done

# Combine all logs
echo ""
echo -e "${GREEN}📊 Combining logs...${NC}"
cat "$LOG_DIR"/*.log > "$LOG_DIR/combined.log" 2>/dev/null || true

# Count errors
error_count=$(grep -i "error\|exception\|failed" "$LOG_DIR/combined.log" 2>/dev/null | wc -l | tr -d ' ' || echo "0")
echo "  Found $error_count potential errors"

echo ""
echo -e "${GREEN}✅ Logs saved to: $LOG_DIR${NC}"
echo ""
echo "Next steps:"
echo "  1. Review logs: cat $LOG_DIR/combined.log"
echo "  2. Parse logs: node qa/parse-logs.js"
echo "  3. Use AI auditor: See qa/log-auditor-prompt.md"

