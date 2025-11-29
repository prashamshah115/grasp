# Full-Stack Verification Log

This document tracks the execution of the Full-Stack Verification Plan, including evidence, discrepancies, and follow-up actions for each phase.

## 1. Architecture & Config Alignment

- Verified deployment guide, env reference, and `vercel.json` to ensure SPA rewrites and `dist/` output match production guidance (`README_DEPLOY.md`, `ENV_VARIABLES.md`, `vercel.json`).
- Confirmed `vite.config.ts` uses `base: './'` and `build.outDir = 'dist'`, aligning with Vercel requirements for deep links.
- Reviewed `supabase/config.toml` to ensure local ports and auth redirect domains cover `localhost:3000/5173`; noted `site_url` is `http://127.0.0.1:3000` which is consistent with dev server but requires matching Supabase dashboard URLs for auth.
- Reviewed `trigger/trigger.config.ts` to ensure env sync covers Supabase + LLM keys; missing optional `TRIGGER_API_URL`/`TRIGGER_SECRET_KEY` values are flagged via console warnings, so production secrets still need to be injected via dashboard/CLI.

## 2. Backend Function & Database Coverage

- **Edge function inventory:**  
  - _Auth / Chat / RAG:_ `rag-chat`, `search-web`, `get-relevant-content`.  
  - _Practice / Mastery:_ `next-global-question`, `update-question-history`, `update-mastery`.  
  - _Exam flow:_ `start-exam-session`, `submit-exam`, supporting tests under `supabase/functions/tests`.  
  - _Finals / Knowledge graph:_ `trigger-final-packs`, `trigger-knowledge-graph`, `generate-compression`.  
  - _Ingestion:_ `ingest-document`, `trigger-ingest`, `batch-ingest-storage`, `batch-reingest-documents`, `test-ingest`, `health-check`.  
  - _Analytics:_ `analyze-graded-assignment`.
- **Table mapping highlights:**  
  - Functions consistently rely on domain tables such as `courses`, `topics`, `questions`, `exam_sessions`, `exam_answers`, `topic_mastery`, `study_sessions`, `question_attempts`, `compression_notes`, `knowledge_objects`, `documents`, `chat_threads`, `chat_messages`, `chat_rag_contexts`, `llm_usage`, `graded_assignments`, and `graded_assignment_analysis`.  
  - Only a subset of these tables appears anywhere inside `supabase/migrations/` (mostly RLS/policy adjustments for `courses`, `documents`, `exam_sessions`, `exam_answers`, `chat_*`, and `rate_limit_usage`). There is **no version-controlled DDL** for the core tables referenced by every function, meaning a fresh `supabase db push` cannot recreate the production schema.  
  - Tables such as `topic_mastery`, `study_sessions`, `question_attempts`, `question_history`, `compression_notes`, `llm_usage`, `graded_assignments`, and `graded_assignment_analysis` have no migrations or RLS definitions checked into the repo, yet they are queried/updated across multiple functions (`supabase/functions/next-global-question/index.ts`, `update-mastery/index.ts`, `analyze-graded-assignment/index.ts`, etc.).  
  - The Supabase type definitions (`src/types/database.ts`) include these tables, confirming they exist in the remote project but are **not reproducible locally** from the repo.
- **RLS / policy coverage:**  
  - Exam-related RLS is codified (`20251126000000_add_exam_rls.sql`) and event log policies live in `20250127000000_exam_event_log.sql`.  
  - Courses/documents have policies (`20250125000000` / `0001`).  
  - Chat assistant tables have explicit policies (`20251125000000_chat_assistant.sql`).  
  - No checked-in policies exist for `topic_mastery`, `study_sessions`, `question_attempts`, `question_history`, `compression_notes`, `llm_usage`, or `graded_assignment_*` tables, so least-privilege guarantees for those domains cannot be audited or redeployed.
- **Data completeness:**  
  - `supabase/seed/01_sample_course_data.sql` only seeds Topic 1 questions; the remaining 60 questions are left as a TODO comment, so a fresh seed does not reproduce the “75 question” data set described in the README.  
  - `final.json` and `midterm.json` contain rich CSE120 exam definitions, but no ingestion script connects them to the Supabase schema—final pack generation relies on existing Supabase data or Trigger.dev ingestion.  
  - Conclusion: CSE120 coverage depends on manual Supabase state rather than repository-controlled migrations/seeds, blocking deterministic deployments.

## 3. Frontend → Backend Contract Audit

- **Routing + props mismatches:**  
  - `src/router.tsx` mounts `<FinalPackView />` without the required `courseId`, `courseCode`, and `onStartPractice` props defined in `src/components/finals/FinalPackView.tsx`. The component is only usable via `FinalsSection`, so the standalone route is dead code that currently throws a TS error and would render `undefined` props if forced.  
  - `ExamDefinition` (`src/components/ExamDefinition.tsx`) auto-starts exams on mount and never surfaces instructions, duplicating the logic that already exists in `/exam/:examId/start` (`ExamSessionStarter`). Users hitting `/exam/:examId` will be yanked into an exam session without explicit consent, and error handling simply bounces them back to the course view.
