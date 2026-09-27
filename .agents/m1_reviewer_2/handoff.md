# Milestone 1 Database & Security Review Report

**Agent**: `m1_reviewer_2` (Milestone 1 Reviewer 2 — Database & Security Reviewer / Adversarial Critic)  
**Date**: 2026-09-22T18:26:00Z  
**Working Directory**: `/home/alok/Projects_Antigravity/bsAK/.agents/m1_reviewer_2`  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  
**Target Deliverables**: Database migrations, RLS policies, TypeScript types, Supabase client factories  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Test Suite & Build Verification
1. **`npm test`**:
   - Command: `npm test` (`vitest run`)
   - Result: 11 tests passed across 4 suites in 37ms (Duration 2.10s). Exit code 0.
   - Output log:
     ```
     ✓ tests/unit/foundation.test.ts (11 tests) 37ms
       ✓ Milestone 1 Foundation Verification Suite > 1. Database Schema & Migration SQL Verification > should have initial schema migration file present and valid 2ms
       ✓ Milestone 1 Foundation Verification Suite > 1. Database Schema & Migration SQL Verification > should have RLS policies migration file present and valid 0ms
       ✓ Milestone 1 Foundation Verification Suite > 2. Utility Functions (lib/utils.ts) > cn() correctly merges classes and eliminates Tailwind conflicts 5ms
       ✓ Milestone 1 Foundation Verification Suite > 2. Utility Functions (lib/utils.ts) > formatDate() formats timestamps cleanly 12ms
       ✓ Milestone 1 Foundation Verification Suite > 2. Utility Functions (lib/utils.ts) > truncate() truncates text beyond maximum length 0ms
       ✓ Milestone 1 Foundation Verification Suite > 3. UI Primitives Instantiation & Variants > buttonVariants generates correct classes for all variants and sizes 1ms
       ✓ Milestone 1 Foundation Verification Suite > 3. UI Primitives Instantiation & Variants > badgeVariants includes ShipLog domain categories and noise variants 0ms
       ✓ Milestone 1 Foundation Verification Suite > 3. UI Primitives Instantiation & Variants > all primitive components are defined and exportable 1ms
       ✓ Milestone 1 Foundation Verification Suite > 4. Supabase Client Factories & Mock Query Harness > browser client factory returns valid client object with from and auth methods 7ms
       ✓ Milestone 1 Foundation Verification Suite > 4. Supabase Client Factories & Mock Query Harness > admin client factory returns valid service-role client 4ms
       ✓ Milestone 1 Foundation Verification Suite > 4. Supabase Client Factories & Mock Query Harness > mock client harness supports CRUD and query chaining offline 2ms
     ```
2. **`npm run typecheck`**:
   - Command: `tsc --noEmit`
   - Result: 0 errors, exit code 0.
3. **`npm run lint`**:
   - Command: `next lint`
   - Result: "No ESLint warnings or errors", exit code 0.
4. **`npm run build`**:
   - Command: `next build`
   - Result: "Compiled successfully in 1233ms", static routes `/` and `/_not-found` generated, exit code 0.

### 1.2 Inspection of Database Migrations & RLS Policies
1. **`supabase/migrations/20260922000002_rls_policies.sql:91-94`**:
   ```sql
   -- Public read access to basic project metadata (needed for /c/[slug] & /api/v1/widget/[slug])
   CREATE POLICY "Public read project info by slug"
       ON public.projects FOR SELECT
       TO anon, authenticated
       USING (true);
   ```
2. **`supabase/migrations/20260922000001_initial_schema.sql:66`**:
   ```sql
   webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
   ```
3. **`supabase/migrations/20260922000002_rls_policies.sql:22-26`**:
   ```sql
   -- Authenticated users can update their own profile
   CREATE POLICY "Users can update own profile"
       ON public.profiles FOR UPDATE
       TO authenticated
       USING (auth.uid() = id)
       WITH CHECK (auth.uid() = id);
   ```
