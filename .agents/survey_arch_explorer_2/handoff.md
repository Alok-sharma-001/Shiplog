# Handoff Report: ShipLog System Architecture & Technical Specifications

**Agent**: `survey_arch_explorer_2` (Survey Architecture Explorer 2)  
**Date**: 2026-09-22T17:23:00Z  
**Target Path**: `/home/alok/Projects_Antigravity/bsAK/.agents/survey_arch_explorer_2/handoff.md`  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  

---

## 1. Observation

Direct observations extracted from `/home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md`, `/home/alok/Projects_Antigravity/bsAK/.agents/survey_arch_explorer_2/DISPATCH.md`, and the execution environment:

1. **System Core Objective & Requirements (ORIGINAL_REQUEST.md:5-49)**:
   - *R1. GitHub Ingestion & Structured AI Pipeline*: Webhook receiver for `pull_request.closed` (merged status) and release/tag triggers. Accumulation queue for unreleased PRs. Regex noise filtering stripping `^(chore|ci|test|style|refactor)(\(.*\))?:` and exclusion markers `[skip]`, `[internal]`, `[no-log]`. Gemini 1.5 Flash structured JSON transformation with strict schema (`release_title`, `overview_summary`, `categories` with `features`/`improvements`/`fixes`, `distribution` with `email_plain_text`/`social_post_thread`). Hybrid live/deterministic mock mode and local webhook dispatcher CLI.
   - *R2. SaaS Dashboard & Public SSR Changelog Portal*: Next.js 15 App Router, Tailwind CSS, shadcn/ui primitives. Supabase PostgreSQL with RLS (`users`, `installations`, `projects`, `changelogs`). Founder dashboard with repository connection, unreleased queue, inline markdown editor, one-click publish & syndication copy (Email & Twitter/X thread). SSR public changelog at `/c/[slug]` with dynamic OpenGraph meta tags, version timeline, category badges, and sub-second load.
   - *R3. Standalone Embeddable In-App Widget (< 5 KB)*: Bundled client script at `/public/widget.js` (< 5 KB minified/gzipped). Scoped Shadow DOM with inlined CSS styles to eliminate CSS collisions. Bell launcher with `localStorage`-backed unread dot. Slide-out drawer with categorized releases. Viral "Powered by ShipLog" badge for Free tier, suppressed for Pro tier. Edge-cacheable public endpoint `/api/v1/widget/[slug]` with `Access-Control-Allow-Origin: *`.
   - *R4. Monetization & Subscription Infrastructure*: Dodo Payments integration for $15/mo Pro plan. Idempotent webhook receiver (`subscription.created`, `subscription.updated`, `subscription.cancelled`). Signature verification with `x-mock-signature` development bypass toggle. Feature gating: Free (1 repo, 2 releases/mo, viral badge) vs Pro (unlimited repos/releases, white-labeled, custom domain support).
   - *R5. Comprehensive Verification Suite & Tooling*: Automated test suite (`npm test`), E2E pipeline simulation script (`npm run test:simulate`), widget bundle size check (`npm run check:widget-size`), and production build verification (`npm run build`).

2. **Runtime Environment**:
   - Node.js: `v22.22.1`
   - npm: `9.2.0`
   - Platform: Linux x86_64
   - Next.js 15 App Router standard with React 19 Server Components.

3. **Gemini SDK Reference**:
   - Verified upstream `@google/genai` guidelines for Gemini 1.5 Flash structured output using `responseMimeType: "application/json"` and `responseJsonSchema` or `responseSchema`.

---

## 2. Logic Chain

From the observed requirements, we deduce the following architectural decisions and detailed designs:

### 2.1 Directory Structure & Code Layout

A clean monorepo/modular layout where Next.js 15 App Router hosts both the SaaS web application and public API routes, while dedicated libraries isolate external integrations (Supabase, GitHub, Gemini, Dodo) and the embeddable widget has its own dedicated build pipeline.

