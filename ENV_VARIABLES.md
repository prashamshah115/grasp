# GRASP Environment Variables Reference

This document lists all required environment variables for GRASP deployment.

## Frontend Variables (VITE_* prefix required)

These are exposed to the browser and **MUST** start with `VITE_`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Backend Variables (Server-side only)

These are **NOT** exposed to the browser (no `VITE_` prefix):

```bash
# Supabase Backend Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Supabase Advanced Configuration (Required for RLS, GraphQL, Vault)
SUPABASE_PROJECT_ID=your_supabase_project_id
SUPABASE_GRAPHQL_URL=https://your-project.supabase.co/graphql/v1
SUPABASE_DB_PASSWORD=your_database_password

# LLM / API Provider Keys
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
JINA_API_KEY=your_jina_api_key
TAVILY_API_KEY=your_tavily_api_key
```

## Trigger.dev Variables

These are synced automatically via `trigger.config.ts`. Only set manually if needed for local development:

```bash
# TRIGGER_API_KEY=your_trigger_api_key
# TRIGGER_SECRET_KEY=your_trigger_secret_key
```

## Where to Set Variables

### Local Development
Create a `.env` file in the project root with all variables.

### Vercel
1. Go to Project Settings → Environment Variables
2. Add each variable
3. **IMPORTANT:** Scope to Development, Preview, and Production

### Supabase Edge Functions
Set via CLI:
```bash
supabase secrets set --env-file ./supabase/.env
```

Or create `supabase/.env` with backend variables only.

## Getting Supabase Values

1. **SUPABASE_URL:** Supabase Dashboard → Settings → API → Project URL
2. **SUPABASE_ANON_KEY:** Supabase Dashboard → Settings → API → anon public key
3. **SUPABASE_SERVICE_ROLE_KEY:** Supabase Dashboard → Settings → API → service_role secret key
4. **SUPABASE_JWT_SECRET:** Supabase Dashboard → Settings → API → JWT Secret
5. **SUPABASE_PROJECT_ID:** Supabase Dashboard → Settings → General → Reference ID
6. **SUPABASE_GRAPHQL_URL:** `https://<project-ref>.supabase.co/graphql/v1`
7. **SUPABASE_DB_PASSWORD:** Set during project creation (or reset in Database settings)

## Notes

- Frontend variables (VITE_*) are bundled into the client code
- Backend variables are only available server-side
- In Vercel, you must scope variables to Development/Preview/Production
- Supabase Edge Functions need all backend variables
- Trigger.dev tasks need all backend variables synced via trigger.config.ts


