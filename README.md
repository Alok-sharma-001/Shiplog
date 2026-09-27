# ShipLog 🚀

> **Automated GitHub-to-In-App Release & Retention Engine**
> Push code to GitHub. We turn your merged Pull Requests into user-facing in-app announcements, hosted changelogs, and social marketing drafts in seconds—with zero manual writing.

---

## ⚡ Key Features

- **Read-Only GitHub Ingestion**: Webhook integration (`pull_request.closed`) extracting titles, descriptions, authors, and labels.
- **Regex Noise Filter Engine**: Automatically strips non-user-facing PRs (`chore:`, `ci:`, `test:`, `style:`, `refactor:`) and exclusion tags (`[skip]`, `[internal]`, `[no-log]`).
- **Google Gemini 1.5 Flash Synthesis**: Formulates human-readable release notes categorized into Features, Improvements, and Fixes, plus ready-to-send email and X/Twitter announcement threads.
- **Ultra-Lightweight In-App Widget (< 5 KB)**: Standalone vanilla JS embed (`/widget.js`, ~3.1 KB raw / ~1.4 KB gzipped) with scoped Shadow DOM isolation, notification bell launcher, unread dot tracking via `localStorage`, and live release feed.
- **Server-Side Rendered (SSR) Public Changelog**: Fast public changelog portal at `/c/[slug]` with dynamic OpenGraph meta tags for preview embeds.
- **SaaS Founder Dashboard**: Connect repositories, review the unreleased queue, run one-click synthesis with an inline Markdown editor, and publish.
- **Monetization & Subscriptions**: Dodo Payments integration with $15/mo Pro tier gating, webhook signature validation, and idempotent event processing.

---

## 🏗 Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Tailwind CSS, Radix UI primitives, Lucide icons
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS)
- **AI Engine**: Google Gemini 1.5 Flash (`@google/genai`)
- **Payments**: Dodo Payments (Merchant of Record)
- **Testing**: Vitest, happy-dom, TypeScript 5.7

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create `.env.local` based on `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
DODO_PAYMENTS_API_KEY=your-dodo-api-key
DODO_WEBHOOK_SECRET=your-dodo-webhook-secret
```
*(Note: ShipLog includes deterministic mock fallbacks, allowing local development and testing to run seamlessly even without live API credentials).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or port 3001 if 3000 is occupied).

---

## 🧪 Verification & Quality Checks

Run the complete verification pipeline:
```bash
# Run all checks (typecheck, lint, 500 tests, bundle size audit, pipeline simulation, build)
npm run verify:all

# Run Vitest test suite (500/500 passing across 7 suites)
npm test

# Run End-to-End Pipeline Simulation CLI (6/6 stages passing)
npm run test:simulate

# Verify embeddable widget bundle size (< 5 KB strict limit)
npm run check:widget-size
```

---

## 📦 Embedding the Widget

Add the script and custom element to any web app:
```html
<script src="https://your-domain.com/widget.js" defer></script>
<shiplog-widget data-slug="your-project-slug"></shiplog-widget>
```

---

## 📄 License
MIT