```
/home/alok/Projects_Antigravity/bsAK/
├── app/                                # Next.js 15 App Router
│   ├── (auth)/                         # Authentication route group
│   │   ├── login/
│   │   │   └── page.tsx                # Founder sign-in / GitHub OAuth login
│   │   └── callback/
│   │       └── route.ts                # Supabase Auth OAuth callback
│   ├── (dashboard)/                    # Protected founder dashboard route group
│   │   ├── layout.tsx                  # Dashboard layout (nav, user profile, tier badge)
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Projects overview & Quick actions
│   │   ├── projects/
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # Connect repository flow
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Project hub: unreleased queue & release history
│   │   │       ├── releases/
│   │   │       │   └── [releaseId]/
│   │   │       │       └── page.tsx    # Draft release editor & syndication center
│   │   │       └── settings/
│   │   │           └── page.tsx        # Project settings, widget embed snippet, tier status
│   │   └── billing/
│   │       └── page.tsx                # Dodo Payments checkout & subscription management
│   ├── (public)/                       # Public SSR portal route group
│   │   ├── layout.tsx                  # Public changelog layout (clean, zero admin JS)
│   │   └── c/
│   │       └── [slug]/
│   │           └── page.tsx            # SSR Hosted Public Changelog Portal (dynamic OG tags)
│   ├── api/                            # REST & Webhook endpoints
│   │   ├── webhooks/
│   │   │   ├── github/
│   │   │   │   └── route.ts            # GitHub App webhook receiver (PR merged, tags)
│   │   │   └── dodo/
│   │   │       └── route.ts            # Dodo Payments webhook receiver (subscriptions)
│   │   ├── v1/
│   │   │   └── widget/
│   │   │       └── [slug]/
│   │   │           └── route.ts        # Public edge-cacheable widget release feed with CORS
│   │   ├── projects/
│   │   │   ├── route.ts                # Create/list projects
│   │   │   └── [id]/
│   │   │       ├── generate-release/
│   │   │       │   └── route.ts        # Trigger Gemini 1.5 Flash synthesis on unreleased PRs
│   │   │       └── releases/
│   │   │           └── [releaseId]/
│   │   │               └── publish/
│   │   │                   └── route.ts# Publish draft changelog to public portal & widget
│   │   └── billing/
│   │       └── checkout/
│   │           └── route.ts            # Create Dodo Payments checkout session ($15/mo Pro)
│   ├── favicon.ico
│   ├── globals.css                     # Tailwind CSS v3/v4 root styles
│   └── layout.tsx                      # Root layout
├── components/                         # React UI Components
│   ├── ui/                             # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── textarea.tsx
│   │   ├── input.tsx
│   │   ├── separator.tsx
│   │   ├── toast.tsx
│   │   └── tooltip.tsx
│   ├── dashboard/                      # Dashboard client & server components
│   │   ├── unreleased-queue.tsx        # PR list with noise badges and manual exclude toggles
│   │   ├── release-editor.tsx          # Dual-pane Markdown/Structured editor with preview
│   │   ├── syndication-copy.tsx        # One-click Email & Twitter thread copy drawer
│   │   ├── connect-repo-modal.tsx      # GitHub App repository connection modal
│   │   └── project-card.tsx
│   └── changelog/                      # Public changelog components
│       ├── timeline-view.tsx           # Vertical version timeline
│       ├── category-badge.tsx          # Color-coded badge (Features, Improvements, Fixes)
│       ├── changelog-item.tsx          # Single release item with formatted markdown
│       └── viral-badge.tsx             # "Powered by ShipLog" link for free tier
├── lib/                                # Core Domain Modules
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client (`createBrowserClient`)
│   │   ├── server.ts                   # Server Supabase client with cookies (`createServerClient`)
│   │   ├── admin.ts                    # Service-role Supabase client for webhooks/background jobs
│   │   └── types.ts                    # Auto-generated TypeScript database definitions
│   ├── github/
│   │   ├── verify.ts                   # GitHub HMAC-SHA256 signature verification & mock bypass
│   │   ├── parser.ts                   # PR webhook event parser & metadata normalizer
│   │   └── types.ts                    # GitHub Webhook payload type definitions
│   ├── noise-filter/
│   │   ├── filter.ts                   # Regex noise filter engine & marker detector
│   │   ├── constants.ts                # Regex patterns and exclusion marker list
│   │   └── types.ts                    # Filter result contracts
│   ├── gemini/
│   │   ├── client.ts                   # Gemini 1.5 Flash structured client with fallback
│   │   ├── schema.ts                   # JSON schema for Gemini structured output
│   │   ├── prompt.ts                   # System & user prompt templates for PR synthesis
│   │   ├── mock-fixture.ts             # Deterministic mock release generator for offline/CI
│   │   └── types.ts                    # Gemini release notes output types
│   ├── dodo/
│   │   ├── client.ts                   # Dodo Payments API client (checkout sessions, subscriptions)
│   │   ├── verify.ts                   # HMAC signature verification & `x-mock-signature` bypass
│   │   └── types.ts                    # Dodo webhook event and payload types
│   ├── monetization/
│   │   ├── tiers.ts                    # Tier configurations: Free vs Pro
│   │   └── gates.ts                    # Permission guards (repo count, monthly release limits)
│   └── utils.ts                        # Shared formatting, date helpers, cn utility
├── widget/                             # Standalone In-App Widget (< 5 KB Target)
│   ├── src/
│   │   ├── index.ts                    # Widget entry point (auto-init or window.ShipLog.init)
│   │   ├── widget.ts                   # Core Shadow DOM class (bell launcher, drawer, release feed)
│   │   ├── styles.ts                   # Minified inlined CSS string (zero external stylesheet)
│   │   ├── storage.ts                  # localStorage read/unread state management
│   │   └── api.ts                      # Fetch helper for `/api/v1/widget/[slug]`
│   └── build.mjs                       # esbuild bundle script compiling to /public/widget.js
├── public/
│   ├── widget.js                       # Output compiled bundle (< 5 KB target)
│   └── og-default.png                  # Default OpenGraph fallback banner
├── supabase/
│   └── migrations/
│       ├── 20260922000001_initial_schema.sql  # Schema tables, indexes, constraints, triggers
│       └── 20260922000002_rls_policies.sql    # Row-Level Security policies
├── scripts/
│   ├── simulate-pipeline.ts            # E2E pipeline simulation script (`npm run test:simulate`)
│   ├── check-widget-size.ts            # Bundle size verification asserting < 5 KB (`npm run check:widget-size`)
│   └── dispatch-mock-pr.ts             # CLI tool to dispatch synthetic PR merge webhooks
├── tests/
│   ├── fixtures/                       # Deterministic PR and webhook payloads
│   │   ├── pr-feature.json
│   │   ├── pr-chore-noise.json
│   │   ├── pr-marker-skip.json
│   │   └── dodo-subscription-created.json
│   ├── unit/
│   │   ├── noise-filter.test.ts        # Exhaustive regex & marker filter unit tests
│   │   ├── gemini-schema.test.ts       # AI output JSON schema validation unit tests
│   │   ├── dodo-verify.test.ts         # Signature verification & mock bypass tests
│   │   └── tier-limits.test.ts         # Free vs Pro gating logic tests
│   ├── integration/
│   │   ├── github-webhook.test.ts      # Webhook ingestion -> queue insertion tests
│   │   ├── dodo-webhook.test.ts        # Dodo event handling -> tier update tests
│   │   └── widget-api.test.ts          # Public widget endpoint CORS & caching tests
│   └── e2e/
│       └── pipeline-simulation.test.ts # Full end-to-end flow test
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
└── README.md
```

