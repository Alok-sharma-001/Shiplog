# Handoff Report: ShipLog Comprehensive Technical Specification

**Agent**: `survey_spec_miner_1_gen2` (Survey Specification Miner 1 Gen 2)  
**Date**: 2026-09-22T17:26:00Z  
**Target Path**: `/home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1_gen2/handoff.md`  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  
**Milestone**: Phase 0 — Survey & Specification Mining  

---

## 1. Observation

Direct observations extracted from `/home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md`, `/home/alok/Projects_Antigravity/bsAK/.agents/survey_spec_miner_1_gen2/DISPATCH.md`, upstream documentation, and runtime environment:

1. **System Core Objective & Requirements (ORIGINAL_REQUEST.md:5-49)**:
   - *Core Identity*: "ShipLog is an automated developer-first release & retention SaaS engine that ingests merged GitHub Pull Requests via read-only webhooks, filters noise, synthesizes user-facing release notes and social drafts using Google Gemini 1.5 Flash structured JSON, and distributes updates via an ultra-lightweight (<5 KB) embeddable Shadow DOM widget and hosted SSR changelog portals." (Line 5)
   - *R1. GitHub Ingestion & Structured AI Pipeline*:
     - "Implement a GitHub App webhook receiver handling `pull_request.closed` (merged status) and release/tag triggers." (Line 14)
     - "Ingest PR metadata (title, body, labels, author) into a project-level unreleased accumulation queue." (Line 15)
     - "Implement regex noise filtering to strip internal conventions (`^(chore|ci|test|style|refactor)(\(.*\))?:`) and exclusion markers (`[skip]`, `[internal]`, `[no-log]`)." (Line 16)
     - "Implement the Gemini 1.5 Flash transformation engine with strict JSON schema enforcement producing categorized releases (`features`, `improvements`, `fixes`) and multi-channel syndication drafts (`email_plain_text`, `social_post_thread`)." (Line 17)
     - "Support a hybrid execution mode: execute live against Google Gemini API and GitHub APIs when environment keys are provided, while providing deterministic mock fixtures and a local webhook dispatcher script for offline execution and automated CI." (Line 18)
   - *R2. SaaS Dashboard & Public SSR Changelog Portal*:
     - "Build a Next.js 15 (App Router) application with Tailwind CSS and modern UI primitives (shadcn/ui)." (Line 22)
     - "Supabase PostgreSQL schema and auth integration covering `users`, `installations`, `projects`, and `changelogs` with Row-Level Security (RLS) configured via clear SQL migration files in `supabase/migrations/`." (Line 23)
     - "Project management dashboard allowing founders to connect repositories, view the unreleased queue, trigger release generation, and use an inline markdown editor to review or edit drafts." (Line 24)
     - "One-click publishing workflow updating public views and providing one-click copy actions for Email and X (Twitter) thread syndication." (Line 25)
     - "High-performance Server-Side Rendered (SSR) public changelog at `/c/[slug]` with dynamic OpenGraph meta tags, version timeline, category badges, and sub-second loading." (Line 26)
   - *R3. Standalone Embeddable In-App Widget (< 5 KB)*:
     - "Develop an ultra-lightweight client script compiled via Vite or esbuild into a single zero-dependency asset served at `/public/widget.js` (< 5 KB minified/gzipped)." (Line 30)
     - "Implement style isolation using a scoped Shadow DOM with inlined CSS styles to guarantee zero CSS collisions with host SaaS applications." (Line 31)
     - "Provide a notification bell launcher with an unread dot indicator backed by browser `localStorage`." (Line 32)
     - "Display a responsive slide-out drawer rendering recent published releases with category tags and release dates." (Line 33)
     - "Display a viral 'Powered by ShipLog' badge for Free-tier projects, automatically suppressed for Pro-tier workspaces." (Line 34)
     - "Serve updates through an edge-cacheable public endpoint (`/api/v1/widget/[slug]`) with CORS headers (`Access-Control-Allow-Origin: *`)." (Line 35)
   - *R4. Monetization & Subscription Infrastructure*:
     - "Integrate Dodo Payments (Merchant of Record) subscription checkout flow for the $15/month Pro plan." (Line 39)
     - "Implement webhook endpoints handling subscription lifecycle events (`subscription.created`, `subscription.updated`, `subscription.cancelled`) with idempotent processing." (Line 40)
     - "Provide signature verification with a development bypass toggle (`x-mock-signature`) for automated offline testing." (Line 41)
     - "Enforce feature gating: Free tier (1 repo, 2 releases/month, ShipLog badge) vs. Pro tier (unlimited repos/releases, white-labeled widget, custom domain support)." (Line 42)
   - *R5. Comprehensive Verification Suite & Tooling*:
     - "Complete automated test suite covering regex noise filters, JSON schema validation, API route handling, and webhook processing." (Line 46)
     - "End-to-end pipeline simulation CLI script (`npm run test:simulate`) verifying: simulated PR merge webhook -> unreleased queue -> AI draft generation -> release publication -> widget API availability." (Line 47)
     - "Automated bundle size verification step asserting `widget.js` stays under 5 KB (`npm run check:widget-size`)." (Line 48)

