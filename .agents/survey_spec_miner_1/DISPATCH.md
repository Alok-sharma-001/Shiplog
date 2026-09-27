# Survey Spec Miner Dispatch

## Identity
- Role: Specification Miner
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Objective
Thoroughly examine /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md and the workspace environment.
Enumerate all detailed specifications, constraints, API requirements, and acceptance criteria for:
1. R1: GitHub App webhook receiver (`pull_request.closed`, merged status, release/tag triggers), unreleased queue, regex noise filtering (`^(chore|ci|test|style|refactor)(\(.*\))?:`, `[skip]`, `[internal]`, `[no-log]`), Gemini 1.5 Flash structured JSON transformation schema (`release_title`, `overview_summary`, `categories` with `features`, `improvements`, `fixes`, `distribution` with `email_plain_text`, `social_post_thread`), hybrid mode (live vs deterministic mock fixtures & local webhook dispatcher).
2. R2: Next.js 15 App Router, Tailwind CSS, shadcn/ui, Supabase schema & migrations with RLS (`users`, `installations`, `projects`, `changelogs`), Founder dashboard (repo connection, queue, release trigger, inline markdown editor), one-click publish & syndication copy actions, SSR `/c/[slug]` with dynamic OG tags.
3. R3: Standalone Embeddable In-App Widget (< 5 KB minified/gzipped via Vite/esbuild), Shadow DOM style isolation, unread bell indicator backed by localStorage, slide-out drawer, viral badge logic (Free tier "Powered by ShipLog" vs Pro suppressed), `/api/v1/widget/[slug]` edge-cacheable endpoint with CORS.
4. R4: Dodo Payments $15/mo Pro plan checkout flow, webhook lifecycle (`subscription.created`, `subscription.updated`, `subscription.cancelled`), signature verification with `x-mock-signature` bypass, feature gating (Free: 1 repo, 2 releases/mo, ShipLog badge; Pro: unlimited repos/releases, white-labeled widget, custom domain).
5. R5: Verification suite (`npm test`, `npm run test:simulate`, `npm run check:widget-size`, `npm run build`).

## Scope Boundaries
- Read-only exploration and analysis. DO NOT write or edit production source code.
- Write your findings to /home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1/handoff.md.

## Completion Criteria
Deliver a structured handoff.md with verified evidence chains and full feature specifications, and notify parent via send_message.

## 2026-09-22T17:18:05Z
You are Survey Spec Miner 1 for ShipLog.
Your working directory is: /home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1
You MUST read:
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1/DISPATCH.md

Your mission:
Extract and document all exhaustive specifications, constraints, API payloads, schemas, and acceptance criteria across R1, R2, R3, R4, and R5.
Check the environment (Node, npm, system tools) as needed.
Write your complete report to /home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1/handoff.md.
When finished, send a message to your caller (parent) with a concise summary and path to your handoff report.
Do NOT write or modify application source code.