4. **`supabase/migrations/20260922000001_initial_schema.sql:183-196`**:
   ```sql
   -- Synchronize publish boolean & status
   IF NEW.is_published = TRUE AND (NEW.status IS NULL OR NEW.status = 'draft') THEN
       NEW.status = 'published';
   ELSIF NEW.status = 'published' THEN
       NEW.is_published = TRUE;
   ELSIF NEW.is_published = FALSE AND (NEW.status IS NULL OR NEW.status = 'published') THEN
       NEW.status = 'draft';
   ELSIF NEW.status = 'draft' THEN
       NEW.is_published = FALSE;
   END IF;
   ```
5. **`supabase/migrations/20260922000001_initial_schema.sql:237-243`**:
   ```sql
   -- Sync status and noise filter
   IF NEW.is_filtered = TRUE AND NEW.status NOT IN ('excluded', 'filtered') THEN
       NEW.status = 'excluded';
   ELSIF NEW.status IN ('excluded', 'filtered') THEN
       NEW.is_filtered = TRUE;
   END IF;
   ```
6. **`tests/unit/foundation.test.ts:38-78`**:
   The migration verification test does not execute SQL against a PostgreSQL engine. It performs substring matches (`toContain`) on the raw SQL text:
   ```typescript
   expect(sql).toContain('auth.uid() = id');
   expect(sql).toContain('auth.uid() = user_id');
   expect(sql).toContain('Public read published changelogs');
   expect(sql).toContain('is_published = true');
   ```

### 1.3 Live Empirical PostgreSQL 16 Stress-Test Results
An isolated, clean PostgreSQL 16 container (`postgres:16-alpine`) was spun up to test both migrations and RLS evaluation:
- Both migration files (`20260922000001_initial_schema.sql` and `20260922000002_rls_policies.sql`) executed with code 0 without syntax errors.
- **RLS Leak Verification**:
  - Two users Alice (`1111...`) and Bob (`2222...`) each inserted a project.
  - When Bob ran `SELECT id, user_id, name, slug, webhook_secret FROM public.projects;`, Postgres returned BOTH Alice's project (including `secret_alice_123`) and Bob's project.
  - When role `anon` ran `SELECT id, user_id, name, slug, webhook_secret FROM public.projects;`, Postgres returned ALL projects and secrets.
- **Privilege Escalation Verification**:
  - Alice, an authenticated user initialized on `tier = 'free'`, executed:
    `UPDATE public.profiles SET tier = 'pro', subscription_status = 'active' WHERE id = '1111...';`
  - Postgres completed `UPDATE 1`. Alice's tier became `pro` and status became `active`.
- **Trigger State Trap Verification**:
  - A changelog with `is_published = TRUE, status = 'published'` was updated with `UPDATE public.changelogs SET is_published = FALSE;`
  - Result: `is_published` remained `t` and `status` remained `published`. The trigger swallowed the update.
  - A PR with `is_filtered = TRUE, status = 'excluded'` was updated with `UPDATE public.pull_requests SET is_filtered = FALSE;`
  - Result: `is_filtered` remained `t` and `status` remained `excluded`. The trigger swallowed the update.

---

## 2. Logic Chain

1. **Observation 1.2.1 & 1.3 (RLS Multi-Tenant Bypass on `projects`)**:
   - In PostgreSQL, RLS policies for the same action (`SELECT`) on a table are combined disjunctively using boolean `OR`.
   - Policy "Users can view own projects" enforces `auth.uid() = user_id`.
   - Policy "Public read project info by slug" applies `TO anon, authenticated USING (true)`.
   - For any authenticated user, the effective filter is `(auth.uid() = user_id) OR (true)` which is mathematically identical to `true`.
   - Furthermore, `projects` contains `webhook_secret`. Because `anon` and any `authenticated` user can SELECT all rows, every project's HMAC webhook secret is publicly readable via the client API.
   - This breaks the core requirement of multi-tenant isolation (R2, Line 23) and allows an attacker to forge GitHub webhooks to inject malicious pull requests.

2. **Observation 1.2.3 & 1.3 (Privilege Escalation on `profiles`)**:
   - `profiles` stores billing tier (`free` vs `pro`), subscription status, customer IDs, and period ends.
   - The RLS policy for `UPDATE` on `profiles` checks `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`.
   - PostgreSQL RLS operates at row level, not column level, unless column permissions are explicitly revoked or guarded by triggers.
   - Any user can bypass Dodo Payments (R4) by issuing a direct Supabase update on their own row to set `tier = 'pro'`.

