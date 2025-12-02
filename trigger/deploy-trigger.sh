#!/bin/bash
# Deploy Trigger.dev tasks
echo "🚀 Deploying Trigger.dev tasks..."
echo ""
echo "Tasks to deploy:"
echo "  ✅ extract-paragraphs"
echo "  ✅ generate-personalized-study-pack"
echo ""
echo "Starting Trigger.dev dev server (this syncs tasks)..."
echo "Press Ctrl+C after you see 'Tasks synced' message"
echo ""
npx @trigger.dev/cli@latest dev