---

### 2.2 Database Schema & Row-Level Security (RLS) Policies

The database is built on PostgreSQL via Supabase, with full relational integrity, foreign key cascades, JSONB flexibility for categorizations/syndications, and strict Row-Level Security.

#### 2.2.1 PostgreSQL DDL (`supabase/migrations/20260922000001_initial_schema.sql`)

```sql
-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    dodo_customer_id TEXT,
    dodo_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'inactive' 
        CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'past_due', 'on_hold')),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Installations Table (GitHub App Installations)
CREATE TABLE installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    github_installation_id BIGINT NOT NULL UNIQUE,
    account_login TEXT NOT NULL,
    account_id BIGINT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'User',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Projects Table (Connected Repositories / Portals)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    installation_id UUID REFERENCES installations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    is_pro_override BOOLEAN NOT NULL DEFAULT FALSE,
    custom_domain TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_repo UNIQUE (user_id, repo_full_name)
);

-- 4. Changelogs Table (Synthesized and Published Releases)
CREATE TABLE changelogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_tag TEXT NOT NULL,
    release_title TEXT NOT NULL,
    overview_summary TEXT NOT NULL,
    categories JSONB NOT NULL DEFAULT '{"features":[], "improvements":[], "fixes":[]}'::jsonb,
    distribution JSONB NOT NULL DEFAULT '{"email_plain_text":"", "social_post_thread":[]}'::jsonb,
    raw_markdown TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Pull Requests Table (Ingested PR Queue)
CREATE TABLE pull_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    changelog_id UUID REFERENCES changelogs(id) ON DELETE SET NULL,
    github_pr_id BIGINT NOT NULL,
    pr_number INT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    author_login TEXT NOT NULL,
    author_avatar_url TEXT,
    pr_url TEXT NOT NULL,
    merged_at TIMESTAMPTZ NOT NULL,
    is_filtered BOOLEAN NOT NULL DEFAULT FALSE,
    filter_reason TEXT,
    status TEXT NOT NULL DEFAULT 'unreleased' CHECK (status IN ('unreleased', 'released', 'excluded')),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_pr UNIQUE (project_id, pr_number)
);

-- 6. Dodo Webhook Events (Idempotency Store)
CREATE TABLE dodo_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-throughput lookup
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_repo_full_name ON projects(repo_full_name);
CREATE INDEX idx_pull_requests_project_status ON pull_requests(project_id, status);
CREATE INDEX idx_pull_requests_project_merged ON pull_requests(project_id, merged_at DESC);
CREATE INDEX idx_changelogs_project_published ON changelogs(project_id, is_published, published_at DESC);
CREATE INDEX idx_changelogs_published_at ON changelogs(published_at DESC);
CREATE INDEX idx_dodo_events_event_id ON dodo_webhook_events(event_id);

-- Auto-update timestamps trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_changelogs_updated_at BEFORE UPDATE ON changelogs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

#### 2.2.2 Row-Level Security Policies (`supabase/migrations/20260922000002_rls_policies.sql`)

```sql
-- Enable RLS on all operational tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dodo_webhook_events ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- 2. Installations Policies
CREATE POLICY "Users can view own installations"
    ON installations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own installations"
    ON installations FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Projects Policies
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (auth.uid() = user_id);