3. **Observation 1.2.4, 1.2.5 & 1.3 (Trigger State-Trapping Bugs)**:
   - When a row is updated in Postgres, any omitted column retains its `OLD` value.
   - In `sync_changelog_fields()`, if an updater passes `{ is_published: false }`, `NEW.status` retains `OLD.status` (`'published'`). The trigger checks `ELSIF NEW.status = 'published'` before checking `is_published = FALSE`, and forces `NEW.is_published = TRUE`.
   - Similarly, if an updater passes `{ status: 'draft' }`, `NEW.is_published` retains `TRUE`, and the first `IF` forces `NEW.status = 'published'`.
   - In `sync_pull_request_fields()`, un-excluding a PR by updating `{ is_filtered: false }` or `{ status: 'unreleased' }` is similarly overridden and reverted by the trigger.
   - This breaks the founder dashboard's ability to unpublish releases or toggle PR noise exclusion unless frontend code updates both columns simultaneously.
   - In `sync_changelog_fields()`, markdown syncing only occurs if one column is empty; once both have values, subsequent updates to `markdown_body` in the markdown editor do not sync to `raw_markdown`.

4. **Observation 1.2.6 & 1.1 (Self-Certifying Test Suite Masking Critical Defects)**:
   - `tests/unit/foundation.test.ts` only asserted that strings like `auth.uid() = user_id` appeared in the SQL files.
   - Because the test did not validate policy composition or run queries, all 11 tests passed with 100% score while critical multi-tenant leaks and trigger bugs were present.

---

## 3. Findings

### [Critical] Finding 1: INTEGRITY VIOLATION & CRITICAL SECURITY — Universal RLS Leak on `projects` Exposing All Projects and `webhook_secret`
- **Where**: `supabase/migrations/20260922000002_rls_policies.sql:91-94`
- **Why**: `CREATE POLICY "Public read project info by slug" ON public.projects FOR SELECT TO anon, authenticated USING (true);` overrides `auth.uid() = user_id` for all authenticated users, and allows anonymous visitors to scrape all projects and their `webhook_secret`.
- **Suggested Fix**:
  1. Remove `authenticated` from the public read policy.
  2. For public read by anonymous visitors (needed by `/c/[slug]` and `/api/v1/widget/[slug]`), either:
     - Require public routes to use `createAdminClient()` or a dedicated database RPC function `get_project_by_slug(p_slug text)` that selects only non-sensitive columns (`id`, `name`, `slug`, `is_pro_override`, `custom_domain`), OR
     - Restrict the anon policy to projects that have published changelogs:
       ```sql
       CREATE POLICY "Public read project info by slug"
           ON public.projects FOR SELECT
           TO anon
           USING (
               EXISTS (
                   SELECT 1 FROM public.changelogs
                   WHERE changelogs.project_id = projects.id
                     AND (changelogs.is_published = true OR changelogs.status = 'published')
               )
           );
       ```
       AND revoke SELECT on sensitive columns:
       ```sql
       REVOKE SELECT ON public.projects FROM anon;
       GRANT SELECT (id, name, slug, repo_owner, repo_name, repo_full_name, is_pro_override, custom_domain, created_at, updated_at) ON public.projects TO anon;
       ```

### [Critical] Finding 2: CRITICAL SECURITY — Unrestricted Profile UPDATE Policy Permits Self-Privilege Escalation to Pro Tier
- **Where**: `supabase/migrations/20260922000002_rls_policies.sql:22-26`
- **Why**: Authenticated users can update their own row's `tier` to `'pro'`, `subscription_status` to `'active'`, and `current_period_end` to any future date directly via the client SDK, bypassing Dodo Payments billing.
- **Suggested Fix**:
  Add a BEFORE UPDATE trigger on `profiles` that disallows modifying `tier`, `subscription_status`, `dodo_*`, and `current_period_end` unless the caller is `service_role`:
  ```sql
  CREATE OR REPLACE FUNCTION public.protect_profile_tier()
  RETURNS TRIGGER AS $$
  BEGIN
      IF (current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role') AND current_user <> 'postgres' THEN
          IF NEW.tier IS DISTINCT FROM OLD.tier OR
             NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
             NEW.dodo_subscription_id IS DISTINCT FROM OLD.dodo_subscription_id OR
             NEW.dodo_customer_id IS DISTINCT FROM OLD.dodo_customer_id OR
             NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
              RAISE EXCEPTION 'Cannot modify billing tier or subscription details directly';
          END IF;
      END IF;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_protect_profile_tier
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tier();
  ```

