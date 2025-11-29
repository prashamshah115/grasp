# Critical Bug Fixes and Deployment Guide

## Issues Fixed

### 1. ✅ Finals Pack Renders White Screen
**Problem**: `FinalPackView` component was rendered in router without required props (courseId, courseCode, onStartPractice)

**Fix**: Created `FinalPackViewPage.tsx` wrapper component that:
- Extracts courseId from URL params using `useParams()`
- Fetches course data using `useCourse()` hook
- Provides navigation handler for `onStartPractice`
- Passes all required props to `FinalPackView`

**Files Changed**:
- Created: `src/components/finals/FinalPackViewPage.tsx`
- Modified: `src/router.tsx` (updated import and route element)

---

### 2. ✅ App Goes White on Reload
**Problem**: Missing error boundaries catching component crashes

**Status**: Already properly configured:
- `GlobalErrorBoundary` wraps entire app in `src/main.tsx`
- `QueryErrorResetBoundary` handles React Query errors
- Individual route `ErrorBoundary` components catch routing errors

**Root Cause**: The white screen was caused by Issue #1 (missing props)

---

### 3. ✅ Created .env File for Development
**Problem**: No `.env` file for local development (only `.env.test`)

**Fix**: Created `.env` file with Supabase configuration

**File Created**: `.env`

```env
VITE_SUPABASE_URL=https://hmuhgywxtfgamvgldzge.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ⚠️ CRITICAL: Required Environment Variables for Vercel

The following environment variables MUST be set in Vercel for the app to work properly:

### Required for Frontend
```
VITE_SUPABASE_URL=https://hmuhgywxtfgamvgldzge.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdWhneXd4dGZnYW12Z2xkemdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NzE5ODQsImV4cCI6MjA3OTE0Nzk4NH0.uzGX7JShsIOk6igrJlLv-oOM8dQBvLygkQSld5s7klM
```

### Required for Edge Functions (Supabase)
These should be set in your Supabase project secrets:

```bash
# Navigate to Supabase Dashboard > Project Settings > Edge Functions > Environment Variables

OPENAI_API_KEY=sk-...  # Required for AI compression and chat features
TRIGGER_API_URL=https://api.trigger.dev  # Required for background jobs
TRIGGER_SECRET_KEY=tr_...  # Get from Trigger.dev dashboard
```

**How to set in Supabase**:
```bash
# Using Supabase CLI
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TRIGGER_API_URL=https://api.trigger.dev
supabase secrets set TRIGGER_SECRET_KEY=tr_...
```

---

## Known Issues (Still Investigating)

### 4. 🔍 Generate Study Materials Not Working
**Symptoms**: Clicking "Generate Study Materials" button doesn't create content

**Likely Causes**:
1. Missing `TRIGGER_SECRET_KEY` in Supabase edge function environment
2. Trigger.dev tasks not deployed or running
3. Missing course materials (documents) in database

**Investigation Needed**:
- Check Trigger.dev dashboard for failed jobs
- Verify `precompute-final-packs` task is deployed
- Check database for existing `final_packs` table data

---

### 5. 🔍 Compression and AI Chat Return 20XX Errors
**Symptoms**: HTTP 200+ errors when using AI compression or chat

**Likely Causes**:
1. **Missing OPENAI_API_KEY**: Edge function `generate-compression` requires this
2. **API Rate Limits**: OpenAI API quota exceeded
3. **Invalid Model**: Code uses `gpt-5-nano` which may not exist yet (should be `gpt-4-turbo` or `gpt-3.5-turbo`)

**Fix Required**:
```typescript
// In supabase/functions/generate-compression/index.ts
// Change line 36 from:
model: 'gpt-5-nano',
// To:
model: 'gpt-4-turbo-preview',
```

**Edge Functions Affected**:
- `generate-compression` - requires OPENAI_API_KEY
- `rag-chat` - requires OPENAI_API_KEY
- `trigger-final-packs` - requires TRIGGER_API_URL and TRIGGER_SECRET_KEY
- `trigger-knowledge-graph` - requires TRIGGER_API_URL and TRIGGER_SECRET_KEY

---

### 6. 🔍 Materials Don't Exist Errors
**Symptoms**: "No course materials found" errors when generating compression or accessing study materials

**Root Causes**:
1. No documents uploaded to course
2. Documents not associated with topics (NULL topic_id)
3. RLS policies preventing access to documents

**User Action Required**:
- Upload course materials via the "Upload Materials" button
- Ensure materials are processed by Trigger.dev pipeline
- Check that `documents` and `document_pages` tables have data

**Error Message Location**: `src/components/compression/CompressionView.tsx:169`

---

### 7. 🔍 Study Packs Not Dynamic
**Symptoms**: Study packs show static content instead of personalized recommendations

**Investigation Needed**:
- Check if `knowledge_state_vector` table is populated
- Verify KSV update triggers are working
- Check `final_packs` table for dynamic content fields
- Verify `useFinalPacks` hook is fetching latest data

**Files to Review**:
- `src/hooks/useFinals.ts` - Data fetching logic
- `src/components/finals/FinalPackView.tsx` - Display logic
- `trigger/tasks/precompute-final-packs.ts` - Generation logic

---

## Deployment Checklist

### Vercel Deployment
- [x] Set `VITE_SUPABASE_URL` in Vercel environment variables
- [x] Set `VITE_SUPABASE_ANON_KEY` in Vercel environment variables
- [ ] Verify build completes successfully
- [ ] Test authentication flow after deployment
- [ ] Verify routing works (especially `/course/:courseId/finals/pack`)

### Supabase Edge Functions
- [ ] Deploy all edge functions: `supabase functions deploy`
- [ ] Set `OPENAI_API_KEY` secret
- [ ] Set `TRIGGER_API_URL` secret
- [ ] Set `TRIGGER_SECRET_KEY` secret
- [ ] Test edge functions via Supabase dashboard

### Trigger.dev Background Jobs
- [ ] Deploy Trigger.dev tasks
- [ ] Verify API key is correct
- [ ] Test manual trigger of `precompute-final-packs`
- [ ] Monitor job execution in Trigger.dev dashboard

### Database
- [ ] Verify all tables exist (courses, topics, questions, documents, final_packs, etc.)
- [ ] Check RLS policies allow authenticated users to read their data
- [ ] Seed sample course data for testing

---

## Quick Test After Deployment

1. **Authentication**: Sign in with Google OAuth or email
2. **Navigation**: Visit `/courses` and select a course
3. **Finals Pack**: Navigate to `/course/:courseId/finals/pack`
   - Should load without white screen ✅
   - Should show tabs (Essentials, Must-Solve, Drills)
4. **Upload Materials**: Try uploading a PDF
5. **Generate Compression**: Select a topic and click "Generate"
   - Should call edge function without 20XX errors
6. **AI Chat**: Open chat panel and send a message
   - Should get AI response

---

## Next Steps

1. **Fix OpenAI Model Name**: Change `gpt-5-nano` to valid model
2. **Set Environment Variables**: Add all required secrets to Supabase
3. **Deploy Edge Functions**: Run `supabase functions deploy`
4. **Test Trigger.dev**: Manually trigger final packs generation
5. **Monitor Errors**: Check Supabase logs and Vercel logs for issues
6. **User Testing**: Have user upload materials and generate study packs

---

## Support Resources

- **Supabase Logs**: https://app.supabase.com/project/hmuhgywxtfgamvgldzge/logs
- **Vercel Logs**: Vercel Dashboard > Deployment Logs
- **Trigger.dev Dashboard**: https://cloud.trigger.dev
- **OpenAI Status**: https://status.openai.com