-- Public read access to basic project info by slug (for public portal / widget)
CREATE POLICY "Public read project info by slug"
    ON projects FOR SELECT
    USING (true);

-- 4. Pull Requests Policies
CREATE POLICY "Project owners can manage pull requests"
    ON pull_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = pull_requests.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- 5. Changelogs Policies
CREATE POLICY "Project owners can manage changelogs"
    ON changelogs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = changelogs.project_id
              AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Public read published changelogs"
    ON changelogs FOR SELECT
    USING (is_published = true);

-- 6. Dodo Webhook Events: No public/user access (Service role only)
```

---

### 2.3 GitHub Ingestion & Structured AI Pipeline Architecture

#### 2.3.1 Webhook Ingestion Engine (`/api/webhooks/github`)
- **Signature Verification**: Validates `x-hub-signature-256` HMAC-SHA256 against `GITHUB_WEBHOOK_SECRET`.
- **Test/Offline Bypass**: In non-production environments (`process.env.NODE_ENV !== 'production'`), if header `x-mock-signature: test_bypass` is supplied, HMAC verification is safely bypassed.
- **Event Filter**: Filters for `x-github-event: pull_request` where payload `action === 'closed'` and `pull_request.merged === true`.
- **Target Project Lookup**: Queries `projects` by `repo_full_name` (`repository.full_name`). If not found, attempts `installation_id`.
- **Queue Storage**: Extracts PR attributes and runs the Noise Filter. Inserts the record into `pull_requests` with either `status: 'unreleased'` (if kept) or `status: 'excluded'` (if noise).

#### 2.3.2 Regex Noise Filter Engine (`lib/noise-filter/filter.ts`)
The filter performs deterministic two-stage evaluation:

1. **Prefix Convention Filter**:
   - Evaluates title against:  
     `const CONVENTIONAL_NOISE_REGEX = /^(chore|ci|test|style|refactor)(\([a-zA-Z0-9_\-./]+\))?:\s*/i;`
   - Strips internal commits (`chore: update deps`, `ci(github): add workflow`, `test: add unit tests`, `refactor(db): rename column`, `style: fix whitespace`).
   - Retains customer-valuable items: `feat:`, `feat(ui):`, `fix:`, `fix(auth):`, `perf:`, `docs:` (when customer-facing), and plain descriptive titles (`"Add Dark Mode Support"`, `"Resolve race condition in payment checkout"`).

2. **Exclusion Marker Filter**:
   - Searches PR title and body for explicit suppression markers:  
     `const EXCLUSION_MARKERS_REGEX = /\[(skip|internal|no-log)\]/i;`
   - If present in title or body, automatically sets `isFiltered = true` with reason `marker: [skip]`.

3. **Label Filter**:
   - Evaluates PR labels against exclusion list: `['chore', 'ci', 'skip-changelog', 'internal', 'no-log', 'testing']`.

#### 2.3.3 Gemini 1.5 Flash Structured Transformation Engine (`lib/gemini/`)
When release generation is triggered:
1. **Unreleased PR Batch Fetching**: Fetches all rows from `pull_requests` where `project_id = :id AND status = 'unreleased' AND is_filtered = false`.
2. **Context Compilation**: Formats the PR titles, numbers, authors, labels, and summaries into a compact markdown context.
3. **Structured Generation**:
   - Model: `gemini-1.5-flash`
   - Config:
     - `responseMimeType: "application/json"`
     - `responseSchema`: Strict JSON schema enforced by the Gemini engine.
     ```typescript
     export const releaseNotesJsonSchema = {
       type: "object",
       properties: {
         release_title: {
           type: "string",
           description: "Catchy, concise marketing release title (e.g. 'v1.4.0 — Supercharged Search & Dark Mode')"
         },
         overview_summary: {
           type: "string",
           description: "2-3 sentence engaging overview of this release for end users."
         },
         categories: {
           type: "object",
           properties: {
             features: {
               type: "array",
               items: { type: "string" },
               description: "User-facing new capabilities."
             },
             improvements: {
               type: "array",
               items: { type: "string" },
               description: "Performance enhancements, UX polishes, or minor updates."
             },
             fixes: {
               type: "array",
               items: { type: "string" },
               description: "Resolved bugs or customer issues."
             }
           },
           required: ["features", "improvements", "fixes"]
         },
         distribution: {
           type: "object",
           properties: {
             email_plain_text: {
               type: "string",
               description: "Formatted plain-text newsletter ready to send via customer email lists."
             },
             social_post_thread: {
               type: "array",
               items: { type: "string" },
               description: "A cohesive X/Twitter thread of concise tweets (< 280 characters each)."
             }
           },
           required: ["email_plain_text", "social_post_thread"]
         }
       },
       required: ["release_title", "overview_summary", "categories", "distribution"]
     };
     ```
4. **Hybrid Mode & Deterministic Mock Engine (`lib/gemini/mock-fixture.ts`)**:
   - Condition: If `process.env.MOCK_GEMINI === 'true'` OR `!process.env.GEMINI_API_KEY` OR in test runner (`process.env.NODE_ENV === 'test'`), the engine bypasses external network requests and executes the deterministic mock generator.
   - Mock Generator Logic:
     - Parses input PRs.
     - Maps `feat:` or `"add"` keywords -> `features`.
     - Maps `fix:` or `"resolve"` keywords -> `fixes`.
     - Maps `perf:` or `"improve"` keywords -> `improvements`.
     - Synthesizes formatted `email_plain_text` and a 3-part `social_post_thread` guaranteed to adhere 100% to the JSON schema.
     - Guarantees deterministic, zero-latency, zero-cost CI testing and offline reproducibility.

5. **Local Webhook Dispatcher CLI (`scripts/dispatch-mock-pr.ts`)**:
   - A standalone Node/TypeScript script allowing engineers to dispatch synthetic GitHub PR events:
     ```bash
     npx tsx scripts/dispatch-mock-pr.ts \
       --repo "owner/repo" \
       --number 42 \
       --title "feat(billing): add Dodo Payments checkout flow" \
       --author "developer" \
       --url "http://localhost:3000/api/webhooks/github"
     ```

---

### 2.4 SaaS Dashboard UI & SSR Public Changelog Architecture

#### 2.4.1 Route Topology & Component Boundaries (Next.js 15 App Router)

| Route Path | Type | Role & Responsibilities |
|---|---|---|
| `app/(auth)/login/page.tsx` | Client | GitHub OAuth login trigger and email magic link input |
| `app/(dashboard)/layout.tsx` | Server | Validates Supabase session, fetches user profile & tier |
| `app/(dashboard)/dashboard/page.tsx` | Server | Lists connected projects, recent releases, quick stats |
| `app/(dashboard)/projects/[id]/page.tsx` | Server | Loads unreleased PR queue and changelog history |
| `components/dashboard/unreleased-queue.tsx` | Client | Interactive table with noise badges, manual exclude toggles, and "Synthesize Release Notes" trigger |
| `components/dashboard/release-editor.tsx` | Client | Split-screen or tabbed Markdown editor with live preview, category pills editor, and draft saver |
| `components/dashboard/syndication-copy.tsx` | Client | One-click copy drawers for Email newsletter text and X/Twitter thread cards with character count indicators |
| `app/(dashboard)/billing/page.tsx` | Server/Client | Tier comparison (Free vs Pro), upgrade checkout button calling Dodo Payments API |
| `app/(public)/c/[slug]/page.tsx` | **Server (SSR)** | **Public hosted changelog portal**. Server-side data fetching with zero admin JS bundle. Sub-second load. |

#### 2.4.2 SSR Public Portal & Dynamic OpenGraph Metadata (`/c/[slug]`)
Next.js 15 Server Component with `generateMetadata`:

```typescript
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  const latestRelease = await getLatestPublishedRelease(project.id);

  const title = `${project.name} Changelog & Product Updates`;
  const description = latestRelease ? latestRelease.overview_summary : `Stay up to date with new features and fixes from ${project.name}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://shiplog.dev/c/${slug}`,
      siteName: 'ShipLog'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}