### [Major] Finding 3: Synchronization Triggers Trap State (Unpublishing & PR Noise Toggle Reverted)
- **Where**: `supabase/migrations/20260922000001_initial_schema.sql:183-217` & `220-250`
- **Why**: The triggers do not inspect `TG_OP = 'UPDATE'` or compare against `OLD` values. Updating only `is_published: false` causes the trigger to see `OLD.status = 'published'` and flip `is_published` back to `true`. Updating only `is_filtered: false` causes the trigger to see `OLD.status = 'excluded'` and flip `is_filtered` back to `true`.
- **Suggested Fix**:
  Refactor `sync_changelog_fields()` and `sync_pull_request_fields()` to check `TG_OP = 'UPDATE'` and compare changes against `OLD` columns:
  ```sql
  CREATE OR REPLACE FUNCTION public.sync_changelog_fields()
  RETURNS TRIGGER AS $$
  BEGIN
      IF TG_OP = 'UPDATE' THEN
          IF NEW.status IS DISTINCT FROM OLD.status THEN
              NEW.is_published = (NEW.status = 'published');
          ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
              IF NEW.is_published THEN
                  NEW.status = 'published';
              ELSE
                  NEW.status = 'draft';
              END IF;
          END IF;

          IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body THEN
              NEW.raw_markdown = NEW.markdown_body;
          ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown THEN
              NEW.markdown_body = NEW.raw_markdown;
          END IF;
      ELSE -- INSERT
          IF NEW.is_published = TRUE THEN
              NEW.status = 'published';
          ELSIF NEW.status = 'published' THEN
              NEW.is_published = TRUE;
          ELSE
              NEW.is_published = FALSE;
              NEW.status = 'draft';
          END IF;
          IF NEW.markdown_body IS NOT NULL AND NEW.markdown_body <> '' AND (NEW.raw_markdown IS NULL OR NEW.raw_markdown = '') THEN
              NEW.raw_markdown = NEW.markdown_body;
          ELSIF NEW.raw_markdown IS NOT NULL AND NEW.raw_markdown <> '' AND (NEW.markdown_body IS NULL OR NEW.markdown_body = '') THEN
              NEW.markdown_body = NEW.raw_markdown;
          END IF;
      END IF;

      IF NEW.is_published = TRUE AND NEW.published_at IS NULL THEN
          NEW.published_at = timezone('utc'::text, now());
      ELSIF NEW.is_published = FALSE THEN
          NEW.published_at = NULL;
      END IF;

      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```
  Apply the analogous delta check to `sync_pull_request_fields()`.

### [Major] Finding 4: In-Memory Mock Harness & Unit Test Gap Masking RLS and Trigger Behaviors
- **Where**: `tests/unit/foundation.test.ts:33-78` and `tests/mocks/mock-supabase.ts`
- **Why**: Unit test suite only checks substring presence in SQL files. The mock Supabase client does not simulate RLS policies or trigger logic, creating a false sense of security where broken triggers and RLS leaks went completely undetected by `npm test`.
- **Suggested Fix**:
  Add unit tests validating policy constraints and update the mock client to accurately reflect state transitions or incorporate trigger simulation.

### [Minor] Finding 5: Missing Security Definer `search_path`, View Invoker Security, and `server-only` Guard
- **Where**:
  - `supabase/migrations/20260922000001_initial_schema.sql:26` (`users` view)
  - `supabase/migrations/20260922000001_initial_schema.sql:253` (`handle_new_user`)
  - `lib/supabase/admin.ts`
- **Why**:
  - In PostgreSQL 15+, views by default run with view owner permissions. Add `WITH (security_invoker = true)` to `public.users` to ensure RLS is enforced when querying the view.
  - `handle_new_user()` is `SECURITY DEFINER` but lacks `SET search_path = public, pg_temp;`.
  - `lib/supabase/admin.ts` should include `import 'server-only';` to prevent accidental bundling into client components.

