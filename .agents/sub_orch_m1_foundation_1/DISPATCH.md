# Milestone 1 Sub-Orchestrator Dispatch

## Identity
- Role: Milestone 1 Sub-Orchestrator (Foundation, Schema & UI Primitives)
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/sub_orch_m1_foundation_1
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Mandatory Reading
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/survey_arch_explorer_2/handoff.md
4. /home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1_gen2/handoff.md

## Mission & Scope
You are the Sub-Orchestrator for Milestone 1 (M1).
Your mission is to build the core foundation, data models, and UI primitives for ShipLog:
1. Initialize the Next.js 15 App Router project structure with TypeScript, Tailwind CSS, and shadcn/ui components (`button.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `tabs.tsx`, `textarea.tsx`, `input.tsx`, `toast.tsx`, `separator.tsx`, etc.).
2. Implement Supabase PostgreSQL SQL migrations in `supabase/migrations/`:
   - `20260922000001_initial_schema.sql` (profiles/users, installations, projects, changelogs, pull_requests, dodo_webhook_events tables, indexes, triggers).
   - `20260922000002_rls_policies.sql` (Row-Level Security policies for multi-tenancy and public read).
3. Set up Supabase clients in `lib/supabase/` (`client.ts`, `server.ts`, `admin.ts`, `types.ts`) and common utility `lib/utils.ts`.
4. Configure Vitest test runner (`vitest.config.ts`), `tsconfig.json`, and base `package.json` dependencies.
5. Verify clean build (`npm run typecheck`, initial test run).

## File Ownership
- `/home/alok/Projects_Antigravity/bsAK/package.json`
- `/home/alok/Projects_Antigravity/bsAK/tsconfig.json`
- `/home/alok/Projects_Antigravity/bsAK/tailwind.config.ts`
- `/home/alok/Projects_Antigravity/bsAK/postcss.config.mjs`
- `/home/alok/Projects_Antigravity/bsAK/vitest.config.ts`
- `/home/alok/Projects_Antigravity/bsAK/components.json`
- `/home/alok/Projects_Antigravity/bsAK/app/layout.tsx`
- `/home/alok/Projects_Antigravity/bsAK/app/globals.css`
- `/home/alok/Projects_Antigravity/bsAK/app/page.tsx`
- `/home/alok/Projects_Antigravity/bsAK/components/ui/`
- `/home/alok/Projects_Antigravity/bsAK/lib/supabase/`
- `/home/alok/Projects_Antigravity/bsAK/lib/utils.ts`
- `/home/alok/Projects_Antigravity/bsAK/supabase/migrations/`

## Execution Protocol
Follow the orchestrator procedure:
1. Create `SCOPE.md`, `BRIEFING.md`, and `progress.md` in your working directory.
2. Start your heartbeat cron.
3. Assess and run the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor).
   - Tell Worker its exclusive file ownership.
   - Include the mandatory integrity warning to Worker.
   - Run Reviewers, Challengers, and Forensic Auditor (`teamwork_preview_auditor`).
   - Audit is a binary veto. Gate must pass with ALL criteria before completion.
4. When M1 passes gate, update your `progress.md`, and report completion to parent via `send_message`.