```

The page renders:
- Project Header (Name, Repo badge, RSS/Atom feed link).
- Chronological Timeline of published changelogs.
- Each release item displays:
  - Version Tag & Title (`h2`).
  - Formatted publish date.
  - Category badges (`Features` in Emerald, `Improvements` in Blue, `Fixes` in Amber).
  - Markdown rendered body with bullet points.
- Footer with conditional viral badge:
  - If `!project.is_pro && !project.is_pro_override`: renders `<p>Powered by <a href="https://shiplog.dev">ShipLog</a></p>`.
  - If `project.is_pro`: badge is completely omitted.

---

### 2.5 Standalone Embeddable In-App Widget Architecture (< 5 KB Target)

#### 2.5.1 Zero-Dependency Vanilla Architecture
To meet the strict `< 5 KB` minified/gzipped constraint, the widget is built with **zero external runtime libraries** (no React, no Preact, no heavy icon libraries). It uses raw TypeScript compiling directly to an IIFE bundle via esbuild.

#### 2.5.2 Shadow DOM Style Isolation
- The widget creates a host container: `const container = document.createElement('shiplog-widget');`
- Attaches an isolated Shadow Root: `const shadow = container.attachShadow({ mode: 'open' });`
- Inlines minified CSS inside a `<style>` element inside the Shadow Root.
- **CSS Isolation Guarantee**:
  - Resets all inherited styles: `all: initial;`
  - High stacking context: `z-index: 2147483647;`
  - System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;`
  - Zero selector leakage into host SaaS application, zero bleed-in from host stylesheet.