---

## 4. Verified Claims

- TypeScript types (`lib/supabase/types.ts`) exactly mirror the tables, constraints, and interface contracts from `PROJECT.md` (`ReleaseCategories`, `ReleaseDistribution`, `UserTier`, `SubscriptionStatus`). Verified via manual diff and `tsc --noEmit` -> PASS.
- Cascading foreign keys (`ON DELETE CASCADE` on `installations`, `projects`, `changelogs`, `pull_requests`) are properly configured in DDL. Verified in PostgreSQL 16 container -> PASS.
- High-performance indexes cover all project queries (`slug`, `user_id`, `repo_full_name`), pull requests (`project_id, status`, `project_id, merged_at DESC`), changelogs (`project_id, is_published, published_at DESC`), and Dodo webhook idempotency (`event_id`). Verified in PostgreSQL 16 container -> PASS.
- Next.js 15 SSR client factory (`lib/supabase/server.ts`) correctly awaits `cookies()` and handles Server Component cookie limitations. Verified in build & unit tests -> PASS.
- shadcn/ui primitives and badge domain categories (`feature`, `improvement`, `fix`, `noise`) are properly implemented. Verified in unit tests -> PASS.

---

## 5. Coverage Gaps & Unverified Items

- **GitHub Webhook Ingestion**: End-to-end webhook ingestion is planned for Milestone 3.
- **Dodo Payments Webhook Handling**: Signature validation and idempotency handling are planned for Milestone 6.
- **Production Supabase Connection**: Tested against live local PostgreSQL 16 engine; live cloud Supabase environment variables are currently configured with mock values.

---

## 6. Caveats

- Testing against a real PostgreSQL 16 container confirmed that the SQL syntax and extensions (`uuid-ossp`, `pgcrypto`, `plpgsql`) are 100% valid and parse cleanly. The issues identified are semantic RLS logic defects and trigger state machine bugs.
- No production source code was modified during this review in accordance with the reviewer constraint.

---

## 7. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 1 established a clean TypeScript structure, robust UI primitives, and clean Next.js 15 build artifacts. However, the database security and trigger implementations contain **2 Critical vulnerabilities** (universal multi-tenant project and webhook secret exposure, self-privilege escalation to Pro tier) and **1 Major trigger state bug** (unpublishing and PR noise inclusion cannot be toggled).

Because `tests/unit/foundation.test.ts` only asserted substring matches and self-certified these policies without testing them against an engine or checking policy interactions, these flaws must be resolved before Milestones 2, 3, and 4 proceed.

Remediation steps for `m1_worker_1`:
1. Fix `supabase/migrations/20260922000002_rls_policies.sql` to isolate `projects` SELECT to `auth.uid() = user_id` for authenticated users and prevent public exposure of `webhook_secret`.
2. Add `protect_profile_tier` trigger to prevent unauthorized updates to `tier` and billing columns on `profiles`.
3. Fix `sync_changelog_fields()` and `sync_pull_request_fields()` in `supabase/migrations/20260922000001_initial_schema.sql` to compare against `OLD` values during updates.
4. Add `WITH (security_invoker = true)` to `users` view and `SET search_path = public, pg_temp` to `handle_new_user()`.
5. Update unit tests to verify the corrected RLS and trigger behaviors.

---

## 8. Verification Method

To independently reproduce and verify these findings:

1. **Verify Unit Tests & Build**:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   npm run build
   ```
2. **Reproduce RLS Leak & Trigger Traps**:
   Run PostgreSQL 16 in Docker:
   ```bash
   docker run --rm -d --name temp_pg_test -e POSTGRES_PASSWORD=test -p 54321:5432 postgres:16-alpine
   ```
   Apply migrations:
   ```bash
   docker exec -i temp_pg_test psql -U postgres -d postgres < supabase/migrations/20260922000001_initial_schema.sql
   docker exec -i temp_pg_test psql -U postgres -d postgres < supabase/migrations/20260922000002_rls_policies.sql
   ```
   Execute the RLS test script demonstrating cross-tenant project leakage, `webhook_secret` exposure, and self-promotion to Pro tier.
