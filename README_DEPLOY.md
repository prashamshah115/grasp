# GRASP Vercel Deployment Guide — November 2025

Complete production deployment guide for GRASP on Vercel with Supabase Edge Functions and Trigger.dev V4.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Vercel Project Setup](#vercel-project-setup)
4. [Environment Variables](#environment-variables)
5. [Supabase Configuration](#supabase-configuration)
6. [Supabase Edge Functions Deployment](#supabase-edge-functions-deployment)
7. [Trigger.dev V4 Deployment](#triggerdev-v4-deployment)
8. [Production Testing Checklist](#production-testing-checklist)
9. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Frontend
- **Framework:** Vite 5 SPA (React Router v7)
- **Deployment:** Static files to Vercel (`dist/` directory)
- **Routing:** Client-side routing with SPA rewrites

### Backend
- **API:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase PostgreSQL with pgvector
- **Auth:** Supabase Auth (Email + Google OAuth)

### Scheduled Jobs
- **Platform:** Trigger.dev V4
- **Tasks:** Nightly knowledge graph, final packs, embeddings

---

## Prerequisites

Before deploying, ensure you have:

- [ ] Node.js 20.x installed
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Vercel CLI installed (`npm install -g vercel`)
- [ ] Trigger.dev CLI installed (`npm install -g @trigger.dev/cli`)
- [ ] GitHub repository connected to Vercel
- [ ] Supabase project created
- [ ] Trigger.dev account and project created

---

## Vercel Project Setup

### 1. Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project settings:

   **Framework Preset:** Vite
   
   **Build Command:** `npm run build`
   
   **Output Directory:** `dist`
   
   **Install Command:** `npm install`
   
   **Node Version:** 20.x

### 2. Verify Configuration

The `vercel.json` file in your repo should contain:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures:
- React Router deep links work correctly
- All routes fallback to `index.html` (SPA routing)
- Assets load correctly on subroutes

---

## Environment Variables

### Frontend Variables (VITE_* prefix)

These are exposed to the browser and **MUST** start with `VITE_`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend Variables (Server-side only)

These are **NOT** exposed to the browser (no `VITE_` prefix):

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
SUPABASE_PROJECT_ID=your_supabase_project_id
SUPABASE_GRAPHQL_URL=https://your-project.supabase.co/graphql/v1
SUPABASE_DB_PASSWORD=your_database_password
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
JINA_API_KEY=your_jina_api_key
TAVILY_API_KEY=your_tavily_api_key
```

### Setting Variables in Vercel

1. Go to **Project Settings → Environment Variables**
2. Add each variable
3. **IMPORTANT:** Scope each variable to:
   - ✅ Development
   - ✅ Preview
   - ✅ Production

**Why scoping matters:** Vercel 2025 requires explicit scoping. If you don't scope variables, they won't be available in production builds.

### Getting Supabase Values

1. **SUPABASE_URL:** Found in Supabase Dashboard → Settings → API → Project URL
2. **SUPABASE_ANON_KEY:** Found in Supabase Dashboard → Settings → API → anon public key
3. **SUPABASE_SERVICE_ROLE_KEY:** Found in Supabase Dashboard → Settings → API → service_role secret key
4. **SUPABASE_JWT_SECRET:** Found in Supabase Dashboard → Settings → API → JWT Secret
5. **SUPABASE_PROJECT_ID:** Found in Supabase Dashboard → Settings → General → Reference ID
6. **SUPABASE_GRAPHQL_URL:** `https://<project-ref>.supabase.co/graphql/v1`
7. **SUPABASE_DB_PASSWORD:** Set during project creation (or reset in Database settings)

---

## Supabase Configuration

### 1. Auth Redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**, add:

**Allowed Redirect URLs:**
```
http://localhost:5173
http://localhost:3000
https://<your-vercel-app>.vercel.app
https://<your-custom-domain>
```

**Allowed Callback URLs:**
```
http://localhost:5173
http://localhost:3000
https://<your-vercel-app>.vercel.app
https://<your-custom-domain>
```

**⚠️ IMPORTANT:** Do **NOT** include `/auth/callback` paths. Supabase 2025 uses hash-based OAuth tokens (`/#access_token=...`) and redirects to the root path.

**Allowed Logout URLs:**
```
http://localhost:5173
http://localhost:3000
https://<your-vercel-app>.vercel.app
https://<your-custom-domain>
```

### 2. Google OAuth Setup

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Enable **Google** provider
3. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
4. Add authorized redirect URI in Google Console:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

### 3. Email Configuration

1. Go to **Supabase Dashboard → Authentication → Email Templates**
2. Customize email templates if needed
3. Ensure email confirmation is enabled (recommended for production)

---

## Supabase Edge Functions Deployment

### Automated Deployment

Use the provided deployment script:

```bash
bash scripts/deploy-edge-functions.sh
```

### Manual Deployment

Deploy each function individually:

```bash
# Core ingestion pipeline
supabase functions deploy ingest-document
supabase functions deploy finalize-document

# RAG and chat
supabase functions deploy rag-chat
supabase functions deploy get-relevant-content
supabase functions deploy search-web

# Practice and questions
supabase functions deploy next-global-question
supabase functions deploy update-question-history
supabase functions deploy update-mastery

# Compression and knowledge
supabase functions deploy generate-compression
supabase functions deploy trigger-knowledge-graph
supabase functions deploy trigger-final-packs

# Exam functionality
supabase functions deploy start-exam-session
supabase functions deploy submit-exam
supabase functions deploy analyze-graded-assignment

# Batch operations
supabase functions deploy batch-ingest-storage
supabase functions deploy batch-reingest-documents
```

### Setting Secrets

Edge Functions need access to environment variables. Set them via CLI:

```bash
# Create a .env file in supabase/ directory with all backend variables
supabase secrets set --env-file ./supabase/.env
```

Or set individually:

```bash
supabase secrets set OPENAI_API_KEY=your_key
supabase secrets set GROQ_API_KEY=your_key
# ... etc
```

### Verifying Deployment

Check function status:

```bash
supabase functions list
```

Test a function:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

---

## Trigger.dev V4 Deployment

### 1. Deploy Tasks

From the `trigger/` directory:

```bash
cd trigger
npx trigger.dev deploy
```

### 2. Environment Variable Sync

The `trigger.config.ts` file automatically syncs environment variables from your `.env` file. Ensure all backend variables are set in your local `.env` before deploying.

### 3. Configure Allowed Origins

In **Trigger.dev Dashboard → Project Settings → Allowed Origins**, add:

```
https://<your-vercel-app>.vercel.app
https://<your-custom-domain>
```

### 4. Scheduled Tasks

Scheduled tasks are configured in:
- `trigger/tasks/scheduled/daily-knowledge-graph.ts` (2 AM UTC)
- `trigger/tasks/scheduled/daily-final-packs.ts` (3 AM UTC)

Verify schedules in Trigger.dev Dashboard → Schedules.

### 5. Testing Tasks

Test a task manually:

```bash
npx trigger.dev run precompute-final-packs --payload '{"courseId": "your-course-id"}'
```

---

## Production Testing Checklist

### Auth Testing

- [ ] Email signup works
- [ ] Email confirmation redirects to root (not `/auth/callback`)
- [ ] Google OAuth works
- [ ] Magic link works
- [ ] Session persists across page reloads
- [ ] Cross-tab auth works (open in multiple tabs)
- [ ] Logout works correctly
- [ ] Protected routes redirect to login when unauthenticated

### Asset Loading

- [ ] Assets load on root route (`/`)
- [ ] Assets load on subroutes (`/course/123`, `/dashboard`)
- [ ] Assets load on Safari iOS
- [ ] Assets load on preview deployments
- [ ] No 404s for CSS/JS files
- [ ] Images load correctly

### Edge Functions

- [ ] All functions deploy successfully
- [ ] Functions can access database (RLS works)
- [ ] Functions can use PostgREST
- [ ] Functions can use GraphQL endpoints
- [ ] Secrets are properly set
- [ ] Rate limiting works
- [ ] Error handling returns proper responses

### Trigger.dev

- [ ] Tasks deploy successfully
- [ ] Scheduled tasks run on schedule
- [ ] Environment variables sync correctly
- [ ] Tasks can access Supabase
- [ ] Tasks can access LLM APIs
- [ ] Task logs are visible in dashboard

### Core Features

- [ ] Document upload works
- [ ] Document ingestion completes
- [ ] RAG chat works with citations
- [ ] Practice questions load
- [ ] Exam simulation works
- [ ] Compression notes generate
- [ ] Knowledge graph generates
- [ ] Final packs generate

---

## Troubleshooting

### Auth Issues

**Problem:** Login redirects fail or session is undefined

**Solutions:**
1. Verify redirect URLs in Supabase Dashboard (must include production domain)
2. Ensure no `/auth/callback` paths in redirect URLs
3. Check browser console for errors
4. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly

**Problem:** Google OAuth doesn't work

**Solutions:**
1. Verify Google OAuth credentials in Supabase Dashboard
2. Check authorized redirect URI in Google Console matches Supabase callback URL
3. Ensure Google provider is enabled in Supabase

### Asset Loading Issues

**Problem:** 404 errors for CSS/JS files on subroutes

**Solutions:**
1. Verify `base: "./"` is set in `vite.config.ts`
2. Check `vercel.json` has SPA rewrite rule
3. Ensure `outDir: "dist"` matches Vercel output directory
4. Clear browser cache and rebuild

**Problem:** Assets load in dev but not in production

**Solutions:**
1. Check Vercel build logs for errors
2. Verify all environment variables are scoped correctly
3. Ensure build completes successfully

### Edge Function Issues

**Problem:** Functions return 401 Unauthorized

**Solutions:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set as secret
2. Check function is using correct Supabase client initialization
3. Ensure RLS policies allow function access

**Problem:** Functions can't access database

**Solutions:**
1. Verify `SUPABASE_PROJECT_ID`, `SUPABASE_GRAPHQL_URL`, `SUPABASE_DB_PASSWORD` are set
2. Check database connection in Supabase Dashboard
3. Verify RLS policies are configured correctly

### Trigger.dev Issues

**Problem:** Tasks fail with missing environment variables

**Solutions:**
1. Verify `trigger.config.ts` syncs all required variables
2. Check Trigger.dev Dashboard → Environment Variables
3. Ensure variables are set in local `.env` before deploying

**Problem:** Scheduled tasks don't run

**Solutions:**
1. Verify schedule configuration in task files
2. Check Trigger.dev Dashboard → Schedules
3. Ensure timezone is set correctly (UTC by default)

### Build Issues

**Problem:** Vercel build fails

**Solutions:**
1. Check build logs in Vercel Dashboard
2. Verify Node version is 20.x
3. Ensure all dependencies are in `package.json`
4. Check for TypeScript errors locally before pushing

**Problem:** Build succeeds but app doesn't load

**Solutions:**
1. Verify `vercel.json` configuration
2. Check browser console for errors
3. Verify environment variables are set and scoped correctly
4. Test locally with `npm run build && npm run preview`

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Trigger.dev V4 Documentation](https://trigger.dev/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)

---

## Support

If you encounter issues not covered in this guide:

1. Check Vercel build logs
2. Check Supabase function logs
3. Check Trigger.dev task logs
4. Review browser console for frontend errors
5. Verify all environment variables are set correctly

---

**Last Updated:** November 2025