#### 2.5.3 Widget Anatomy
1. **Floating Launcher Button**:
   - Circular button fixed at bottom-right (24px offset).
   - SVG bell icon.
   - Red unread indicator dot (`display: none` by default; set to `display: block` when unread releases exist).
2. **Slide-Out Drawer / Modal**:
   - Fixed side sheet (width: 380px, max-width: 90vw).
   - Header with Project Name and Close (`×`) button.
   - Scrollable release feed container.
   - Category tags (`Features`, `Improvements`, `Fixes`).
   - Bulleted summary points.
3. **Viral Badge Logic**:
   - Condition: `if (!data.project.is_pro)`:
     - Injects footer `<a href="https://shiplog.dev?ref=${slug}" target="_blank" class="sl-footer">⚡ Powered by ShipLog</a>`.
   - If `data.project.is_pro === true`:
     - Footer element is omitted from the DOM entirely.

#### 2.5.4 LocalStorage Unread State Management
- Storage Key: `shiplog_last_read_${slug}`.
- When widget mounts and loads releases:
  - Reads `const lastRead = localStorage.getItem('shiplog_last_read_' + slug);`
  - If `!lastRead` or `new Date(releases[0].published_at) > new Date(lastRead)`:
    - Sets bell unread dot visible.
- When user clicks bell launcher to open drawer:
  - Hides the unread dot.
  - Updates `localStorage.setItem('shiplog_last_read_' + slug, releases[0].published_at);`

#### 2.5.5 Public Edge-Cacheable Widget API (`/api/v1/widget/[slug]`)
- HTTP Method: `GET`, `OPTIONS`
- Response Headers:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- Response Payload Schema:
  ```json
  {
    "project": {
      "name": "Acme SaaS",
      "slug": "acme",
      "is_pro": false
    },
    "releases": [
      {
        "id": "c1f7b8...",
        "version_tag": "v1.2.0",
        "release_title": "Dark Mode & Team Roles",
        "overview_summary": "Major improvements to team collaboration and workspace theming.",
        "categories": {
          "features": ["Dark Mode toggle in profile settings", "Team RBAC with Editor and Viewer roles"],
          "improvements": ["50% faster dashboard query performance"],
          "fixes": ["Resolved avatar image upload timeout"]
        },
        "published_at": "2026-09-22T12:00:00Z"
      }
    ]
  }
  ```

#### 2.5.6 esbuild Bundling & Automated Size Verification Pipeline
- Build Script (`widget/build.mjs`):
  ```javascript
  import * as esbuild from 'esbuild';

  await esbuild.build({
    entryPoints: ['widget/src/index.ts'],
    outfile: 'public/widget.js',
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'ShipLogWidget',
    target: ['es2020'],
    legalComments: 'none',
  });
  ```
- Verification Script (`scripts/check-widget-size.ts`):
  ```typescript
  import fs from 'fs';
  import zlib from 'zlib';

  const file = 'public/widget.js';
  const content = fs.readFileSync(file);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content).length;

  console.log(`Widget size: raw = ${rawSize} bytes, gzipped = ${gzipSize} bytes`);
  const MAX_BYTES = 5120; // 5 KB

  if (gzipSize > MAX_BYTES) {
    console.error(`FAILURE: Widget exceeds 5 KB limit (${gzipSize} bytes > ${MAX_BYTES} bytes)`);
    process.exit(1);
  }
  console.log(`SUCCESS: Widget bundle size verified under 5 KB.`);
  ```

---

### 2.6 Monetization & Subscription Infrastructure (Dodo Payments)

