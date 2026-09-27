# Operational Plan — Project Orchestrator (Generation 2)

## Goal
Drive ShipLog to 100% completion across all milestones with full test verification and audit passes.

## Milestones & Execution Steps

### Step 1: Milestone 1 Iteration 2 Remediation & Gate
1. Dispatch `m1_worker_2` to apply:
   - Schema & RLS fixes from `.agents/m1_r2_explorer_1/proposed_20260922000001_initial_schema.sql` and `proposed_20260922000002_rls_policies.sql`
   - Mock Supabase fix from `.agents/m1_r2_explorer_3/proposed_mock-supabase.ts`
   - Toast component export from `.agents/m1_r2_explorer_3/proposed_toast.tsx.patch`
   - Test suite updates from `.agents/m1_r2_explorer_3/proposed_database-stress.test.ts.patch`
   - Run verification commands: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
2. Dispatch 2 Reviewers, 2 Challengers, and 1 Forensic Auditor for Milestone 1 Iteration 2 Gate.
3. Record `GATE_STATUS.md`. On PASS, mark M1 DONE in `PROJECT.md` and `progress.md`.

### Step 2: Milestone 2 — E2E Testing Track Infrastructure
1. Dispatch E2E Testing workers/explorers to create `TEST_INFRA.md`, test harness, 4-tier test cases (Tiers 1-4), and publish `TEST_READY.md`.
2. Conduct M2 Gate review and mark M2 DONE.

### Step 3: Milestone 3 — GitHub Ingestion & Structured AI Pipeline
1. Dispatch implementation for GitHub webhook receiver (`/api/webhooks/github`), regex noise filter, unreleased PR queue, Gemini 1.5 Flash structured synthesis with hybrid mock mode, and local webhook dispatcher CLI.
2. Verify via Reviewers, Challengers, and Auditor. Mark M3 DONE.

### Step 4: Milestone 4 — SaaS Dashboard & Public SSR Changelog Portal
1. Dispatch implementation for founder dashboard (repo connect, PR queue, markdown editor, publish workflow, syndication drawers) and SSR public changelog (`/c/[slug]` with dynamic OG tags).
2. Verify via Reviewers, Challengers, and Auditor. Mark M4 DONE.

### Step 5: Milestone 5 — Standalone Embeddable In-App Widget (< 5 KB)
1. Dispatch implementation for vanilla TypeScript widget, Shadow DOM isolation, localStorage unread indicator, slide-out drawer, viral badge logic, `/api/v1/widget/[slug]` CORS endpoint, and `npm run check:widget-size`.
2. Verify via Reviewers, Challengers, and Auditor. Mark M5 DONE.

### Step 6: Milestone 6 — Dodo Payments Monetization & Feature Gating
1. Dispatch implementation for Dodo checkout, webhook receiver, signature verification, tier enforcement, and portal branding toggle.
2. Verify via Reviewers, Challengers, and Auditor. Mark M6 DONE.

### Step 7: Milestone 7 — Final 100% E2E Pass & Hardening
1. Execute full verification suite: `npm test`, `npm run test:simulate`, `npm run check:widget-size`, `npm run build`.
2. Adversarial Tier 5 coverage hardening.
3. Verify complete compliance with `ORIGINAL_REQUEST.md`.

### Step 8: Final Report to Sentinel
Deliver comprehensive completion report to Sentinel (`bb8f19a5-6d70-4a2c-9f24-4b0d91866e9a`).
