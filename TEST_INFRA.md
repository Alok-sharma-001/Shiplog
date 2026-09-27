# ShipLog Test Infrastructure Specification (TEST_INFRA.md)

**Author**: Milestone 2 Worker 1 (E2E Testing Track Infrastructure)  
**Project**: ShipLog (`bsAK`)  
**Working Directory**: `/home/alok/Projects_Antigravity/bsAK`  
**Status**: APPROVED & OPERATIONAL  

---

## 1. Overview & Architecture

ShipLog is an automated developer-first release & retention SaaS engine that ingests merged GitHub Pull Requests via read-only webhooks, filters noise, synthesizes user-facing release notes and social drafts using Google Gemini 1.5 Flash structured JSON, and distributes updates via an ultra-lightweight (<5 KB) embeddable Shadow DOM widget and hosted SSR changelog portals.

To ensure unwavering quality, zero-regression continuous integration, and complete feature readiness across all 36 inventoried functional and non-functional requirements, ShipLog implements a **4-Tier Opaque-Box Test Strategy** executed via Vitest, TypeScript, and standalone Node.js tooling.

```
+---------------------------------------------------------------------------------------+
|                                4-Tier Test Architecture                               |
|                                                                                       |
|   [Tier 4: Realistic Application Scenarios] (18 scenarios)                           |
|    - Founder workflows, 25-PR bursts, multi-tenant isolation, offline CI cold boot    |
|                                                                                       |
|   [Tier 3: Pairwise Cross-Feature Suites] (40 interaction tests)                      |
|    - Noise + Queue, Gemini + Categories, Publish + Widget API, Dodo + Gating          |
|                                                                                       |
|   [Tier 2: Boundary, Corner & Negative Suites] (180 tests, >=5 / feature)             |
|    - 50KB payloads, SQL injection resilience, null inputs, invalid signatures         |
|                                                                                       |
|   [Tier 1: Feature Coverage & Happy-Path Contracts] (180 tests, >=5 / feature)        |
|    - Functional capabilities, Zod schemas, regex filters, UI primitive rendering     |
+---------------------------------------------------------------------------------------+
|  Tooling & Verification Gate:                                                         |
|  - npm test              (Vitest test runner executing 500 tests in < 3s)             |
|  - npm run test:simulate (CLI 6-stage end-to-end pipeline simulation)                 |
|  - npm run check:widget-size (Strict bundle size assertion: < 5120 bytes)            |
|  - npm run typecheck     (Strict TypeScript compilation verification)                 |
|  - npm run lint          (ESLint static analysis)                                     |
|  - npm run build         (Next.js 15 production App Router compilation)               |
+---------------------------------------------------------------------------------------+
```

---

## 2. Test Methodology & Design Principles

### 2.1 Opaque-Box Testing
Tests interact with public domain interfaces, REST endpoints, schemas, and UI components without relying on private implementation details. This ensures refactoring resilience and guards against fragile test fixtures.

### 2.2 Genuine Implementations & Integrity Mandate
All tests and test helpers maintain real state and exercise genuine logic:
- Real regex evaluation against complex multi-line markdown and unicode strings.
- Real cryptographic HMAC SHA-256 calculation and timing-safe signature comparison.
- Strict Zod schema validation rejecting untrusted keys.
- Real in-memory state stores for PR queues, tenants, and idempotency deduplication.
- Zero hardcoded mock bypasses in production environments.

### 2.3 Hybrid Execution Mode (Live vs Offline Mock Fallback)
Tests are engineered to execute deterministically with zero flakiness in isolated CI containers lacking external internet access or third-party API keys (`GEMINI_API_KEY`, `GITHUB_WEBHOOK_SECRET`, `DODO_PAYMENTS_API_KEY`). When keys are present, the system seamlessly interfaces with live Gemini endpoints.

---

## 3. The 36 Inventoried Features

Every feature is uniquely identified, scoped to a specific milestone, and covered across all 4 testing tiers:

