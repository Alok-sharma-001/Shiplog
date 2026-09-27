# Project: ShipLog

ShipLog is an automated developer-first release & retention SaaS engine that ingests merged GitHub Pull Requests via read-only webhooks, filters noise, synthesizes user-facing release notes and social drafts using Google Gemini 1.5 Flash structured JSON, and distributes updates via an ultra-lightweight (<5 KB) embeddable Shadow DOM widget and hosted SSR changelog portals.

## Architecture

ShipLog follows a modular Next.js 15 App Router architecture with decoupled domain packages in `lib/`, Supabase PostgreSQL storage with Row-Level Security, an ultra-lightweight zero-dependency widget compiled via esbuild, and comprehensive verification tooling.

```
                      [GitHub Webhook / CLI Dispatcher]
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │  /api/webhooks/github        │
                      │  (HMAC SHA256 / Mock Bypass)│
                      └──────────────┬──────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │  Regex Noise Filter Engine  │
                      │  (convention prefixes &     │
                      │   [skip]/[internal] markers)│
                      └──────────────┬──────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │  Supabase PostgreSQL (RLS)  │
                      │  - pull_requests (queue)    │
                      │  - changelogs (releases)    │
                      │  - projects & installations │
                      │  - profiles (users & tiers) │
                      └──────────────┬──────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
┌─────────────────────────────┐               ┌─────────────────────────────┐
│ Gemini 1.5 Flash Synthesizer│               │   SaaS Founder Dashboard    │
│ (Structured JSON / Mock Mode│               │   - Repo connect & PR queue │
│  Features/Fixes/Social/Mail)│               │   - Inline Markdown editor  │
└─────────────┬───────────────┘               │   - One-click publish/copy  │
              │                               └──────────────┬──────────────┘
              └──────────────────────┬───────────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
┌─────────────────────────────┐               ┌─────────────────────────────┐
│  Public SSR Changelog Portal│               │   Standalone In-App Widget  │
│  - /c/[slug] SSR route      │               │   - < 5 KB bundle (esbuild) │
│  - Dynamic OpenGraph tags   │               │   - Scoped Shadow DOM       │
│  - Timeline & Category tags │               │   - LocalStorage unread bell│
│  - Sub-second loading       │               │   - Viral badge / Pro white │
│  - Viral badge for Free tier│               │   - /api/v1/widget/[slug]   │
└─────────────────────────────┘               └─────────────────────────────┘
                                     ▲
                                     │ (Gated by Subscription Tier)
                      ┌──────────────┴──────────────┐
                      │  Dodo Payments ($15/mo Pro) │
                      │  - /api/billing/checkout    │
                      │  - /api/webhooks/dodo       │
                      │  - Tier gating: Free vs Pro │
                      └─────────────────────────────┘
```

---

## Feature Inventory