2. **Acceptance Criteria (ORIGINAL_REQUEST.md:52-75)**:
   - `npm test` executes cleanly and passes all unit, integration, and schema validation test suites without failure.
   - Noise filter regex tests prove exclusion of `chore:`, `ci:`, `test:`, `style:`, `refactor:` prefixes and `[skip]`, `[internal]`, `[no-log]` flags, while preserving feature, improvement, and bug fix items.
   - AI output validation tests guarantee strict conformance to the JSON schema (`release_title`, `overview_summary`, `categories` with `features`, `improvements`, `fixes`, and `distribution` with `email_plain_text`, `social_post_thread`).
   - Next.js production build (`npm run build`) succeeds with zero TypeScript errors and zero lint failures.
   - `npm run test:simulate` passes end-to-end: mock PR merge -> unreleased queue -> AI synthesis -> publish -> widget API `/api/v1/widget/[slug]` & SSR `/c/[slug]` render.
   - Public widget API `/api/v1/widget/[slug]` returns valid JSON with proper CORS headers (`Access-Control-Allow-Origin: *`) and HTTP caching headers (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`).
   - Dodo Payments webhook handler safely verifies signatures, idempotently updates user subscription tiers, and activates pro features upon payment confirmation.
   - Bundled `widget.js` size is objectively verified to be under 5 KB minified/gzipped via `npm run check:widget-size`.
   - Widget renders using Shadow DOM, ensuring total CSS isolation from host web pages.
   - Bell unread indicator accurately updates and clears unread status using `localStorage`.
   - Viral badge "Powered by ShipLog" displays on Free-tier project data and is absent when `is_pro` is active.
   - Accessing `/c/[slug]` renders server-side HTML containing release titles, category badges, markdown body, and OpenGraph meta tags (`og:title`, `og:description`, `og:image`).

3. **Runtime & Upstream Specifications Observed**:
   - Node.js runtime: `v22.22.1`, npm: `9.2.0`, Linux x86_64.
   - Official Gemini API SDK (`@google/genai`): Gemini 1.5 Flash accepts `responseMimeType: "application/json"` and `responseJsonSchema` or `responseSchema` for guaranteed deterministic structured output conforming to OpenAPI/JSON schema definitions.
   - Dodo Payments Webhook Specification: Standard Webhooks HMAC SHA256 verification using headers `webhook-id`, `webhook-signature`, `webhook-timestamp`. Payload structure encapsulates `{ type: string, data: { subscription_id, customer, status, metadata } }`. Development bypass toggle via `x-mock-signature` header.
   - GitHub Webhooks Specification: Standard HMAC SHA256 via `x-hub-signature-256`, payload includes `action`, `pull_request` (`merged`, `title`, `body`, `user`, `labels`, `merged_at`), `repository` (`full_name`, `owner`).

---

## 2. Logic Chain

From the observed requirements, we establish the following concrete deductions and architectural invariants:

1. **Webhook Ingestion & Noise Filtering Logic**:
   - Incoming GitHub webhooks arrive at `/api/webhooks/github`. Requests must have valid `x-hub-signature-256` matching `GITHUB_WEBHOOK_SECRET` (or `x-mock-signature: true` in development/test mode).
   - Only events where `action === 'closed'` AND `pull_request.merged === true` should be processed for PR accumulation. If `merged === false` (PR closed without merge), the webhook returns `200 OK` with `{ status: "ignored", reason: "pr_not_merged" }`.
   - Noise filter must check PR title against `NOISE_PREFIX_REGEX = /^(chore|ci|test|style|refactor)(\(.*\))?:/i` AND PR title/body against `EXCLUSION_MARKERS_REGEX = /\[(skip|internal|no-log)\]/i`.
   - If either matches, the item is tagged with `status: "filtered"` (or omitted from the active release generation pool), preventing internal maintenance noise from ever reaching end-user changelogs.
   - Conventional commit prefixes `feat:`, `feature:`, `fix:`, `perf:`, `docs:`, `improve:` and untagged descriptive titles are marked `status: "queued"`.

2. **Gemini 1.5 Flash Structured Transformation Logic**:
   - When the founder triggers `/api/projects/[id]/generate-release`, all unreleased PRs for the project (`status = 'queued'`) are gathered.
   - If `GEMINI_API_KEY` is present and valid, the system calls Google GenAI (`gemini-1.5-flash`) passing the PR titles, descriptions, authors, and labels formatted as markdown/bullet points.
   - Strict schema enforcement via `responseMimeType: "application/json"` and `responseSchema` guarantees the response adheres to:
     - `release_title` (string)
     - `overview_summary` (string)
     - `categories`: `{ features: string[], improvements: string[], fixes: string[] }`
     - `distribution`: `{ email_plain_text: string, social_post_thread: string[] }`
   - In hybrid/offline mode (when `GEMINI_API_KEY` is absent, set to `"mock"`, or during CI test suites), a deterministic mock synthesizer transforms the queued PRs into schema-compliant output without network latency or external API costs.
   - The resulting synthesis is saved to the `changelogs` table with `status: "draft"` and linked to the PRs.

3. **Supabase Schema & RLS Architecture**:
   - Multi-tenant architecture keyed on `users.id` (from Supabase Auth).
   - `projects` belong to `users` and have a unique URL `slug`.
   - `pull_requests` belong to `projects` and track unreleased changes.
   - `changelogs` store drafts and published releases with JSONB columns for `categories` and `distribution`.
   - RLS strictly ensures founders can only view and mutate their own projects and changelogs (`auth.uid() = user_id`).
   - Public read access is granted to `changelogs` where `status = 'published'` and basic project public metadata (`slug`, `name`, `is_pro`) to power `/c/[slug]` and `/api/v1/widget/[slug]`.

4. **Widget Isolation & Size Constraint Logic**:
   - The widget script at `/public/widget.js` must be compiled as an IIFE or custom element using Vite/esbuild with minification, tree-shaking, and zero external runtime dependencies (no React, no external CSS libraries).
   - Inlined styles inside a scoped Shadow DOM ensure that host page CSS resets (e.g. `* { margin: 0; box-sizing: border-box; }`, Tailwind preflights, Bootstrap) cannot alter widget appearance, launcher position, or drawer typography.
   - Size check: `scripts/check-widget-size.js` verifies that `widget.js` compressed with gzip is strictly `< 5120 bytes` (5 KB).
   - Unread state is tracked locally using `localStorage.getItem('shiplog_last_seen_' + slug)` compared against `releases[0].published_at`. Clicking the bell launcher opens the drawer and updates `localStorage`, dismissing the unread badge.
   - The "Powered by ShipLog" badge is conditionally rendered: if `project.is_pro === true`, the badge is omitted; if `false`, the badge is rendered with an anchor linking to ShipLog.

5. **Dodo Payments Monetization & Feature Gating Logic**:
   - Pro plan is priced at $15/month. Checkout sessions are created via `/api/billing/checkout`.
   - Dodo Payments webhooks (`subscription.created`, `subscription.updated`, `subscription.cancelled`) arrive at `/api/webhooks/dodo`.
   - Signatures are verified using HMAC SHA256 on raw body with `DODO_PAYMENTS_WEBHOOK_KEY`, with development bypass if `x-mock-signature: true` in non-production environments.
   - Idempotent processing ensures repeated deliveries of the same webhook event ID do not duplicate status changes or corrupt database states.
   - Gating rules:
     - Free Tier: `max_repos = 1`, `max_releases_per_month = 2`, `has_custom_domain = false`, `white_label_widget = false` (viral badge mandatory).
     - Pro Tier: `max_repos = unlimited`, `max_releases_per_month = unlimited`, `has_custom_domain = true`, `white_label_widget = true`.

---

## 3. Features Discovered

The following table documents all features discovered across the authoritative specifications (R1 through R5):

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Ingestion | GitHub Webhook Receiver | Ingests incoming GitHub App webhooks, validates HMAC SHA-256 signature, processes `pull_request.closed` and release/tag events | POST request to `/api/webhooks/github`, headers: `x-github-event`, `x-hub-signature-256`, raw JSON body | `{ received: true, status: "queued" \| "ignored" \| "filtered" }`, HTTP 200 | 401 Unauthorized on invalid signature; 400 Bad Request on malformed JSON | ORIGINAL_REQUEST.md:14 |
| 2 | R1: Ingestion | PR Merge Filter | Discriminates between closed-and-merged PRs vs closed-without-merge PRs | GitHub PR payload: `action === "closed"`, `pull_request.merged` (boolean) | If `merged === true`: process metadata; if `false`: ignore | HTTP 200 `{ status: "ignored", reason: "pr_not_merged" }` | ORIGINAL_REQUEST.md:14 |
| 3 | R1: Ingestion | PR Metadata Ingestion | Extracts PR number, title, markdown body, author login, labels, and merge timestamp into accumulation queue | GitHub PR object: `number`, `title`, `body`, `user.login`, `labels`, `merged_at` | Record inserted in `pull_requests` table with `status: 'queued'` | Unique constraint violation if PR already queued: idempotent HTTP 200 | ORIGINAL_REQUEST.md:15 |
| 4 | R1: Ingestion | Noise Prefix Filter | Strips internal PR prefixes (`chore:`, `ci:`, `test:`, `style:`, `refactor:`) using case-insensitive regex `^(chore\|ci\|test\|style\|refactor)(\(.*\))?:` | PR title string | Match: mark PR `status: 'filtered'`; No match: proceed to exclusion check | If title is empty/null: fallback to title placeholder or filtered | ORIGINAL_REQUEST.md:16 |
| 5 | R1: Ingestion | Exclusion Marker Filter | Excludes PRs containing explicit markers `[skip]`, `[internal]`, or `[no-log]` in title or body | PR title and body strings | Match: mark PR `status: 'filtered'`; No match: keep `status: 'queued'` | Case-insensitive token match; handles multiline body strings | ORIGINAL_REQUEST.md:16 |
| 6 | R1: Pipeline | Gemini 1.5 Flash Structured Synthesizer | Transforms queued PRs into user-facing categorized release notes and distribution drafts using Gemini 1.5 Flash with strict JSON schema | Array of queued PR metadata, project name, version tag | JSON object matching schema (`release_title`, `overview_summary`, `categories`, `distribution`) | 500 / 502 with fallback error if API rate limit or JSON schema failure | ORIGINAL_REQUEST.md:17 |
| 7 | R1: Pipeline | Release Categorization | Organizes merged changes into distinct buckets: `features` (new capabilities), `improvements` (optimizations/refinements), and `fixes` (bug repairs) | Synthesized release JSON | Categorized arrays of clean, customer-facing bullet point strings | Empty arrays `[]` when no PRs fit a category | ORIGINAL_REQUEST.md:17 |
| 8 | R1: Pipeline | Multi-Channel Syndication Generator | Generates ready-to-publish plain text announcement for email subscribers and a 3-5 part numbered Twitter/X thread (<280 chars per tweet) | Synthesized release JSON | `email_plain_text` (markdown string) and `social_post_thread` (array of strings) | Fallback formatting if content is empty | ORIGINAL_REQUEST.md:17 |
| 9 | R1: Pipeline | Hybrid Execution Mode & Mock Fixtures | Enables zero-cost offline development and deterministic CI testing by toggling between live Google GenAI API and local mock fixtures | Environment variable `GEMINI_API_KEY` (present vs missing/"mock") | Live Gemini API response or deterministic mock release JSON | Graceful fallback to mock if API key is invalid in test environment | ORIGINAL_REQUEST.md:18 |
| 10 | R1: Pipeline | Local Webhook Dispatcher CLI | Standalone CLI script allowing developers and CI runners to dispatch simulated PR merge events locally without a public GitHub tunnel | CLI command / script invocation with optional mock PR parameters | HTTP POST to local `/api/webhooks/github` with mock payload and headers | Displays error stack and non-zero exit code on connection failure | ORIGINAL_REQUEST.md:18 |
| 11 | R2: SaaS UI | Next.js 15 App Router Architecture | Full-stack application structure using React Server Components, server actions, and route handlers | HTTP browser navigation and client requests | Rendered HTML / JSON responses with fast streaming and React 19 features | Standard Next.js error boundaries (`error.tsx`, `not-found.tsx`) | ORIGINAL_REQUEST.md:22 |
| 12 | R2: Database | Supabase PostgreSQL Schema & Migrations | Declarative SQL migrations defining relational tables: `users`, `installations`, `projects`, `pull_requests`, `changelogs` | SQL migration scripts in `supabase/migrations/` | Provisioned PostgreSQL schema with constraints, foreign keys, and indexes | Migration rollbacks and transaction failures on SQL syntax errors | ORIGINAL_REQUEST.md:23 |
| 13 | R2: Security | Row-Level Security (RLS) Policies | Enforces database-level isolation so founders only access their own installations, projects, and unreleased queue | Supabase Auth JWT (`auth.uid()`) on database queries | Accessible row subsets; blocks cross-tenant reads and mutations | 403 Forbidden / empty result set on unauthorized access | ORIGINAL_REQUEST.md:23 |
| 14 | R2: Dashboard | Repository Connection Workflow | Interface for founders to link their GitHub repositories to ShipLog projects | GitHub App installation selection or repository full name (`owner/repo`) | New project record created in `projects` table with unique URL `slug` | 400 on duplicate slug/repo; 403 if Free tier repo limit (1 repo) exceeded | ORIGINAL_REQUEST.md:24 |
| 15 | R2: Dashboard | Unreleased PR Queue View | Dashboard table displaying accumulated PRs, their filter status (`queued` vs `filtered`), author avatar/name, and merge date | Project ID from route params | Interactive list with status badges, links to GitHub PRs, and inclusion toggles | Empty state UI if no PRs are currently unreleased | ORIGINAL_REQUEST.md:24 |
| 16 | R2: Dashboard | Release Generation Trigger | Action button that triggers AI synthesis on unreleased PRs for a project | POST request to `/api/projects/[id]/generate-release` with version tag | New draft changelog created; redirects to draft release editor | 400 if no queued PRs exist; 403 if Free tier release limit (2/mo) exceeded | ORIGINAL_REQUEST.md:24 |
| 17 | R2: Dashboard | Inline Markdown Release Editor | WYSIWYG / split-pane markdown editor for reviewing, editing, and refining AI-generated release notes and metadata | Draft changelog ID, updated title, summary, categories, and body | Updated `changelogs` draft record saved via auto-save or save button | 400 on invalid payload; 404 if changelog does not exist | ORIGINAL_REQUEST.md:24 |
| 18 | R2: Dashboard | One-Click Publishing Workflow | Transitions a draft release to public state, timestamps `published_at`, updates PR queue status to `included`, and updates public feeds | POST request to `/api/projects/[id]/releases/[releaseId]/publish` | Changelog `status: 'published'`, public changelog and widget cache refreshed | 400 if release is already published; 404 if release not found | ORIGINAL_REQUEST.md:25 |
| 19 | R2: Dashboard | Syndication Copy Actions | One-click clipboard copy buttons for ready-to-send email markdown and Twitter/X thread posts | User click on "Copy Email" or "Copy X Thread" buttons | Content copied to system clipboard with visual toast notification | Toast error if browser clipboard permissions are denied | ORIGINAL_REQUEST.md:25 |
| 20 | R2: Portal | Hosted SSR Changelog Portal (`/c/[slug]`) | High-performance Server-Side Rendered public changelog page with version timeline, category badges, and clean typography | GET request to `/c/[slug]` | Complete SSR HTML document loaded in <1s with zero client bundle requirements | 404 Not Found page if slug does not exist | ORIGINAL_REQUEST.md:26 |
| 21 | R2: Portal | Dynamic OpenGraph Meta Tags | Server-generated social preview cards (`og:title`, `og:description`, `og:image`, `twitter:card`) reflecting latest release | GET request to `/c/[slug]` with social bot user-agent | Meta tags embedded in `<head>`: release title, overview summary, custom OG card | Fallback to project name and default description if no releases exist | ORIGINAL_REQUEST.md:26 |
| 22 | R3: Widget | Zero-Dependency Widget Bundle | Standalone JavaScript client script compiled via Vite/esbuild into `/public/widget.js` (<5 KB minified/gzipped) | Build command `npm run build:widget` | Single distribution file `/public/widget.js` under 5,120 bytes gzipped | Build fails if bundle size exceeds 5 KB threshold | ORIGINAL_REQUEST.md:30 |
| 23 | R3: Widget | Scoped Shadow DOM Style Isolation | Encapsulates widget UI (launcher, drawer, release cards) inside a Shadow Root with inlined CSS, preventing style leakage or host CSS interference | DOM initialization on host web page: `<script src=".../widget.js" data-slug="..."></script>` | Shadow DOM tree `#shadow-root (open)` attached to host DOM element | Graceful fallback if Shadow DOM is not supported by legacy browser | ORIGINAL_REQUEST.md:31 |
| 24 | R3: Widget | LocalStorage Unread Bell Launcher | Floating launcher button with notification bell icon and red unread dot indicating unseen releases | `localStorage` key `shiplog_last_seen_${slug}` vs latest release `published_at` | Renders unread dot if newer release exists; hides dot when opened | Operates normally if localStorage is blocked (defaults to visible unread) | ORIGINAL_REQUEST.md:32 |
| 25 | R3: Widget | Responsive Slide-Out Drawer | Slide-out overlay drawer displaying recent published releases, categorized bullet items, and formatted release dates | User click on launcher bell | Animated drawer opens from right; backdrop covers host viewport; close on Esc/click | Graceful scrolling inside drawer on small viewport / mobile screens | ORIGINAL_REQUEST.md:33 |
| 26 | R3: Widget | Viral Badge Logic | "Powered by ShipLog" badge at the bottom of the widget, linking to ShipLog; automatically suppressed for Pro tier projects | `project.is_pro` boolean in widget API response | If `is_pro === false`: render badge; if `true`: suppress badge entirely | Badge always visible if API request fails or defaults to Free tier | ORIGINAL_REQUEST.md:34 |
| 27 | R3: Widget | Edge-Cacheable Public Widget API | High-throughput JSON endpoint serving published releases for a project with CORS and HTTP edge-caching headers | GET request to `/api/v1/widget/[slug]` | JSON payload `{ project: {...}, releases: [...] }` with `Cache-Control` & `Access-Control-Allow-Origin: *` | 404 JSON response `{ error: "Project not found" }` if slug is invalid | ORIGINAL_REQUEST.md:35 |
| 28 | R4: Monetization | Dodo Payments Pro Checkout Flow | Checkout redirection flow allowing founders to subscribe to the $15/month Pro plan via Dodo Payments | POST request to `/api/billing/checkout` | JSON `{ checkout_url: "https://checkout.dodopayments.com/..." }` | 401 if unauthenticated; 500 if Dodo Payments API fails to create session | ORIGINAL_REQUEST.md:39 |
| 29 | R4: Monetization | Dodo Payments Webhook Receiver | Webhook handler processing subscription events (`subscription.created`, `subscription.updated`, `subscription.cancelled`) | POST request to `/api/webhooks/dodo`, headers: `webhook-id`, `webhook-signature`, `webhook-timestamp` | `{ received: true, tier: "pro" \| "free" }`, HTTP 200 | 401 Unauthorized on invalid signature; 400 Bad Request on invalid body | ORIGINAL_REQUEST.md:40 |
| 30 | R4: Monetization | Webhook Idempotency Handler | Prevents duplicate processing of subscription webhooks by tracking processed webhook IDs | Webhook ID from header or payload | Returns HTTP 200 `{ received: true, duplicate: true }` if already processed | Prevents race conditions and multiple tier mutations | ORIGINAL_REQUEST.md:40 |
| 31 | R4: Monetization | Development Signature Bypass Toggle | Allows automated test suites and offline CI to bypass cryptographic signature verification using `x-mock-signature` header | Header `x-mock-signature: true` in non-production environments | Skips HMAC check and executes webhook event processing | Disabled in production (`NODE_ENV === 'production'`) for security | ORIGINAL_REQUEST.md:41 |
| 32 | R4: Monetization | Tier Feature Gating Enforcement | Enforces limits: Free tier (1 repo, 2 releases/mo, viral badge); Pro tier (unlimited repos/releases, white-labeled, custom domain) | Current user tier and project counts upon repo connection or release generation | Allows action or rejects with 403 Forbidden and upgrade call-to-action | 403 Forbidden with `{ error: "limit_reached", plan: "free", upgrade_url: "/billing" }` | ORIGINAL_REQUEST.md:42 |
| 33 | R5: Verification | Automated Unit & Integration Suite | Comprehensive Vitest/Jest test suite covering noise filters, JSON schemas, API routes, and webhook processing | Command `npm test` | Clean test run with 100% pass rate across all suites | Non-zero exit code on any assertion failure | ORIGINAL_REQUEST.md:46 |
| 34 | R5: Verification | E2E Pipeline Simulation CLI | Standalone CLI script verifying the complete lifecycle: PR merge webhook -> queue -> AI draft -> publish -> widget API & SSR | Command `npm run test:simulate` | Terminal log of each verified step and exit code 0 | Terminal error log and exit code 1 if any step in pipeline fails | ORIGINAL_REQUEST.md:47 |
| 35 | R5: Verification | Automated Bundle Size Checker | Automated assertion script ensuring the compiled `widget.js` bundle stays strictly under 5 KB gzipped | Command `npm run check:widget-size` | Prints exact raw, minified, and gzipped byte sizes; exits with 0 | Exits with code 1 if gzipped bundle size >= 5,120 bytes (5 KB) | ORIGINAL_REQUEST.md:48 |
| 36 | R5: Verification | Next.js Production Build Gate | Full production compilation and typecheck validating zero TypeScript errors and zero lint failures | Command `npm run build` | Next.js production build output in `.next/` directory; exit code 0 | Non-zero exit code if TypeScript or ESLint errors exist | ORIGINAL_REQUEST.md:49, 57 |

---

## 4. Edge Cases

The following table documents critical edge cases, inputs, and observed/required system behaviors:

| # | Feature | Input | Observed / Required Behavior |
|---|---------|-------|------------------------------|
| 1 | GitHub Webhook | `pull_request.closed` event where `pull_request.merged === false` | System returns HTTP 200 with `{ status: "ignored", reason: "pr_not_merged" }`. No record is inserted into `pull_requests`. |
| 2 | GitHub Webhook | PR title matching noise prefix e.g. `chore(deps): bump vite to 6.0` | System matches `NOISE_PREFIX_REGEX`, inserts record into `pull_requests` with `status: 'filtered'` (omitted from AI synthesis queue). |
| 3 | GitHub Webhook | PR title containing exclusion tag e.g. `Fix auth bug [skip]` | System matches `EXCLUSION_MARKERS_REGEX`, marks PR as `status: 'filtered'`. |
| 4 | GitHub Webhook | PR title without noise prefix e.g. `Add webhook signature verification` | Preserved! Matches conventional non-noise patterns, inserts record into `pull_requests` with `status: 'queued'`. |
| 5 | GitHub Webhook | Webhook re-delivered with identical PR number for same project | Handled idempotently. Database UNIQUE constraint on `(project_id, pr_number)` catches duplicate; endpoint returns HTTP 200 with `{ status: "exists" }`. |
| 6 | GitHub Webhook | Unknown GitHub repository not registered in `projects` table | System returns HTTP 200 or 404 with `{ status: "ignored", reason: "project_not_found" }`. Does not crash. |
| 7 | AI Transformation | Empty unreleased queue when founder clicks "Generate Release" | Endpoint `/api/projects/[id]/generate-release` returns HTTP 400 Bad Request with `{ error: "No unreleased PRs available for release generation" }`. |
| 8 | AI Transformation | Release generation triggered in offline / CI environment with no `GEMINI_API_KEY` | System automatically activates hybrid deterministic mock mode, returning valid structured release JSON conforming to the schema without error. |
| 9 | AI Transformation | Gemini returns malformed JSON or markdown code blocks (e.g. ````json ... ````) | Synthesizer parser cleans markdown fences before JSON parsing; if schema validation fails, applies graceful schema fallback and logs error. |
| 10 | AI Transformation | PR list has only bug fixes, no features or improvements | Gemini schema produces `{ features: [], improvements: [], fixes: ["Fix login timeout"] }`. Release editor renders clean view with only Fixes section. |
| 11 | Dashboard Editor | Founder modifies release title and adds custom bullets before publishing | Draft changelog updates in database; publishing incorporates founder's manual edits into public changelog and widget. |
| 12 | Dashboard Editor | Founder triggers "Publish" on a draft that was already published | Endpoint returns HTTP 400 Bad Request with `{ error: "Release is already published" }`. |
| 13 | Widget Runtime | Host application has aggressive CSS resets e.g. `* { all: unset; box-sizing: border-box; }` | Scoped Shadow DOM isolates all widget styles. Inlined CSS inside Shadow Root is completely unaffected by host styles. |
| 14 | Widget Runtime | User has cookies/localStorage disabled in private browsing mode | `localStorage` access wrapped in `try/catch`. Widget continues to render and functions without throwing uncaught exceptions; unread badge defaults gracefully. |
| 15 | Widget Runtime | Project is on Free Tier (`project.is_pro === false`) | Widget footer renders viral badge: `<div class="shiplog-badge">Powered by <a href="https://shiplog.dev" target="_blank">ShipLog</a></div>`. |
| 16 | Widget Runtime | Project is on Pro Tier (`project.is_pro === true`) | Widget suppresses the "Powered by ShipLog" badge entirely (white-labeled). |
| 17 | Widget API | Public API request from external host e.g. `https://my-app.com` to `/api/v1/widget/my-project` | Server responds with `Access-Control-Allow-Origin: *` and `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. |
| 18 | Widget API | Request to `/api/v1/widget/non-existent-slug` | Server responds with HTTP 404 and `{ error: "Project not found" }`. Widget handles error gracefully without breaking host page. |
| 19 | Dodo Payments | Webhook received with valid `x-mock-signature` header in development mode | Signature verification succeeds via mock bypass; subscription lifecycle event executes and updates user tier to `pro`. |
| 20 | Dodo Payments | Webhook received with `x-mock-signature` header in production mode (`NODE_ENV === 'production'`) | Bypass is strictly forbidden in production; fails signature verification with HTTP 401 Unauthorized. |
| 21 | Dodo Payments | Duplicate `subscription.created` webhook received with identical `webhook-id` | Idempotency layer detects processed webhook ID in database; returns HTTP 200 `{ received: true, duplicate: true }` without re-running state mutations. |
| 22 | Dodo Payments | Webhook received with event `subscription.cancelled` | User tier downgraded to `free`; all user's projects have `is_pro` set to `false`; widget restores viral "Powered by ShipLog" badge. |
| 23 | Feature Gating | Free tier user attempts to connect a 2nd repository | Route `/api/projects` checks existing project count (1 >= 1); returns HTTP 403 Forbidden with `{ error: "limit_reached", feature: "repositories", max: 1 }`. |
| 24 | Feature Gating | Free tier user attempts to generate a 3rd release in the current calendar month | Route `/api/projects/[id]/generate-release` checks monthly release count (2 >= 2); returns HTTP 403 Forbidden with upgrade prompt. |
| 25 | SSR Portal | Search crawler or Twitter card validator accesses `/c/[slug]` | Pure server-rendered HTML with `<meta property="og:title" ...>`, `<meta property="og:description" ...>`, and `<meta name="twitter:card" content="summary_large_image">`. |

---

## 5. Exhaustive Technical Specifications

### 5.1 R1: GitHub Ingestion & Structured AI Pipeline Specification

#### A. Webhook Receiver Contract (`/api/webhooks/github`)
- **HTTP Method**: `POST`
- **Route**: `app/api/webhooks/github/route.ts`
- **Headers**:
  ```http
  Content-Type: application/json
  x-github-event: pull_request | release | ping
  x-github-delivery: 720c26c0-776f-11ee-8f3a-7a5611689ad7
  x-hub-signature-256: sha256=d574488f3071360c1d80226c39e7222cb1076dd63035f4a14284b5ccd35117ba
  x-mock-signature: true  (Optional: Development & simulation bypass)
  ```
- **Signature Verification Algorithm**:
  ```typescript
  import crypto from 'node:crypto';

  export function verifyGitHubSignature(rawBody: string, signature: string | null, secret: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
  ```

#### B. Noise Filtering Engine Specifications
- **Noise Prefix Regex**:
  ```javascript
  export const NOISE_PREFIX_REGEX = /^(chore|ci|test|style|refactor)(\(.*\))?:/i;
  ```
  - Matches: `chore: bump lodash`, `chore(deps): update next`, `ci: add vitest`, `test(e2e): fix flaky test`, `style: format with prettier`, `refactor(auth): simplify session token`.
  - Does NOT match: `feat: add widget drawer`, `feature(billing): dodo payments checkout`, `fix: resolve hydration error`, `perf: cache widget api`, `docs: update changelog guide`, `Support dark mode`.

- **Exclusion Markers Regex**:
  ```javascript
  export const EXCLUSION_MARKERS_REGEX = /\[(skip|internal|no-log)\]/i;
  ```
  - Matches anywhere in title or body: `Fix memory leak in worker [skip]`, `Deploy staging cluster [internal]`, `Update internal dev seeds [no-log]`.

- **Filtering State Evaluation**:
  ```typescript
  export interface FilterResult {
    isFiltered: boolean;
    reason?: 'noise_prefix' | 'exclusion_marker';
  }

  export function evaluatePRNoise(title: string, body?: string | null): FilterResult {
    if (NOISE_PREFIX_REGEX.test(title.trim())) {
      return { isFiltered: true, reason: 'noise_prefix' };
    }
    const combined = `${title} ${body || ''}`;
    if (EXCLUSION_MARKERS_REGEX.test(combined)) {
      return { isFiltered: true, reason: 'exclusion_marker' };
    }
    return { isFiltered: false };
  }
  ```

#### C. Gemini 1.5 Flash Structured JSON Schema
- **Target Schema Definition**:
  ```json
  {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ReleaseNotesSynthesis",
    "type": "object",
    "required": ["release_title", "overview_summary", "categories", "distribution"],
    "properties": {
      "release_title": {
        "type": "string",
        "description": "Engaging, user-facing title for the release (e.g., 'v1.4.0 — Supercharged Performance & Dark Mode')"
      },
      "overview_summary": {
        "type": "string",
        "description": "1-2 paragraph executive summary highlighting key updates in customer-friendly language"
      },
      "categories": {
        "type": "object",
        "required": ["features", "improvements", "fixes"],
        "properties": {
          "features": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Bullet points describing new user-facing functionality"
          },
          "improvements": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Bullet points describing performance optimizations and UX polish"
          },
          "fixes": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Bullet points describing bug repairs and reliability improvements"
          }
        }
      },
      "distribution": {
        "type": "object",
        "required": ["email_plain_text", "social_post_thread"],
        "properties": {
          "email_plain_text": {
            "type": "string",
            "description": "Ready-to-send plain text / markdown email newsletter announcement"
          },
          "social_post_thread": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Numbered 3-5 part Twitter/X thread with hook, bullet points, and CTA (under 280 chars per tweet)"
          }
        }
      }
    }
  }
  ```

- **Gemini SDK Configuration Call**:
  ```typescript
  import { GoogleGenAI, Type } from '@google/genai';

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const releaseSchema = {
    type: Type.OBJECT,
    properties: {
      release_title: { type: Type.STRING },
      overview_summary: { type: Type.STRING },
      categories: {
        type: Type.OBJECT,
        properties: {
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          fixes: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        propertyOrdering: ["features", "improvements", "fixes"]
      },
      distribution: {
        type: Type.OBJECT,
        properties: {
          email_plain_text: { type: Type.STRING },
          social_post_thread: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        propertyOrdering: ["email_plain_text", "social_post_thread"]
      }
    },
    propertyOrdering: ["release_title", "overview_summary", "categories", "distribution"]
  };
  ```

- **Deterministic Mock Synthesizer (Hybrid Mode)**:
  When `GEMINI_API_KEY` is missing, `"mock"`, or during test simulation:
  ```typescript
  export function synthesizeMockRelease(prs: Array<{ title: string; body?: string | null; author: string }>, versionTag: string) {
    const features: string[] = [];
    const improvements: string[] = [];
    const fixes: string[] = [];

    for (const pr of prs) {
      const cleanTitle = pr.title.replace(/^(feat|fix|perf|docs|improve)(\(.*\))?:\s*/i, '');
      if (/^fix/i.test(pr.title)) fixes.push(cleanTitle);
      else if (/^(perf|improve)/i.test(pr.title)) improvements.push(cleanTitle);
      else features.push(cleanTitle);
    }

    const title = `${versionTag} — ${features[0] || 'Quality & Performance Improvements'}`;
    const summary = `We are excited to announce ${versionTag}! This update includes ${features.length} new features, ${improvements.length} improvements, and ${fixes.length} bug fixes to elevate your experience.`;

    return {
      release_title: title,
      overview_summary: summary,
      categories: {
        features: features.length > 0 ? features : ['General functionality improvements'],
        improvements: improvements.length > 0 ? improvements : ['Platform performance optimizations'],
        fixes: fixes.length > 0 ? fixes : ['Minor bug repairs and stability enhancements']
      },
      distribution: {
        email_plain_text: `Hey everyone!\n\n${summary}\n\nKey Highlights:\n${features.map(f => `• ${f}`).join('\n')}\n\nRead the full changelog at https://shiplog.dev`,
        social_post_thread: [
          `🚀 Just shipped ${versionTag}!\n\n${summary.slice(0, 180)}...\n\nThread below 🧵👇 (1/3)`,
          `✨ What's new:\n${features.slice(0, 3).map(f => `• ${f}`).join('\n')}\n\n(2/3)`,
          `🛠️ Fixes & performance improvements included.\nCheck out the full changelog here! 🚢\n\n(3/3)`
        ]
      }
    };
  }
  ```

---

### 5.2 R2: SaaS Dashboard & Public SSR Changelog Portal Specification

#### A. Supabase PostgreSQL Schema DDL (`supabase/migrations/20260922000001_initial_schema.sql`)
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table (synced from Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Installations table (GitHub App installations)
CREATE TABLE IF NOT EXISTS public.installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  github_installation_id BIGINT NOT NULL UNIQUE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  installation_id UUID REFERENCES public.installations(id) ON DELETE SET NULL,
  repo_full_name TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

-- 4. Pull Requests (Unreleased accumulation queue)
CREATE TABLE IF NOT EXISTS public.pull_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  author TEXT NOT NULL,
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  merged_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'included', 'filtered')),
  release_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_project_pr UNIQUE(project_id, pr_number)
);
CREATE INDEX IF NOT EXISTS idx_pull_requests_project_status ON public.pull_requests(project_id, status);

-- 5. Changelogs table (Releases)
CREATE TABLE IF NOT EXISTS public.changelogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_title TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  overview_summary TEXT NOT NULL,
  categories JSONB NOT NULL DEFAULT '{"features":[],"improvements":[],"fixes":[]}'::jsonb,
  distribution JSONB NOT NULL DEFAULT '{"email_plain_text":"","social_post_thread":[]}'::jsonb,
  markdown_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_changelogs_project_published ON public.changelogs(project_id, status, published_at DESC);

-- Alter pull_requests to add FK constraint for release_id
ALTER TABLE public.pull_requests
  ADD CONSTRAINT fk_pr_release FOREIGN KEY (release_id) REFERENCES public.changelogs(id) ON DELETE SET NULL;

-- 6. Row-Level Security (RLS) Configuration
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;

-- Users RLS
CREATE POLICY "Users can view and update own profile"
  ON public.users FOR ALL
  USING (auth.uid() = id);

-- Installations RLS
CREATE POLICY "Users can view and manage own installations"
  ON public.installations FOR ALL
  USING (auth.uid() = user_id);

-- Projects RLS
CREATE POLICY "Users can view and manage own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view basic project info by slug"
  ON public.projects FOR SELECT
  USING (true);

-- Pull Requests RLS
CREATE POLICY "Users can view and manage PRs in own projects"
  ON public.pull_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = pull_requests.project_id AND projects.user_id = auth.uid()
  ));

-- Changelogs RLS
CREATE POLICY "Users can manage changelogs in own projects"
  ON public.changelogs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = changelogs.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Public can view published changelogs"
  ON public.changelogs FOR SELECT
  USING (status = 'published');
```

#### B. SSR Public Portal `/c/[slug]` Contract
- **Route**: `app/(public)/c/[slug]/page.tsx`
- **Rendering Mode**: Server-Side Rendered (SSR) with React Server Component
- **Performance Requirement**: Sub-second load time, zero client JavaScript hydration for changelog reading.
- **Dynamic OpenGraph Meta Tags**:
  ```typescript
  export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const project = await getProjectBySlug(params.slug);
    const latestRelease = await getLatestPublishedRelease(project.id);

    const title = latestRelease
      ? `${latestRelease.release_title} | ${project.repo_name} Changelog`
      : `${project.repo_name} Changelog | ShipLog`;
    const description = latestRelease?.overview_summary || `Stay updated with the latest releases for ${project.repo_name}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `https://shiplog.dev/c/${params.slug}`,
        images: [{ url: `/api/og/${params.slug}?release=${latestRelease?.version_tag || 'latest'}` }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      }
    };
  }
  ```

---

### 5.3 R3: Standalone Embeddable In-App Widget (< 5 KB) Specification

#### A. Compilation & Bundle Size Constraints
- **Target File**: `public/widget.js`
- **Compiler**: Vite (library mode) or esbuild (`esbuild src/widget/index.ts --bundle --minify --format=iife --outfile=public/widget.js`)
- **Bundle Constraints**:
  - Raw uncompressed: `< 12 KB`
  - Minified + Gzipped: `< 5,120 bytes` (strictly `< 5 KB`)
  - Zero external dependencies: no React, no Preact, no Lodash, no external CSS files.
- **Size Verification Script (`scripts/check-widget-size.js`)**:
  ```javascript
  import fs from 'node:fs';
  import zlib from 'node:zlib';

  const file = 'public/widget.js';
  const content = fs.readFileSync(file);
  const gzipped = zlib.gzipSync(content);

  console.log(`Widget raw size: ${(content.length / 1024).toFixed(2)} KB (${content.length} B)`);
  console.log(`Widget gzipped size: ${(gzipped.length / 1024).toFixed(2)} KB (${gzipped.length} B)`);

  if (gzipped.length > 5120) {
    console.error(`❌ Widget size check FAILED: ${gzipped.length} B exceeds 5 KB limit!`);
    process.exit(1);
  } else {
    console.log(`✅ Widget size check PASSED!`);
    process.exit(0);
  }
  ```

#### B. Scoped Shadow DOM Architecture
- **Host Attachment**:
  ```html
  <script src="https://shiplog.dev/widget.js" data-slug="my-saas" data-position="bottom-right" async></script>
  ```
- **Shadow Root Creation**:
  ```javascript
  const container = document.createElement('div');
  container.id = 'shiplog-root';
  document.body.appendChild(container);
  const shadow = container.attachShadow({ mode: 'open' });
  ```
- **Inlined Styles**:
  All styling (launcher button, notification dot, slide drawer, release cards, typography, transitions) is defined strictly within a `<style>` tag attached to `shadow`. No external `<link rel="stylesheet">` is injected.

#### C. LocalStorage State Machine for Unread Indicator
- **Storage Key**: `shiplog_last_seen_${slug}`
- **State Machine Flow**:
  1. Fetch `/api/v1/widget/${slug}`.
  2. Read `releases[0].published_at`.
  3. Read `lastSeen = localStorage.getItem('shiplog_last_seen_' + slug)`.
  4. If `!lastSeen || new Date(releases[0].published_at) > new Date(lastSeen)`:
     - Render red unread indicator dot on launcher bell.
  5. When user clicks launcher bell to open slide drawer:
     - `localStorage.setItem('shiplog_last_seen_' + slug, releases[0].published_at)`
     - Remove unread indicator dot.

#### D. Viral Badge Logic
- Evaluates `project.is_pro` boolean from API response:
  - If `is_pro === false`: Append `<div class="shiplog-badge">Powered by <a href="https://shiplog.dev?utm_source=widget&utm_medium=badge&utm_campaign=${slug}" target="_blank">ShipLog</a></div>` at the bottom of the drawer.
  - If `is_pro === true`: Omit badge element completely.

#### E. Public Widget Endpoint Specification (`/api/v1/widget/[slug]`)
- **HTTP Method**: `GET`
- **Route**: `app/api/v1/widget/[slug]/route.ts`
- **Headers**:
  ```http
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, OPTIONS
  Access-Control-Allow-Headers: Content-Type
  Cache-Control: public, s-maxage=60, stale-while-revalidate=300
  ```
- **Response Payload**:
  ```json
  {
    "project": {
      "name": "My SaaS",
      "slug": "my-saas",
      "is_pro": false
    },
    "releases": [
      {
        "id": "c1f7b8a0-1234-4567-89ab-cdef01234567",
        "release_title": "v1.2.0 — Dark Mode & Faster Sync",
        "version_tag": "v1.2.0",
        "overview_summary": "We are thrilled to launch dark mode and 3x faster background syncing.",
        "categories": {
          "features": ["Native dark mode theme support"],
          "improvements": ["Sync latency reduced by 65%"],
          "fixes": ["Fixed profile photo upload glitch"]
        },
        "published_at": "2026-09-22T16:00:00Z"
      }
    ]
  }
  ```

---

### 5.4 R4: Monetization & Subscription Infrastructure Specification

#### A. Dodo Payments Checkout API Contract (`/api/billing/checkout`)
- **HTTP Method**: `POST`
- **Route**: `app/api/billing/checkout/route.ts`
- **Request Body**:
  ```json
  {
    "return_url": "https://shiplog.dev/dashboard/billing?status=success"
  }
  ```
- **Dodo API Call**:
  - Creates checkout session with product ID for $15/month Pro Plan.
  - Passes user email and `metadata: { user_id: session.user.id }`.
- **Response Body**:
  ```json
  {
    "checkout_url": "https://checkout.dodopayments.com/buy/prod_pro_monthly?session=chk_xyz123"
  }
  ```

#### B. Dodo Payments Webhook Receiver (`/api/webhooks/dodo`)
- **HTTP Method**: `POST`
- **Route**: `app/api/webhooks/dodo/route.ts`
- **Headers**:
  ```http
  Content-Type: application/json
  webhook-id: msg_2bXYZ1234567890
  webhook-signature: v1,g0hM9Sv...
  webhook-timestamp: 1727025600
  x-mock-signature: true  (Optional: Development & offline testing bypass)
  ```
- **Event Types Handled**:
  1. `subscription.created` (or `subscription.active`):
     - Extract `user_id` from `data.metadata.user_id`.
     - Update `users` table: `tier = 'pro'`, `subscription_id = data.subscription_id`.
     - Update `projects` table: `is_pro = true` for all projects owned by `user_id`.
  2. `subscription.updated`:
     - If `status === 'active'`: ensure `tier = 'pro'`, `is_pro = true`.
     - If `status === 'past_due'`: optionally alert user.
  3. `subscription.cancelled`:
     - Update `users` table: `tier = 'free'`.
     - Update `projects` table: `is_pro = false` for all user's projects.
- **Idempotency Guarantee**:
  - System checks if `webhook-id` has already been processed in database table or processed set.
  - If already processed, immediately returns HTTP 200 `{ received: true, duplicate: true }`.

#### C. Feature Gating Matrix & Enforcement Rules

| Feature | Free Tier | Pro Tier ($15/mo) | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **Connected Repositories** | Max 1 repository | Unlimited | `POST /api/projects`: reject if `count >= 1` and `tier === 'free'` (403 Forbidden) |
| **Monthly Releases** | Max 2 releases/month | Unlimited | `POST /api/projects/[id]/generate-release`: reject if month count >= 2 (403 Forbidden) |
| **Widget Branding** | "Powered by ShipLog" mandatory | White-labeled (badge suppressed) | `/api/v1/widget/[slug]` delivers `is_pro: false/true`; widget renders/hides badge |
| **Custom Domain** | Disabled | Enabled (`custom_domain` supported) | `POST /api/projects/[id]/settings`: reject custom domain updates for Free tier |

---

### 5.5 R5: Comprehensive Verification Suite & Tooling Specification

#### A. Automated Test Suite (`npm test`)
- Runner: `vitest run`
- Test Suites:
  1. `tests/unit/noise-filter.test.ts`:
     - Validates exclusion of `chore:`, `ci:`, `test:`, `style:`, `refactor:` prefixes with and without scope (e.g. `chore(deps):`).
     - Validates exclusion of `[skip]`, `[internal]`, `[no-log]` flags in title and multiline body.
     - Validates retention of `feat:`, `fix:`, `perf:`, `docs:`, `improve:` and plain titles.
  2. `tests/unit/gemini-schema.test.ts`:
     - Validates synthesis output against strict JSON schema.
     - Tests all required keys: `release_title`, `overview_summary`, `categories` (`features`, `improvements`, `fixes`), `distribution` (`email_plain_text`, `social_post_thread`).
  3. `tests/integration/webhook-github.test.ts`:
     - Tests signature verification, `x-mock-signature` bypass, `merged: false` ignore behavior, and unreleased queue insertion.
  4. `tests/integration/webhook-dodo.test.ts`:
     - Tests Dodo webhook signature check, idempotency check, `subscription.created` Pro upgrade, and `subscription.cancelled` downgrade.
  5. `tests/integration/widget-api.test.ts`:
     - Validates `/api/v1/widget/[slug]` CORS headers, cache headers, and payload structure.

#### B. End-to-End Pipeline Simulation Script (`npm run test:simulate`)
- Script: `scripts/simulate-pipeline.ts`
- Verifies full pipeline in an automated, repeatable sequence:
  ```
  Step 1: Dispatch mock PR merge webhook (pull_request.closed, merged=true) -> Verify 200 OK & queued in database
  Step 2: Dispatch noise PR merge webhook (chore: bump deps [skip]) -> Verify 200 OK & filtered
  Step 3: Trigger release generation -> Verify Gemini/mock synthesized structured JSON draft
  Step 4: Trigger release publish -> Verify status changes to 'published' and PR queue updated
  Step 5: Fetch public widget API (/api/v1/widget/[slug]) -> Verify CORS headers & release appears in feed
  Step 6: Fetch SSR public portal (/c/[slug]) -> Verify SSR HTML contains release title and OG tags
  Step 7: Exit with code 0 on complete verification
  ```

#### C. Automated Bundle Size Verification Script (`npm run check:widget-size`)
- Script: `scripts/check-widget-size.js`
- Compiles `public/widget.js` via Vite/esbuild.
- Reads `public/widget.js`, computes gzipped byte size using `node:zlib`.
- Asserts size `< 5120 bytes`.
- Fails with exit code 1 if size >= 5 KB.

#### D. Production Build Gate (`npm run build`)
- Command: `next build`
- Zero TypeScript compiler errors (`tsc --noEmit`).
- Zero ESLint linting errors.

---

## 6. Caveats

1. **Sandbox & External Network Restrictions**: During automated CI and sandboxed development environments, external network calls to live GitHub APIs and Google Gemini API will not be available. The deterministic mock mode and local webhook dispatcher are mandatory architectural requirements to ensure reliable offline execution.
2. **Supabase Local Development**: In local test environments without a hosted Supabase project, Supabase calls must support a local PostgreSQL instance or an in-memory/mock client wrapper for integration test passes.
3. **Dodo Payments Test Mode**: Dodo Payments webhook verification in production requires a real webhook signing key; for automated testing and CI pipelines, the `x-mock-signature` header bypass must be supported in non-production environments (`NODE_ENV !== 'production'`).
4. **Widget Caching**: Edge caching on `/api/v1/widget/[slug]` uses `s-maxage=60, stale-while-revalidate=300`. In high-frequency release cycles, cached responses may take up to 60 seconds to invalidate at CDN edge nodes unless purged.

---

## 7. Conclusion

This specification provides the exhaustive technical blueprint for ShipLog across all five requirements (R1–R5). Every API route, webhook payload, JSON schema, database migration, Shadow DOM constraint, billing lifecycle event, and automated test command has been rigorously defined with unambiguous contracts and error behaviors.

The engineering team can proceed directly to Phase 1 implementation with full confidence in interface compatibility and verification standards.

---

## 8. Verification Method

To independently verify this specification report:
1. Inspect the requirements traceability in this document against `/home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md`.
2. Inspect the runtime environment:
   ```bash
   node -v  # Expected: v22.22.1
   npm -v   # Expected: 9.2.0
   ```
3. When Phase 1 implementation begins, verify that the implementation adheres to the defined verification commands:
   ```bash
   npm test                  # Validates unit, integration, and schema suites
   npm run check:widget-size # Validates widget.js stays strictly under 5 KB gzipped
   npm run test:simulate     # Validates end-to-end pipeline from webhook to widget API
   npm run build             # Validates Next.js production build with zero TS/lint errors
   ```