#### 2.6.1 Dodo Payments Merchant of Record Architecture
- **Plan**: Pro Plan at `$15/month`.
- **Checkout Endpoint** (`/api/billing/checkout`):
  - Authenticated user initiates upgrade.
  - Server calls Dodo Payments API `POST /subscriptions` or `/checkouts` with:
    - `product_id: process.env.DODO_PRO_PRODUCT_ID`
    - `customer: { email: user.email, name: user.name }`
    - `return_url: `${APP_URL}/dashboard/billing?status=success``
  - Returns `checkout_url` to client for redirect.

#### 2.6.2 Webhook Processing (`/api/webhooks/dodo`)
- **Signature Verification**:
  - Reads `x-dodo-signature` header.
  - Calculates HMAC-SHA256 of raw request body using `DODO_WEBHOOK_SECRET`.
  - Compares signatures using timing-safe comparison (`crypto.timingSafeEqual`).
  - **Mock Signature Bypass**:
    - If `process.env.NODE_ENV !== 'production'` and header `x-mock-signature: test_bypass` is present, verification succeeds immediately.
- **Idempotency**:
  - Extracts `event_id` from payload.
  - Executes `INSERT INTO dodo_webhook_events (event_id, event_type, payload) VALUES (...) ON CONFLICT (event_id) DO NOTHING`.
  - If duplicate event is detected, returns `HTTP 200 { status: "already_processed" }`.
- **Event Lifecycle Handlers**:
  1. `subscription.created` / `payment.succeeded`:
     - Sets `profiles.tier = 'pro'`.
     - Sets `profiles.subscription_status = 'active'`.
     - Records `dodo_subscription_id` and `dodo_customer_id`.
  2. `subscription.updated`:
     - Updates `subscription_status` (e.g. `active`, `past_due`, `on_hold`) and `current_period_end`.
  3. `subscription.cancelled` / `subscription.expired`:
     - Sets `profiles.tier = 'free'`.
     - Sets `profiles.subscription_status = 'cancelled'`.

#### 2.6.3 Feature Gating Matrix (`lib/monetization/gates.ts`)

| Feature Capability | Free Tier | Pro Tier ($15/mo) | Enforcement Mechanism |
|---|---|---|---|
| Connected Repositories | Max 1 repository | Unlimited | Checked during repo connection API (`COUNT(projects) < 1`) |
| Monthly Release Generations | Max 2 releases / month | Unlimited | Checked before Gemini release trigger (`COUNT(releases in current month) < 2`) |
| Standalone Widget Badge | "⚡ Powered by ShipLog" visible | **White-labeled** (badge hidden) | Evaluated in `/api/v1/widget/[slug]` payload (`project.is_pro`) |
| Public Changelog Branding | "Powered by ShipLog" in footer | **White-labeled** | Evaluated during `/c/[slug]` SSR rendering |
| Custom Domain Support | Not available | Supported | Routing middleware matches custom host header |

---

### 2.7 Module Interface Contracts & TypeScript Types

#### 2.7.1 Noise Filter Contract (`lib/noise-filter/types.ts`)
```typescript
export interface NoiseFilterInput {
  title: string;
  body?: string | null;
  labels?: string[];
}

export interface NoiseFilterResult {
  isFiltered: boolean;
  reason?: string;
  matchedPattern?: string;
}
```

#### 2.7.2 Gemini Transformation Contract (`lib/gemini/types.ts`)
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

#### 2.7.3 GitHub Webhook Payload Contract (`lib/github/types.ts`)
```typescript
export interface GitHubPullRequestEvent {
  action: 'opened' | 'closed' | 'reopened' | 'labeled' | 'unlabeled';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    merged: boolean;
    merged_at: string | null;
    user: {
      login: string;
      avatar_url: string;
    };
    labels: Array<{
      name: string;
    }>;
  };
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
}
```

#### 2.7.4 Widget Public Feed Contract (`lib/widget/types.ts`)
```typescript
export interface WidgetProjectMeta {
  name: string;
  slug: string;
  is_pro: boolean;
}

export interface WidgetReleaseItem {
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
}

export interface WidgetFeedResponse {
  project: WidgetProjectMeta;
  releases: WidgetReleaseItem[];
}
```

#### 2.7.5 Dodo Payments Webhook Contract (`lib/dodo/types.ts`)
```typescript
export type DodoWebhookEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'payment.succeeded'
  | 'payment.failed';

export interface DodoWebhookPayload {
  event_id: string;
  event_type: DodoWebhookEventType;
  data: {
    subscription_id?: string;
    customer_id: string;
    product_id: string;
    status: string;
    customer_email: string;
    customer_name?: string;
    current_period_end?: string;
    metadata?: Record<string, string>;
  };
  created_at: string;
}
```