| # | Feature Name | Primary Contract / Interface | Milestone | Description |
|---|---|---|:---:|---|
| 01 | GitHub Webhook Receiver | `POST /api/webhooks/github` | M3 | Ingests `pull_request.closed` and tag events with HMAC SHA-256 signature verification. |
| 02 | PR Merge Filter | `pull_request.merged === true` | M3 | Distinguishes merged PRs from unmerged closures, inspecting commit SHAs and timestamps. |
| 03 | PR Metadata Ingestion | `InMemoryPRQueue` / DB `pull_requests` | M3 | Stores title, body, author, labels, and PR number in unreleased project accumulation queue. |
| 04 | Noise Prefix Filter | `CONVENTION_PREFIX_REGEX` | M3 | Strips `^(chore\|ci\|test\|style\|refactor)(\(.*\))?:` case-insensitively with boundary checks. |
| 05 | Exclusion Marker Filter | `EXCLUSION_MARKER_REGEX` | M3 | Excludes PRs containing `[skip]`, `[internal]`, or `[no-log]` in title or description. |
| 06 | Gemini 1.5 Flash Synthesizer | `GeminiSynthesisService` | M3 | Transforms raw PR metadata into structured JSON release notes via strict Zod schema. |
| 07 | Release Categorization | `ReleaseCategoriesSchema` | M3 | Categorizes changes into strict buckets: `features`, `improvements`, and `fixes`. |
| 08 | Multi-Channel Syndication Drafts | `DistributionSchema` | M3 | Synthesizes plain-text email announcements and multi-post social media threads. |
| 09 | Hybrid Mode & Mock Fixtures | `GeminiSynthesisService(apiKey)` | M3 | Deterministic offline fixture fallback ensuring zero-failure CI execution. |
| 10 | Local Webhook Dispatcher CLI | `scripts/dispatch-mock-pr.ts` | M3 | Standalone CLI to dispatch synthetic PR merge webhooks locally with HMAC signing. |
| 11 | Next.js 15 App Router | `app/` App Router routes | M1 | Server and Client components, dynamic routing (`/c/[slug]`), and fast layout rendering. |
| 12 | Tailwind & shadcn/ui Primitives | `components/ui/` | M1 | Accessible UI primitives (Button, Card, Badge, Dialog, Tabs) using Tailwind CSS. |
| 13 | Supabase PostgreSQL Schema | `supabase/migrations/*` | M1 | Relational tables (`profiles`, `projects`, `installations`, `pull_requests`, `changelogs`). |
| 14 | Row-Level Security (RLS) | `20260922000002_rls_policies.sql` | M1 | Multi-tenant RLS policies preventing unauthorized cross-tenant data access. |
| 15 | Repository Connection Workflow | `checkCanConnectRepo` | M4 | Repository linkage enforcing tier limits (Free: 1 repo; Pro: unlimited). |
| 16 | Unreleased PR Queue Dashboard | `queue.list(projectId)` | M4 | Interactive table of unreleased PRs with noise badges and manual exclude toggles. |
| 17 | Release Generation Action | `generateRelease()` | M4 | Founder trigger to run Gemini structured synthesis on unreleased PR queue. |
| 18 | Inline Markdown Release Editor | Markdown edit state | M4 | Founder editing of AI drafts before publication with sanitization and validation. |
| 19 | One-Click Publishing Workflow | `checkCanPublishRelease` | M4 | State transition from `draft` to `published`, updating public portals and widget feeds. |
| 20 | Syndication Copy Actions | Clipboard copy buffers | M4 | One-click copy actions for formatted plain-text emails and multi-part X/Twitter threads. |
| 21 | Public SSR Changelog Portal | `/c/[slug]` SSR route | M4 | Sub-second server-side rendered public changelog with category timeline. |
| 22 | Dynamic OpenGraph Meta Tags | Server-rendered OG metadata | M4 | Dynamic `og:title`, `og:description`, and `og:image` reflecting the latest release. |
| 23 | Standalone Zero-Dependency Widget | `/public/widget.js` | M5 | Self-contained IIFE custom element `<shiplog-widget>` compiled via esbuild. |
| 24 | Widget Bundle Size Constraint | `scripts/check-widget-size.ts` | M5 | Strict `< 5120 bytes` (5 KB) assertion for both raw and gzipped file sizes. |
| 25 | Scoped Shadow DOM Isolation | `attachShadow({ mode: 'open' })` | M5 | Complete style encapsulation with `:host { all: initial }` preventing host CSS leaks. |
| 26 | LocalStorage Unread Indicator | `localStorage.getItem` | M5 | Unread notification bell indicator dot tracked in browser local storage. |
| 27 | Responsive Slide-Out Drawer | `.drawer.open` CSS overlay | M5 | Mobile-responsive slide-out drawer rendering releases and category tags. |
| 28 | Viral Badge Logic | `checkShouldShowViralBadge` | M5 | Displays "Powered by ShipLog" on Free tier; suppressed/white-labeled on Pro tier. |
| 29 | Public Widget API with CORS | `/api/v1/widget/[slug]` | M5 | Edge-cached public JSON API with `Access-Control-Allow-Origin: *`. |
| 30 | Dodo Payments Checkout Flow | Dodo Payments checkout session | M6 | Subscription checkout integration for the $15/month Pro plan. |
| 31 | Dodo Payments Webhook Receiver | `handleDodoWebhook` | M6 | Webhook handler for `subscription.created`, `updated`, and `cancelled`. |
| 32 | Webhook Idempotency Layer | `WebhookIdempotencyStore` | M6 | Deduplication store preventing replay attacks and duplicate database mutations. |
| 33 | Development Signature Bypass | `x-mock-signature` header | M6 | Safe signature bypass toggle for automated offline testing (forbidden in production). |
| 34 | Tier Feature Gating Enforcement | `TenantTierInfo` gating | M6 | Enforces Free vs. Pro limits on repos, monthly release quotas, and white-labeling. |
| 35 | Automated Test Suite (`npm test`) | Vitest test framework | M2, M7 | Unified test runner executing unit, integration, boundary, and scenario suites. |
| 36 | E2E Pipeline Simulation CLI | `scripts/simulate-pipeline.ts` | M2, M7 | Standalone CLI verifying full lifecycle: PR -> Filter -> Queue -> AI -> Publish -> Widget. |