Every feature discovered in Phase 0 Survey is cataloged below and assigned to an authoritative milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | GitHub Webhook Receiver | Handles `pull_request.closed` and tags with HMAC verification & mock bypass | M3 | R1 (Line 14) |
| 2 | PR Merge Filter | Distinguishes merged PRs from unmerged PR closures | M3 | R1 (Line 14) |
| 3 | PR Metadata Ingestion | Ingests PR title, body, author, labels, merged_at into accumulation queue | M3 | R1 (Line 15) |
| 4 | Noise Prefix Filter | Regex strips internal conventions: `^(chore\|ci\|test\|style\|refactor)(\(.*\))?:` | M3 | R1 (Line 16) |
| 5 | Exclusion Marker Filter | Filters out PRs containing markers `[skip]`, `[internal]`, or `[no-log]` | M3 | R1 (Line 16) |
| 6 | Gemini 1.5 Flash Synthesizer | Structured JSON transformation producing release notes & syndication drafts | M3 | R1 (Line 17) |
| 7 | Release Categorization | Strict JSON buckets: `features`, `improvements`, `fixes` | M3 | R1 (Line 17) |
| 8 | Multi-Channel Syndication Drafts | Generates `email_plain_text` and `social_post_thread` drafts | M3 | R1 (Line 17) |
| 9 | Hybrid Mode & Mock Fixtures | Live Gemini API execution with deterministic offline mock fallback for CI | M3 | R1 (Line 18) |
| 10 | Local Webhook Dispatcher CLI | Standalone CLI script to dispatch synthetic PR merge webhooks locally | M3 | R1 (Line 18) |
| 11 | Next.js 15 App Router | Modern App Router application with React 19 Server & Client Components | M1 | R2 (Line 22) |
| 12 | Tailwind & shadcn/ui Primitives | Styled UI primitives (Button, Card, Badge, Dialog, Tabs, etc.) | M1 | R2 (Line 22) |
| 13 | Supabase PostgreSQL Schema | Relational schema migrations for `users`, `installations`, `projects`, `changelogs`, `pull_requests` | M1 | R2 (Line 23) |
| 14 | Row-Level Security (RLS) | Multi-tenant isolation ensuring founders only access their own records | M1 | R2 (Line 23) |
| 15 | Repository Connection Workflow | Founder interface to link repositories to ShipLog projects | M4 | R2 (Line 24) |
| 16 | Unreleased PR Queue Dashboard | Interactive table displaying accumulated PRs with noise badges & exclude toggles | M4 | R2 (Line 24) |
| 17 | Release Generation Action | Founder trigger to run Gemini synthesis on accumulated unreleased PRs | M4 | R2 (Line 24) |
| 18 | Inline Markdown Release Editor | WYSIWYG/split-pane editor for reviewing and editing AI draft releases | M4 | R2 (Line 24) |
| 19 | One-Click Publishing Workflow | Publishes draft changelog to public portal and updates widget feed | M4 | R2 (Line 25) |
| 20 | Syndication Copy Actions | One-click clipboard copy for Email plain text and Twitter/X thread | M4 | R2 (Line 25) |
| 21 | Public SSR Changelog Portal | Fast SSR page at `/c/[slug]` with version timeline and category badges | M4 | R2 (Line 26) |
| 22 | Dynamic OpenGraph Meta Tags | Server-rendered OG and Twitter meta tags reflecting latest release info | M4 | R2 (Line 26) |
| 23 | Standalone Zero-Dependency Widget | Vanilla client bundle compiled via esbuild to `/public/widget.js` | M5 | R3 (Line 30) |
| 24 | Widget Bundle Size Constraint | Strict < 5 KB minified/gzipped verification for `/public/widget.js` | M5 | R3 (Line 30) |
| 25 | Scoped Shadow DOM Isolation | Inlined CSS with `all: initial;` reset preventing host styling conflicts | M5 | R3 (Line 31) |
| 26 | LocalStorage Unread Indicator | Notification bell launcher with red unread dot tracked in `localStorage` | M5 | R3 (Line 32) |
| 27 | Responsive Slide-Out Drawer | Slide-out overlay drawer rendering recent releases and category tags | M5 | R3 (Line 33) |
| 28 | Viral Badge Logic | Free tier renders "Powered by ShipLog"; Pro tier white-labels (suppressed) | M5 | R3 (Line 34) |
| 29 | Public Widget API with CORS | Edge-cacheable `/api/v1/widget/[slug]` with `Access-Control-Allow-Origin: *` | M5 | R3 (Line 35) |
| 30 | Dodo Payments Checkout Flow | Subscription checkout flow for $15/month Pro plan | M6 | R4 (Line 39) |
| 31 | Dodo Payments Webhook Receiver | Webhook handler for `subscription.created`, `updated`, `cancelled` | M6 | R4 (Line 40) |
| 32 | Webhook Idempotency Layer | Deduplication store preventing double-processing of webhook events | M6 | R4 (Line 40) |
| 33 | Development Signature Bypass | `x-mock-signature` header bypass for automated testing and offline CI | M6 | R4 (Line 41) |
| 34 | Tier Feature Gating Enforcement | Enforces limits (Free: 1 repo, 2 releases/mo, viral badge; Pro: unlimited, custom domain, white-label) | M6 | R4 (Line 42) |
| 35 | Automated Test Suite (`npm test`) | Vitest test suite covering noise filters, schemas, routes, and webhooks | M2, M7 | R5 (Line 46) |
| 36 | E2E Pipeline Simulation CLI | Standalone CLI (`npm run test:simulate`) validating end-to-end flow | M2, M7 | R5 (Line 47) |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Schema & UI Primitives | Next.js 15 App Router setup, Supabase PostgreSQL DDL & RLS migrations, Tailwind CSS, shadcn/ui components, Vitest config | none | DONE |
| M2 | E2E Testing Track Infrastructure | TEST_INFRA.md, 4-tier test suite (Tiers 1-4), simulation harness, publishes TEST_READY.md | M1 | DONE |
| M3 | GitHub Ingestion & Structured AI Pipeline | GitHub webhook receiver, regex noise filter, unreleased PR queue, Gemini 1.5 Flash structured synthesis with hybrid mock mode, local webhook dispatcher CLI | M1 | DONE |
| M4 | SaaS Dashboard & Public SSR Changelog Portal | Connect repo, unreleased queue UI, inline markdown editor, publish workflow, syndication copy drawers, SSR `/c/[slug]` with dynamic OG tags | M1, M3 | DONE |
| M5 | Standalone Embeddable In-App Widget (< 5 KB) | Zero-dependency TypeScript widget, Shadow DOM isolation, unread bell indicator with localStorage, slide-out drawer, viral badge logic, `/api/v1/widget/[slug]` CORS endpoint, bundle size check script | M1 | DONE |
| M6 | Monetization & Subscription Infrastructure | Dodo Payments checkout flow ($15/mo Pro), webhook receiver (`created`, `updated`, `cancelled`), signature verification with `x-mock-signature`, idempotency store, feature gating | M1, M4, M5 | DONE |
| M7 | Final Verification, E2E Pass & Coverage Hardening | Pass 100% of E2E tests (Tiers 1-4) from `TEST_READY.md`, run `npm test`, `npm run test:simulate`, `npm run check:widget-size`, `npm run build`, adversarial Tier 5 coverage hardening | M1-M6, TEST_READY.md | DONE |

