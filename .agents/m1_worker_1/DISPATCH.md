# M1 Worker Dispatch: Foundation, Schema & UI Primitives

## Identity
- Role: Milestone 1 Worker
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/m1_worker_1
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Mandatory Reading Before Starting Work
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/m1_explorer_1_gen2/handoff.md
4. /home/alok/Projects_Antigravity/bsAK/.agents/m1_explorer_2/handoff.md
5. /home/alok/Projects_Antigravity/bsAK/.agents/m1_explorer_3/handoff.md

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusive Write Ownership
You exclusively own and may create/modify these files:
- `package.json`
- `tsconfig.json`
- `tailwind.config.ts`
- `postcss.config.mjs`
- `components.json`
- `next.config.mjs`
- `.eslintrc.json`
- `.gitignore`
- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `lib/utils.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`
- `lib/supabase/types.ts`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/dialog.tsx`
- `components/ui/tabs.tsx`
- `components/ui/textarea.tsx`
- `components/ui/input.tsx`
- `components/ui/separator.tsx`
- `components/ui/tooltip.tsx`
- `components/ui/toast.tsx`
- `components/ui/toaster.tsx`
- `components/ui/use-toast.ts`
- `supabase/migrations/20260922000001_initial_schema.sql`
- `supabase/migrations/20260922000002_rls_policies.sql`
- `tests/mocks/mock-supabase.ts`
- `vitest.config.ts`
- `tests/unit/foundation.test.ts`

## Step-by-Step Execution Plan
1. Create all configuration and scaffolding files:
   - `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, `next.config.mjs`, `.eslintrc.json`, `.gitignore` exactly per `.agents/m1_explorer_1_gen2/handoff.md`.
2. Install dependencies:
   - Run `npm install` (use `--prefer-offline` if needed, utilizing local npm cache).
3. Implement Next.js 15 root layout and styling:
   - `app/globals.css` (Tailwind layers & CSS variables).
   - `app/layout.tsx` (system font stack avoiding remote font requests).
   - `app/page.tsx` (responsive hero landing page).
4. Implement utilities and Supabase client layer:
   - `lib/utils.ts` (`cn()` helper, date formatting, truncation).
   - `lib/supabase/types.ts` (strongly typed database interfaces).
   - `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`.
5. Implement shadcn/ui component primitives in `components/ui/`:
   - `button.tsx`, `card.tsx`, `badge.tsx` (with feature/improvement/fix/noise variants), `dialog.tsx`, `tabs.tsx`, `textarea.tsx`, `input.tsx`, `separator.tsx`, `tooltip.tsx`, `toast.tsx`, `toaster.tsx`, `use-toast.ts`.
6. Implement Supabase PostgreSQL migrations:
   - `supabase/migrations/20260922000001_initial_schema.sql` (profiles, installations, projects, changelogs, pull_requests, dodo_webhook_events, indexes, sync triggers, handle_new_user trigger).
   - `supabase/migrations/20260922000002_rls_policies.sql` (multi-tenant RLS and public read policies).
7. Implement offline testing infrastructure:
   - `tests/mocks/mock-supabase.ts` (in-memory chainable client for offline testing).
   - `vitest.config.ts` (happy-dom, alias @/*).
   - `tests/unit/foundation.test.ts` (testing migrations DDL integrity, RLS policies, utilities, UI primitives, and Supabase client factories).
8. Verify everything:
   - Run `npm run typecheck` (assert 0 errors).
   - Run `npm test` (assert 100% passing tests).
   - Run `npm run lint` (assert 0 errors).
   - Run `npm run build` (assert Next.js production build succeeds).
9. Write your detailed handoff report to `.agents/m1_worker_1/handoff.md` and message parent via `send_message`.