#### 2.7.6 Standard API Envelope Contract (`lib/types/api.ts`)
```typescript
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
```

---

## 3. Caveats

1. **Supabase Local Development vs Cloud**: The architecture supports both local Supabase development (`npx supabase start`) and remote Supabase projects. For CI and local test automation, mock Supabase clients and deterministic in-memory fixtures ensure tests run without requiring a live external database instance.
2. **Gemini Rate Limits**: While Gemini 1.5 Flash provides generous free tier quotas, in high-frequency production use cases, release synthesis should be invoked asynchronously or queued. For the current scope, founder-initiated releases on batches of PRs fit well within standard interactive request latencies (< 3-5 seconds).
3. **Shadow DOM Customization Scope**: The widget's Shadow DOM guarantees style isolation, which prevents host application CSS from breaking the widget. However, if a Pro-tier host desires custom widget theming, CSS Custom Properties (e.g., `--shiplog-primary-color`) can be pierced into the Shadow DOM as an intentional opt-in styling interface.
4. **No Direct Code Modifications**: As an Architecture Explorer, no application source files have been authored or modified during this investigation. Implementation must proceed in Phase 1 per the Orchestrator's milestones.

---

## 4. Conclusion

The system architecture for ShipLog is completely specified, robust, and directly maps to all functional and non-functional requirements (R1–R5).

1. **Next.js 15 App Router & Server/Client Boundary**: Provides sub-second Server-Side Rendering for public changelog portals (`/c/[slug]`) and dynamic OpenGraph social banners, while keeping administrative and syndication features interactive through lightweight Client Components.
2. **Database Integrity & RLS**: PostgreSQL schema enforces foreign key cascades, unique constraints, and strict Row-Level Security separating private founder repositories and draft releases from public changelog consumers.
3. **Deterministic Hybrid AI Ingestion**: The dual-mode pipeline guarantees seamless local development and automated CI through deterministic PR mock synthesis and HMAC signature bypasses, while supporting production Google Gemini 1.5 Flash structured JSON transformations.
4. **Sub-5 KB Isolated Widget**: The zero-dependency esbuild-compiled Shadow DOM widget satisfies style isolation, localStorage unread dot tracking, and viral tier enforcement while staying well below the 5 KB ceiling.
5. **Dodo Payments Monetization**: Idempotent webhook processing and centralized feature gating cleanly enforce Free vs Pro tier limitations.

Implementation teams can immediately execute Phase 1 milestones (M1–M5) using these architectural blueprints and interface contracts.

---

## 5. Verification Method

To independently verify the architectural soundness and future code deliverables against this specification:

1. **Database Schema & Migration Verification**:
   - Inspect SQL migrations in `supabase/migrations/`.
   - Verify all 6 tables (`profiles`, `installations`, `projects`, `changelogs`, `pull_requests`, `dodo_webhook_events`) exist with declared constraints and RLS policies.
   - Invalidation condition: Missing foreign key cascade on `projects(user_id)` or absent public select policy on `changelogs(is_published = true)`.

2. **Regex Noise Filter Unit Suite**:
   - Command: `npm test tests/unit/noise-filter.test.ts`
   - Verify exclusion of `chore:`, `ci:`, `test:`, `style:`, `refactor:`, `[skip]`, `[internal]`, `[no-log]`.
   - Verify preservation of `feat:`, `fix:`, `perf:`, and non-prefixed feature titles.
   - Invalidation condition: Any legitimate bug fix or feature being excluded, or any `chore:` being added to the unreleased queue.

3. **Gemini 1.5 Flash Schema & Mock Fixture Verification**:
   - Command: `npm test tests/unit/gemini-schema.test.ts`
   - Verify that deterministic mock outputs conform strictly to the required JSON schema with all required keys (`release_title`, `overview_summary`, `categories`, `distribution`).
   - Invalidation condition: Missing `email_plain_text` or `social_post_thread` keys, or tweets exceeding 280 characters.

4. **Widget Bundle Size Check**:
   - Command: `npm run check:widget-size`
   - Asserts `public/widget.js` gzipped size < 5120 bytes.
   - Invalidation condition: Bundle size >= 5120 bytes or inclusion of external framework runtimes (React/Preact) in the widget build.

5. **End-to-End Pipeline Simulation**:
   - Command: `npm run test:simulate`
   - Executes: Synthetic PR merge -> Queue insertion -> Gemini structured synthesis -> Release draft creation -> Publish action -> Public `/api/v1/widget/[slug]` assertion.
   - Invalidation condition: Pipeline fails at any stage or public widget API fails to return the newly published release.

6. **Next.js Production Build**:
   - Command: `npm run build`
   - Invalidation condition: TypeScript compilation errors or ESLint violations.