---

## Interface Contracts

### 1. `lib/noise-filter` ↔ Ingestion Engine
```typescript
export interface PRMetadata {
  title: string;
  body?: string | null;
  labels?: string[];
  author?: string;
  pr_number: number;
}

export interface NoiseFilterResult {
  isNoise: boolean;
  reason?: 'convention_prefix' | 'exclusion_marker' | 'excluded_label';
  matchedRule?: string;
}

export function evaluatePRNoise(pr: PRMetadata): NoiseFilterResult;
```

### 2. `lib/gemini` ↔ Release Generator
```typescript
export interface PRContextItem {
  prNumber: number;
  title: string;
  body?: string;
  author: string;
  labels: string[];
  mergedAt: string;
}

export interface ReleaseCategories {
  features: string[];
  improvements: string[];
  fixes: string[];
}

export interface ReleaseDistribution {
  email_plain_text: string;
  social_post_thread: string[];
}

export interface GeminiReleaseOutput {
  release_title: string;
  overview_summary: string;
  categories: ReleaseCategories;
  distribution: ReleaseDistribution;
}

export interface ReleaseGeneratorClient {
  generateRelease(prs: PRContextItem[], versionTag: string): Promise<GeminiReleaseOutput>;
}
```

### 3. Public Widget API Contract (`/api/v1/widget/[slug]`)
```typescript
export interface WidgetApiResponse {
  project: {
    name: string;
    slug: string;
    is_pro: boolean;
    show_badge: boolean;
  };
  releases: Array<{
    id: string;
    version_tag: string;
    release_title: string;
    overview_summary: string;
    categories: {
      features: string[];
      improvements: string[];
      fixes: string[];
    };
    published_at: string;
  }>;
}
```

### 4. `lib/monetization` ↔ Feature Gating
```typescript
export interface TenantTierInfo {
  tier: 'free' | 'pro';
  active_repos_count: number;
  monthly_releases_count: number;
}

export interface FeatureGateVerdict {
  allowed: boolean;
  reason?: string;
  upgrade_required?: boolean;
}

export function checkCanConnectRepo(tenant: TenantTierInfo): FeatureGateVerdict;
export function checkCanPublishRelease(tenant: TenantTierInfo): FeatureGateVerdict;
export function checkShouldShowViralBadge(isPro: boolean): boolean;
```

---

## Code Layout

```
/home/alok/Projects_Antigravity/bsAK/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── projects/
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── releases/[releaseId]/page.tsx
│   │   └── billing/page.tsx
│   ├── (public)/
│   │   └── c/[slug]/page.tsx
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── github/route.ts
│   │   │   └── dodo/route.ts
│   │   ├── v1/widget/[slug]/route.ts
│   │   ├── projects/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── generate-release/route.ts
│   │   │       └── releases/[releaseId]/publish/route.ts
│   │   └── billing/checkout/route.ts
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── dashboard/
│   └── changelog/
├── lib/
│   ├── supabase/
│   ├── github/
│   ├── noise-filter/
│   ├── gemini/
│   ├── dodo/
│   └── monetization/
├── widget/
│   ├── src/
│   └── build.mjs
├── public/
│   └── widget.js
├── supabase/
│   └── migrations/
│       ├── 20260922000001_initial_schema.sql
│       └── 20260922000002_rls_policies.sql
├── scripts/
│   ├── simulate-pipeline.ts
│   ├── check-widget-size.ts
│   └── dispatch-mock-pr.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```