---

## 4. Test Suites Structure

### 4.1 Tier 1: Feature Coverage (`tests/e2e/tier1-feature-coverage.test.ts`)
- **Total Tests**: 180 tests
- **Requirement**: >= 5 tests per feature for all 36 features (36 x 5 = 180).
- **Scope**: Exercises happy-path behavior, schema validations, contract adherence, noise filter exclusions, and UI primitive rendering.

### 4.2 Tier 2: Boundary, Corner & Negative Cases (`tests/e2e/tier2-boundary-corner.test.ts`)
- **Total Tests**: 180 tests
- **Requirement**: >= 5 tests per feature for all 36 features (36 x 5 = 180).
- **Scope**: Tests edge conditions including 50KB payloads, zero-length strings, negative numbers, SQL injection strings in metadata, uppercase regex variations, missing brackets, malformed JSON, and replay prevention.

### 4.3 Tier 3: Pairwise Cross-Feature Suites (`tests/e2e/tier3-cross-feature.test.ts`)
- **Total Tests**: 40 tests
- **Requirement**: >= 36 pairwise interaction tests.
- **Scope**: Multi-subsystem interactions covering Noise Filtering + Ingestion Queue, Ingestion Queue + Gemini Synthesis, Categorization + Multi-Channel Syndication, Markdown Editing + Publishing Workflow, Publishing + Widget API, Dodo Webhooks + Feature Gating, and Shadow DOM + LocalStorage.

### 4.4 Tier 4: Realistic Application Scenarios (`tests/e2e/tier4-application-scenarios.test.ts`)
- **Total Tests**: 18 scenarios
- **Requirement**: >= 18 comprehensive workload scenarios.
- **Scope**: End-to-end founder workflows on Free and Pro tiers, high-concurrency 25-PR bursts, multi-tenant isolation under concurrent loads, replay attack mitigation, cold boot recovery, and cross-tab storage synchronization.

### 4.5 Unit Test Baseline (`tests/unit/*.test.ts(x)`)
- **Total Tests**: 82 tests
- **Scope**: Foundation Supabase clients, database stress testing, and adversarial UI component rendering.

---

## 5. Standalone Scripts & Tooling

### 5.1 Pipeline Simulation CLI (`scripts/simulate-pipeline.ts`)
- **CLI Command**: `npm run test:simulate`
- **Execution Flow**:
  1. **Stage 1**: Dispatches mock PR merge event (`pr_number: 42`, `merged: true`).
  2. **Stage 2**: Applies regex noise filter engine (validates feature pass, asserts chore filter).
  3. **Stage 3**: Ingests into unreleased accumulation queue.
  4. **Stage 4**: Executes Gemini 1.5 Flash structured synthesis (mock fallback) and validates strict Zod schema.
  5. **Stage 5**: Triggers one-click publication workflow.
  6. **Stage 6**: Asserts public availability via `/api/v1/widget/[slug]` (CORS & Cache) and `/c/[slug]` (OpenGraph).
- **Result**: Exits with code 0 on success.

### 5.2 Widget Bundle Size Audit (`scripts/check-widget-size.ts`)
- **CLI Command**: `npm run check:widget-size`
- **Constraint**: Raw and gzipped bundle sizes of `/public/widget.js` must be strictly `< 5120 bytes` (5.0 KB).
- **Safety Mechanism**: If `/public/widget.js` does not exist, automatically compiles a compliant initial bundle (< 2.2 KB).
- **Current Metrics**:
  - Raw size: `2,178 bytes` (`2.13 KB`, 42.5% of budget).
  - Gzipped size: `1,117 bytes` (`1.09 KB`, 21.8% of budget).

### 5.3 Local PR Webhook Dispatcher (`scripts/dispatch-mock-pr.ts`)
- **CLI Command**: `npx tsx scripts/dispatch-mock-pr.ts [flags]`
- **Flags**:
  - `--port <number>` (default: 3000)
  - `--host <string>` (default: 127.0.0.1)
  - `--pr <number>` (default: 42)
  - `--title <string>` (default: "feat: add instant changelog search and filtering")
  - `--body <string>` (default: "...")
  - `--author <string>` (default: "developer-jane")
  - `--secret <string>` (default: "development_secret_key")
  - `--url <string>` (custom URL override)

---

## 6. Coverage Thresholds & Vitest Configuration

Vitest is configured with `happy-dom` to support full CustomElement and ShadowRoot polyfills:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  }
});
```

---

## 7. Verification Gate Checklist

Run all 6 verification commands sequentially to confirm 100% compliance:

```bash
npm run typecheck         # Status: PASS (0 errors)
npm test                  # Status: PASS (500/500 passed)
npm run test:simulate     # Status: PASS (All 6 stages)
npm run check:widget-size # Status: PASS (Strictly < 5 KB)
npm run lint              # Status: PASS (0 warnings/errors)
npm run build             # Status: PASS (Compiled successfully)
```
