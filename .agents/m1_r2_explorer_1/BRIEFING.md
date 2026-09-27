# BRIEFING — 2026-09-22T18:27:13Z

## Mission
Design drop-in SQL fixes for supabase/migrations/20260922000002_rls_policies.sql to eliminate the universal RLS leak on public.projects and prevent unauthorized profile tier escalation on public.profiles.

## 🔒 My Identity
- Archetype: explorer
- Roles: Security & RLS Explorer (Iteration 2)
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_1
- Original parent: 48f954c7-ebf6-4748-95d0-1158ee50e1cd
- Milestone: M1 (Iteration 2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in source files
- Deliver report to /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_1/handoff.md
- Notify parent via send_message (Recipient: 48f954c7-ebf6-4748-95d0-1158ee50e1cd)
- All proposed SQL changes must be precise drop-in fixes, machine-applicable or copy-paste ready
- Ensure compatibility with Supabase RLS, security definer best practices, and foundation unit tests

## Current Parent
- Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd
- Updated: 2026-09-22T18:36:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` (R1-R5 requirements)
  - `PROJECT.md` (Architecture, table contracts, API contracts)
  - `.agents/m1_reviewer_2/handoff.md` (Reviewer 2 findings on RLS leak, tier escalation, trigger traps)
  - `.agents/m1_challenger_2/handoff.md` (Challenger 2 adversarial findings, mock harness flaws)
  - `supabase/migrations/20260922000001_initial_schema.sql` (Triggers, views, tables)
  - `supabase/migrations/20260922000002_rls_policies.sql` (RLS policies)
  - `tests/unit/foundation.test.ts` & `tests/unit/database-stress.test.ts` (Test assertions)
  - Live PostgreSQL 16 container (`postgres:16-alpine`) stress tests
- **Key findings**:
  - `public.projects` RLS policy `USING (true)` for `anon, authenticated` leaked all projects and HMAC `webhook_secret`. Dropping this policy and adding `get_project_public_info(p_slug)` eliminates the leak and restores multi-tenant isolation.
  - `public.profiles` UPDATE policy permitted Free users to escalate to Pro. Adding `protect_profile_tier` trigger (without SECURITY DEFINER so caller role is preserved) blocks unauthorized tier and billing updates.
  - `sync_changelog_fields` and `sync_pull_request_fields` trapped state because they did not check `TG_OP = 'UPDATE'` or compare against `OLD` values. Fixed via delta comparisons (`IS DISTINCT FROM`).
  - `public.users` view lacked `WITH (security_invoker = true)`.
  - `handle_new_user()` lacked `SET search_path = public, pg_temp;`.
  - In `lib/supabase/admin.ts`, `import 'server-only'` is required.
  - In `tests/mocks/mock-supabase.ts`, `.select()` chaining, `.upsert()` conflict key, and cardinality checks need alignment.
- **Unexplored areas**: None for M1 RLS / schema scope.

## Key Decisions Made
- Dropped `Public read project info by slug` policy completely; no direct SELECT on `public.projects` for `anon`.
- Added security definer RPC `get_project_public_info(p_slug)` returning strictly 5 non-sensitive columns (`id`, `name`, `slug`, `is_pro_override`, `custom_domain`).
- Server routes (`/c/[slug]` and `/api/v1/widget/[slug]`) access project metadata via `createAdminClient()`, selecting only safe public fields.
- Implemented `protect_profile_tier` as a regular (security invoker) trigger function checking `request.jwt.claim.role` and `current_user NOT IN ('postgres', 'supabase_admin', 'service_role')`.
- Fully tested all fixes in a live PostgreSQL 16 Docker container across 9 test cases — all 9 passed.

## Artifact Index
- DISPATCH.md — Initial dispatch and invocation instructions
- BRIEFING.md — Working memory and status
- progress.md — Liveness heartbeat
- proposed_20260922000001_initial_schema.sql — Proposed full initial schema with trigger fixes
- proposed_20260922000002_rls_policies.sql — Proposed full RLS policies with anti-escalation trigger and RPC
- initial_schema.patch — Unified diff patch for initial schema
- rls_policies.patch — Unified diff patch for RLS policies
- test_pg_verification.sql — Postgres container test harness
- test_empirical_verification.sql — 9-scenario empirical stress test script
- handoff.md — Final deliverable report

