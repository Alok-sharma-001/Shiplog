# Original User Request

## Initial Request — 2026-09-22T17:15:05Z

ShipLog is an automated developer-first release & retention SaaS engine that ingests merged GitHub Pull Requests via read-only webhooks, filters noise, synthesizes user-facing release notes and social drafts using Google Gemini 1.5 Flash structured JSON, and distributes updates via an ultra-lightweight (<5 KB) embeddable Shadow DOM widget and hosted SSR changelog portals.

Working directory: /home/alok/Projects_Antigravity/bsAK
Integrity mode: development

## Requirements

### R1. GitHub Ingestion & Structured AI Pipeline

* Implement a GitHub App webhook receiver handling `pull_request.closed` (merged status) and release/tag triggers.
* Ingest PR metadata (title, body, labels, author) into a project-level unreleased accumulation queue.
* Implement regex noise filtering to strip internal conventions (`^(chore|ci|test|style|refactor)(\(.*\))?:`) and exclusion markers (`[skip]`, `[internal]`, `[no-log]`).
* Implement the Gemini 1.5 Flash transformation engine with strict JSON schema enforcement producing categorized releases (`features`, `improvements`, `fixes`) and multi-channel syndication drafts (`email_plain_text`, `social_post_thread`).
* Support a hybrid execution mode: execute live against Google Gemini API and GitHub APIs when environment keys are provided, while providing deterministic mock fixtures and a local webhook dispatcher script for offline execution and automated CI.

### R2. SaaS Dashboard & Public SSR Changelog Portal

* Build a Next.js 15 (App Router) application with Tailwind CSS and modern UI primitives (shadcn/ui).
* Supabase PostgreSQL schema and auth integration covering `users`, `installations`, `projects`, and `changelogs` with Row-Level Security (RLS) configured via clear SQL migration files in `supabase/migrations/`.
* Project management dashboard allowing founders to connect repositories, view the unreleased queue, trigger release generation, and use an inline markdown editor to review or edit drafts.
* One-click publishing workflow updating public views and providing one-click copy actions for Email and X (Twitter) thread syndication.
* High-performance Server-Side Rendered (SSR) public changelog at `/c/[slug]` with dynamic OpenGraph meta tags, version timeline, category badges, and sub-second loading.

### R3. Standalone Embeddable In-App Widget (< 5 KB)

* Develop an ultra-lightweight client script compiled via Vite or esbuild into a single zero-dependency asset served at `/public/widget.js` (< 5 KB minified/gzipped).
* Implement style isolation using a scoped Shadow DOM with inlined CSS styles to guarantee zero CSS collisions with host SaaS applications.
* Provide a notification bell launcher with an unread dot indicator backed by browser `localStorage`.
* Display a responsive slide-out drawer rendering recent published releases with category tags and release dates.
* Display a viral "Powered by ShipLog" badge for Free-tier projects, automatically suppressed for Pro-tier workspaces.
* Serve updates through an edge-cacheable public endpoint (`/api/v1/widget/[slug]`) with CORS headers (`Access-Control-Allow-Origin: *`).

### R4. Monetization & Subscription Infrastructure

* Integrate Dodo Payments (Merchant of Record) subscription checkout flow for the $15/month Pro plan.
* Implement webhook endpoints handling subscription lifecycle events (`subscription.created`, `subscription.updated`, `subscription.cancelled`) with idempotent processing.
* Provide signature verification with a development bypass toggle (`x-mock-signature`) for automated offline testing.
* Enforce feature gating: Free tier (1 repo, 2 releases/month, ShipLog badge) vs. Pro tier (unlimited repos/releases, white-labeled widget, custom domain support).

### R5. Comprehensive Verification Suite & Tooling

* Complete automated test suite covering regex noise filters, JSON schema validation, API route handling, and webhook processing.
* End-to-end pipeline simulation CLI script (`npm run test:simulate`) verifying: simulated PR merge webhook -> unreleased queue -> AI draft generation -> release publication -> widget API availability.
* Automated bundle size verification step asserting `widget.js` stays under 5 KB (`npm run check:widget-size`).

## Acceptance Criteria

### Automated Testing & Code Quality

* [ ] `npm test` executes cleanly and passes all unit, integration, and schema validation test suites without failure.
* [ ] Noise filter regex tests prove exclusion of `chore:`, `ci:`, `test:`, `style:`, `refactor:` prefixes and `[skip]`, `[internal]`, `[no-log]` flags, while preserving feature, improvement, and bug fix items.
* [ ] AI output validation tests guarantee strict conformance to the JSON schema (`release_title`, `overview_summary`, `categories` with `features`, `improvements`, `fixes`, and `distribution` with `email_plain_text`, `social_post_thread`).
* [ ] Next.js production build (`npm run build`) succeeds with zero TypeScript errors and zero lint failures.

### Pipeline & API Verification

* [ ] An automated E2E simulation script (`npm run test:simulate`) passes end-to-end: dispatches a mock PR merge event, verifies queue insertion, synthesizes release notes, triggers publish, and asserts that the public widget API (`/api/v1/widget/[slug]`) and hosted page render the new release.
* [ ] Public widget API endpoint `/api/v1/widget/[slug]` returns valid JSON with proper CORS headers and HTTP caching headers.
* [ ] Dodo Payments webhook handler safely verifies signatures, idempotently updates user subscription tiers, and activates pro features upon payment confirmation.

### Widget Verification

* [ ] Bundled `widget.js` size is objectively verified to be under 5 KB minified via an automated build size check script (`npm run check:widget-size`).
* [ ] Widget renders using Shadow DOM, ensuring total CSS isolation from host web pages.
* [ ] Bell unread indicator accurately updates and clears unread status using `localStorage`.
* [ ] Viral badge "Powered by ShipLog" displays on Free-tier project data and is absent when `is_pro` / white-labeling is active.

### Public SSR Changelog Portal

* [ ] Accessing `/c/[slug]` renders server-side HTML containing release titles, category badges, markdown body, and OpenGraph meta tags (`og:title`, `og:description`, `og:image`).

## Follow-up — 2026-09-23T07:55:40Z

A server restart occurred and tasks were temporarily paused. The user has requested to continue execution (/teamwork-preview continue).

Please resume the Sentinel monitoring loop, inspect `.agents/orchestrator_1/handoff.md`, spawn the successor orchestrator (Generation 2) to dispatch `m1_worker_2` with the prepared patches, and drive the execution of ShipLog through Milestones 1 to 7 and victory audit to completion.