- **Hooks referencing non-versioned RPCs/tables:**  
  - Finals hooks (`useFinalsDashboard`, `useMustSolveTopics`, `useFinalPacks`, `useRecentTasks`, etc.) call RPCs/tables such as `get_finals_dashboard`, `final_packs`, `user_final_preferences`, and `user_task_history`, none of which have DDL/RPC definitions in `supabase/migrations/`. These hooks will fail in any environment bootstrapped from the repo.  
  - Practice/exam hooks rely on `study_sessions`, `question_attempts`, `topic_mastery`, `question_history`, `compression_notes`, and `knowledge_objects`, mirroring the missing schema gaps called out in §2, so the frontend ↔ backend contract cannot be honored outside the original Supabase project.
- **Edge-function expectations vs. frontend state:**  
  - Finals UI exposes a “Generate Study Materials” action that calls the `trigger-final-packs` edge function, which expects `TRIGGER_API_URL` + `TRIGGER_SECRET_KEY`. These vars are **not documented** in `ENV_VARIABLES.md`, so frontend-triggered jobs will fail in any new deployment.  
  - Hooks assume `final_packs` rows already exist and refetch after triggering generation, but there is no polling/state for the Trigger.dev run status, so users receive no feedback if the backend job fails.
- **General observation:** Many React Query hooks optimistically invalidate caches, but there is no error-surface path tied to Supabase error codes (e.g., enrollment missing). Exam flows log errors to console and hard-redirect, providing no user-level messaging beyond console output.

## 4. Trigger.dev & Ingestion Pipeline Validation

- **Task coverage:** Reviewed Trigger.dev tasks under `trigger/tasks/` and confirmed multi-stage ingestion (`ingest-document → generate-embeddings → finalize-document`), RAG cache maintenance, finals pack generation (`precompute-final-packs` + scheduled variants), and knowledge-graph workflows exist. Python dependencies for PDF parsing/embeddings are captured in `trigger/requirements.txt`.
- **Environment propagation gaps:**  
  - `trigger/trigger.config.ts` only syncs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and LLM keys from `.env`. It does **not** push `TRIGGER_API_URL` or `TRIGGER_SECRET_KEY`, yet multiple edge functions (`supabase/functions/trigger-final-packs/index.ts`, `trigger-ingest`, etc.) require them. Those secrets must be set manually in Supabase, but there is no documentation in `ENV_VARIABLES.md` describing them.  
  - Tasks assume Supabase tables (`documents`, `document_pages`, `knowledge_objects`, `final_packs`, etc.) already exist with specific columns; as noted earlier, none of that DDL is versioned, so Trigger workers cannot be run against a freshly provisioned project.
- **Operational blind spots:**  
  - There is no status propagation back to the frontend when Trigger tasks run. For example, triggering finals packs from the UI just fires the edge function and waits five seconds before refetching—no polling of Trigger.dev run state or error handling.  
  - Failures inside Trigger tasks rely on console logs; there is no automated alerting or retry orchestration outside the built-in retry counts.  
  - Scheduled tasks (`trigger/tasks/scheduled/*`) depend on Trigger.dev deployment to the “proj_gvongxitjrhgfakcmidx” project, but there is no checklist/script ensuring schedules are attached during deployment.

## 5. Automated Test Battery

- **Backend unit tests (Deno):**  
  - `tests/backend/unit/shared/errors.test.ts` ✅ (deno 2.5.6) — validates shared error helpers. Command: `deno test tests/backend/unit/shared/errors.test.ts --allow-net --allow-env --allow-read --no-check`.  
- **Security/input validation suite:**  
  - `tests/backend/security/input-validation.test.ts` ❌ — all cases fail immediately because the tests call `createTestUser()` without importing/defining it (`tests/backend/security/input-validation.test.ts` lines 11, 34, 57, etc.). Only `getSharedTestUser` is imported from `tests/backend/security/utils/helpers.ts`, so the suite cannot run even before hitting Supabase APIs. Additionally, runtime warnings note `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are unset in this environment, so even after fixing the helper issue, these tests will still lack credentials.
- **Script issues:** `scripts/run-all-backend-tests.sh` still passes `--env NAME=value` flags to `deno test`, which Deno interprets as module specifiers (the script previously failed with `Import '...VITE_SUPABASE_URL=...' failed`). Tests must be run manually until the script is corrected.
- **Playwright UI suites:** Pending (blocked until backend/security tests are stabilized and the app can be run with valid Supabase credentials).

## 6. Manual E2E Verification

- _Pending entry._

## 7. Consolidated Findings & Fix Plan

- _Pending entry._

## 8. Remediation & Testing Roadmap

- _Pending entry._

## 9. Sign-off Checklist

- _Pending entry._

