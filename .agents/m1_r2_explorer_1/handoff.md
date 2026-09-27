# Milestone 1 Iteration 2 Database Security & RLS Remediation Report

**Agent**: `m1_r2_explorer_1` (Milestone 1 Security & RLS Explorer — Iteration 2)  
**Date**: 2026-09-22T18:38:00Z  
**Working Directory**: `/home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_1`  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  
**Target Migration Files**:
- `supabase/migrations/20260922000002_rls_policies.sql`
- `supabase/migrations/20260922000001_initial_schema.sql`

---

## Executive Summary

This report delivers the comprehensive, drop-in SQL architecture and unified diff patches to remediate the **2 Critical security vulnerabilities** and **1 Major trigger state defect** discovered during Milestone 1 Iteration 1 review:
1. **Universal RLS Leak on `public.projects`**: Eliminates the `USING (true)` policy that allowed authenticated users and anonymous visitors to view all projects and scrape HMAC `webhook_secret`.
2. **Self-Privilege Escalation on `public.profiles`**: Implements a strict `BEFORE UPDATE` trigger (`protect_profile_tier`) preventing non-service-role callers from modifying `tier`, `subscription_status`, `dodo_*`, or `current_period_end`.
3. **Trigger Logic Traps on `changelogs` and `pull_requests`**: Refactors synchronization triggers to execute delta comparisons (`TG_OP = 'UPDATE'` and `IS DISTINCT FROM`), allowing changelog unpublishing (`is_published = false`), PR unlinking (`changelog_id = null`), and PR noise toggle (`status = 'unreleased'`).
4. **Sanitized Public Project RPC (`get_project_public_info`)**: Provides a secure `SECURITY DEFINER` function for public lookups returning strictly 5 safe columns (`id`, `name`, `slug`, `is_pro_override`, `custom_domain`) without exposing secrets.
5. **View & Function Hardening**: Adds `WITH (security_invoker = true)` to `public.users` view and `SET search_path = public, pg_temp;` to `handle_new_user()`.

All proposed changes were verified empirically in a clean PostgreSQL 16 container (`postgres:16-alpine`), passing 9/9 adversarial stress scenarios. Machine-applicable `.patch` files and complete replacement files are delivered in `.agents/m1_r2_explorer_1/`.

---

## 1. Observation

### 1.1 Universal RLS Leak on `public.projects`
- **File**: `supabase/migrations/20260922000002_rls_policies.sql:91-94`
- **Verbatim Code**:
  ```sql
  -- Public read access to basic project metadata (needed for /c/[slug] & /api/v1/widget/[slug])
  CREATE POLICY "Public read project info by slug"
      ON public.projects FOR SELECT
      TO anon, authenticated
      USING (true);
  ```
- **File**: `supabase/migrations/20260922000001_initial_schema.sql:66`
- **Verbatim Code**:
  ```sql
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  ```
- **Empirical Confirmation (PostgreSQL 16)**:
  When two users Alice (`1111...`) and Bob (`2222...`) each created a project, querying `SELECT id, name, webhook_secret FROM public.projects` as Bob returned BOTH Alice and Bob's projects. Querying as role `anon` returned all projects and their HMAC `webhook_secret`.

### 1.2 Privilege Escalation to Pro Tier on `public.profiles`
- **File**: `supabase/migrations/20260922000002_rls_policies.sql:22-26`
- **Verbatim Code**:
  ```sql
  -- Authenticated users can update their own profile
  CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  ```
- **Empirical Confirmation (PostgreSQL 16)**:
  Alice initialized on `tier = 'free'`. Executing:
  ```sql
  UPDATE public.profiles SET tier = 'pro', subscription_status = 'active' WHERE id = '1111...';
  ```
  succeeded with `UPDATE 1`. Alice obtained Pro features without paying via Dodo Payments.

### 1.3 State Traps in Synchronization Triggers
- **File**: `supabase/migrations/20260922000001_initial_schema.sql:187-195` (`sync_changelog_fields`)
- **Verbatim Code**:
  ```sql
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
  *Observed defect*: For an existing published changelog (`status = 'published'`), updating `SET is_published = FALSE` caused the trigger to see `OLD.status = 'published'` in `NEW.status`, hit `ELSIF NEW.status = 'published'`, and revert `NEW.is_published = TRUE`.
- **File**: `supabase/migrations/20260922000001_initial_schema.sql:231-242` (`sync_pull_request_fields`)
- **Verbatim Code**:
  ```sql
  IF NEW.changelog_id IS NOT NULL AND NEW.release_id IS NULL THEN
      NEW.release_id = NEW.changelog_id;
  ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL THEN
      NEW.changelog_id = NEW.release_id;
  END IF;

  IF NEW.is_filtered = TRUE AND NEW.status NOT IN ('excluded', 'filtered') THEN
      NEW.status = 'excluded';
  ELSIF NEW.status IN ('excluded', 'filtered') THEN
      NEW.is_filtered = TRUE;
  END IF;
  ```
  *Observed defects*: Setting `changelog_id = NULL` left `release_id` non-null, causing `ELSIF` to re-populate `changelog_id`. Setting `status = 'unreleased'` left `is_filtered = TRUE`, causing line 238 to re-exclude the PR.

### 1.4 Test Suite Masking & Challenger Verification
- **File**: `tests/unit/foundation.test.ts:72-76`:
  ```typescript
  expect(sql).toContain('auth.uid() = id');
  expect(sql).toContain('auth.uid() = user_id');
  expect(sql).toContain('Public read published changelogs');
  expect(sql).toContain('is_published = true');
  ```
  The test only performed string checks on SQL files and did not check for absence of universal leaks or presence of escalation prevention triggers.
- **File**: `tests/unit/database-stress.test.ts:390-400`:
  Challenger 2 wrote a test that asserted the defect exists (`expect(rlsSql).toContain('USING (true);')`).

---

## 2. Logic Chain

1. **Why `USING (true)` on `public.projects` creates a critical security breach**:
   - In PostgreSQL RLS, multiple permissive policies for the same role and action are joined by boolean `OR`.
   - The user policy evaluates `auth.uid() = user_id`. The public policy evaluates `true`.
   - Effective expression: `(auth.uid() = user_id) OR true` $\equiv$ `true`.
   - Because `projects` contains the GitHub App HMAC key `webhook_secret`, any client possessing the public Supabase anonymous key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) can query `GET /rest/v1/projects?select=webhook_secret` and forge GitHub webhook events (`X-Hub-Signature-256`), compromising repo ingestion integrity.
   - Therefore, the `USING (true)` policy must be dropped from `public.projects`. No SELECT policy for `anon` should exist on `public.projects`.

2. **Why Public Routes (`/c/[slug]` and `/api/v1/widget/[slug]`) do NOT need table-level anon access**:
   - `/c/[slug]` is an SSR Next.js Server Component running exclusively on the Node.js/Edge server.
   - `/api/v1/widget/[slug]` is a Next.js App Router Route Handler running exclusively on the server.
   - The client-side widget (`widget.js`) calls `/api/v1/widget/[slug]`, never Supabase directly.
   - Server-side routes query Supabase using `createAdminClient()` (service-role client bypassing RLS) or via a database RPC function (`get_project_public_info(p_slug)`), selecting only non-sensitive columns (`id, name, slug, is_pro_override, custom_domain`).
   - Result: Public routes work without exposing the base table to anonymous scraping.

3. **Why Profile Tier Escalation requires a Trigger rather than standard RLS**:
   - PostgreSQL RLS enforces row-level visibility, not column-level write constraints.
   - With `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`, any authenticated user can send an update payload with `{ tier: 'pro', subscription_status: 'active' }`.
   - In Supabase, requests made with the service role key have JWT claim `request.jwt.claim.role = 'service_role'`.
   - A `BEFORE UPDATE` trigger function on `public.profiles` inspecting `current_setting('request.jwt.claim.role', true)` and database roles (`postgres`, `supabase_admin`, `service_role`) will reject any attempt by an authenticated user to alter `tier`, `subscription_status`, `dodo_*`, or `current_period_end`.
   - *Crucial Implementation Insight*: The trigger function must NOT be declared `SECURITY DEFINER`. If it were `SECURITY DEFINER`, PostgreSQL would execute the body as the function owner (`postgres`), masking the calling role and allowing the check to be bypassed. Using a standard trigger function preserves the caller's role (`authenticated`).

4. **Why Trigger State Traps occurred and how Delta Checks resolve them**:
   - In PostgreSQL triggers on `UPDATE`, omitted fields retain their `OLD` values in the `NEW` record.
   - Evaluating static values (e.g. `IF NEW.status = 'published'`) triggers branches for unmodified fields.
   - By structuring the trigger around `IF TG_OP = 'UPDATE'` and checking `NEW.column IS DISTINCT FROM OLD.column`, the trigger detects which specific field was explicitly changed by the application and synchronizes the dependent field accordingly.
   - On `INSERT`, static initialization applies as before.

---

## 3. Drop-in Remediation Architecture

### 3.1 Drop-in SQL for `supabase/migrations/20260922000002_rls_policies.sql`

#### Change 1: Add Profile Anti-Escalation Trigger (under Section 1)
```sql
-- Security Trigger: Prevent unauthorized privilege escalation on public.profiles
-- Prevents authenticated users from self-promoting to 'pro' tier or modifying subscription metadata.
-- Only the service_role (or superuser postgres/supabase_admin) can update billing columns.
CREATE OR REPLACE FUNCTION public.protect_profile_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If caller is not service_role (neither by JWT claim nor by DB role) and not superuser/admin
    IF (
        COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
        AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
    ) THEN
        IF NEW.tier IS DISTINCT FROM OLD.tier OR
           NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
           NEW.dodo_subscription_id IS DISTINCT FROM OLD.dodo_subscription_id OR
           NEW.dodo_customer_id IS DISTINCT FROM OLD.dodo_customer_id OR
           NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
            RAISE EXCEPTION 'Unauthorized: Billing tier, subscription status, and payment identifiers can only be modified by the service role.';
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Unauthorized: User ID cannot be modified.';
        END IF;

        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            NEW.created_at = OLD.created_at;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_tier ON public.profiles;
CREATE TRIGGER trg_protect_profile_tier
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tier();
```

#### Change 2: Drop Insecure Universal Project Read Policy & Add Sanitized Public RPC
Remove lines 90-95 in `20260922000002_rls_policies.sql`:
```sql
-- REMOVE THIS ENTIRE BLOCK:
-- CREATE POLICY "Public read project info by slug"
--     ON public.projects FOR SELECT
--     TO anon, authenticated
--     USING (true);
```
Replace with:
```sql
-- ============================================================================
-- 3.1 Public Project Info Access (Sanitized Security Definer RPC)
-- ============================================================================
-- Safe public function to query project info by slug without exposing webhook_secret or user_id.
-- Public routes (/c/[slug] & /api/v1/widget/[slug]) query sanitized project info
-- via createAdminClient() or this get_project_public_info() security definer RPC.
CREATE OR REPLACE FUNCTION public.get_project_public_info(p_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    is_pro_override BOOLEAN,
    custom_domain TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        p.id,
        p.name,
        p.slug,
        p.is_pro_override,
        p.custom_domain
    FROM public.projects p
    WHERE p.slug = p_slug
    LIMIT 1;
$$;

-- Grant execution to anon, authenticated, and service_role
REVOKE EXECUTE ON FUNCTION public.get_project_public_info(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_project_public_info(TEXT) TO anon, authenticated, service_role;
```

---

### 3.2 Drop-in SQL for `supabase/migrations/20260922000001_initial_schema.sql`

#### Change 1: Add `WITH (security_invoker = true)` to `users` View (Line 26)
```sql
-- Backward-compatibility View: public.users aliased to public.profiles
-- security_invoker = true ensures RLS policies of invoker are evaluated
CREATE OR REPLACE VIEW public.users WITH (security_invoker = true) AS
SELECT
    id,
    email,
    full_name AS name,
    tier,
    dodo_subscription_id AS subscription_id,
    dodo_customer_id,
    subscription_status,
    current_period_end,
    created_at,
    updated_at
FROM public.profiles;
```

#### Change 2: Refactor `sync_changelog_fields()` with Delta Checks (Lines 183-213)
```sql
-- Synchronize Changelogs fields (is_published <-> status, raw_markdown <-> markdown_body)
CREATE OR REPLACE FUNCTION public.sync_changelog_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Synchronize status & is_published based on which field changed
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.is_published = (NEW.status = 'published');
        ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
            IF NEW.is_published = TRUE THEN
                NEW.status = 'published';
            ELSE
                NEW.status = 'draft';
            END IF;
        END IF;

        -- Synchronize markdown body & raw_markdown based on which field changed
        IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body THEN
            NEW.raw_markdown = NEW.markdown_body;
        ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown THEN
            NEW.markdown_body = NEW.raw_markdown;
        END IF;
    ELSE -- TG_OP = 'INSERT'
        -- Initialize status & is_published
        IF NEW.is_published = TRUE THEN
            NEW.status = 'published';
        ELSIF NEW.status = 'published' THEN
            NEW.is_published = TRUE;
        ELSE
            NEW.is_published = FALSE;
            NEW.status = 'draft';
        END IF;

        -- Initialize markdown fields
        IF NEW.markdown_body IS NOT NULL AND NEW.markdown_body <> '' AND (NEW.raw_markdown IS NULL OR NEW.raw_markdown = '') THEN
            NEW.raw_markdown = NEW.markdown_body;
        ELSIF NEW.raw_markdown IS NOT NULL AND NEW.raw_markdown <> '' AND (NEW.markdown_body IS NULL OR NEW.markdown_body = '') THEN
            NEW.markdown_body = NEW.raw_markdown;
        END IF;
    END IF;

    -- Automatically maintain published_at timestamp
    IF NEW.is_published = TRUE THEN
        IF NEW.published_at IS NULL THEN
            NEW.published_at = timezone('utc'::text, now());
        END IF;
    ELSE
        NEW.published_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Change 3: Refactor `sync_pull_request_fields()` with Delta Checks (Lines 220-250)
```sql
-- Synchronize Pull Request fields (author <-> author_login, changelog_id <-> release_id, status <-> is_filtered)
CREATE OR REPLACE FUNCTION public.sync_pull_request_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Author sync on UPDATE
        IF NEW.author_login IS DISTINCT FROM OLD.author_login THEN
            NEW.author = NEW.author_login;
        ELSIF NEW.author IS DISTINCT FROM OLD.author THEN
            NEW.author_login = NEW.author;
        END IF;

        -- Release / Changelog ID sync on UPDATE (handles unlinking cleanly)
        IF NEW.changelog_id IS DISTINCT FROM OLD.changelog_id THEN
            NEW.release_id = NEW.changelog_id;
        ELSIF NEW.release_id IS DISTINCT FROM OLD.release_id THEN
            NEW.changelog_id = NEW.release_id;
        END IF;

        -- Status & noise filter sync on UPDATE
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status IN ('excluded', 'filtered') THEN
                NEW.is_filtered = TRUE;
            ELSE
                NEW.is_filtered = FALSE;
            END IF;
        ELSIF NEW.is_filtered IS DISTINCT FROM OLD.is_filtered THEN
            IF NEW.is_filtered = TRUE THEN
                NEW.status = 'excluded';
            ELSE
                IF NEW.status IN ('excluded', 'filtered') THEN
                    NEW.status = 'unreleased';
                END IF;
            END IF;
        END IF;
    ELSE -- TG_OP = 'INSERT'
        -- Author sync on INSERT
        IF NEW.author_login IS NOT NULL AND NEW.author_login <> '' AND (NEW.author IS NULL OR NEW.author = '') THEN
            NEW.author = NEW.author_login;
        ELSIF NEW.author IS NOT NULL AND NEW.author <> '' AND (NEW.author_login IS NULL OR NEW.author_login = '') THEN
            NEW.author_login = NEW.author;
        END IF;

        -- Release / Changelog ID sync on INSERT
        IF NEW.changelog_id IS NOT NULL AND NEW.release_id IS NULL THEN
            NEW.release_id = NEW.changelog_id;
        ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL THEN
            NEW.changelog_id = NEW.release_id;
        END IF;

        -- Status & noise filter sync on INSERT
        IF NEW.is_filtered = TRUE AND NEW.status NOT IN ('excluded', 'filtered') THEN
            NEW.status = 'excluded';
        ELSIF NEW.status IN ('excluded', 'filtered') THEN
            NEW.is_filtered = TRUE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Change 4: Security Definer Search Path on `handle_new_user()` (Line 268)
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

---

### 3.3 Test Suite Remediation Plan for Worker (`m1_worker_1`)

#### 1. In `tests/unit/foundation.test.ts`:
Add explicit assertions for the remediated security state:
```typescript
it('should have RLS policies migration file present and valid', () => {
  expect(fs.existsSync(rlsPoliciesPath)).toBe(true);
  const sql = fs.readFileSync(rlsPoliciesPath, 'utf8');

  // Verify RLS is enabled on all tables
  expect(sql).toContain('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');
  expect(sql).toContain('ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;');
  expect(sql).toContain('ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;');
  expect(sql).toContain('ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;');
  expect(sql).toContain('ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;');
  expect(sql).toContain('ALTER TABLE public.dodo_webhook_events ENABLE ROW LEVEL SECURITY;');

  // Verify multi-tenant isolation and public changelog access
  expect(sql).toContain('auth.uid() = id');
  expect(sql).toContain('auth.uid() = user_id');
  expect(sql).toContain('Public read published changelogs');
  expect(sql).toContain('is_published = true');

  // SECURITY AUDIT ASSERTIONS:
  // Verify projects table does NOT have universal read policy
  expect(sql).not.toContain('CREATE POLICY "Public read project info by slug"');
  expect(sql).not.toContain('USING (true);');

  // Verify profile tier escalation protection trigger exists
  expect(sql).toContain('protect_profile_tier');
  expect(sql).toContain('trg_protect_profile_tier');

  // Verify sanitized public RPC function exists
  expect(sql).toContain('get_project_public_info');
  expect(sql).toContain('SECURITY DEFINER');
});
```

#### 2. In `tests/unit/database-stress.test.ts`:
Update Challenger 2's empirical defect tests (lines 363-400) to assert the resolved state:
- Update lines 390-400 to assert `expect(rlsSql).not.toContain('CREATE POLICY "Public read project info by slug"');` and `expect(rlsSql).toContain('protect_profile_tier');`.
- Update lines 363-388 to assert that triggers use `TG_OP = 'UPDATE'` and `IS DISTINCT FROM`.

#### 3. In `tests/mocks/mock-supabase.ts`:
Implement the 3 mock builder fixes:
- Preserve `action` in `.select()` when a mutation (`insert`, `update`, `upsert`, `delete`) is active.
- Support `onConflict` parameter in `.upsert()` (defaulting to `event_id` for `dodo_webhook_events`).
- Return `PGRST116` error in `.single()` and `.maybeSingle()` when `rows.length > 1`.

#### 4. In `components/ui/toast.tsx`:
Add `export { toastVariants };` to line 128.

#### 5. In `lib/supabase/admin.ts`:
Add `import 'server-only';` to line 1.

---

## 4. Empirical Verification Results

A clean PostgreSQL 16 container (`postgres:16-alpine`) was provisioned to execute the proposed migrations and a comprehensive 9-scenario adversarial test suite (`test_empirical_verification.sql`):

| # | Scenario | Role | Action Tested | Result |
|---|----------|------|---------------|--------|
| 1 | Multi-Tenant Project Isolation | `authenticated` (Bob) | `SELECT COUNT(*) FROM public.projects` | **PASS** (Returned 1 project, saw 0 for Alice) |
| 2 | Direct Anon Base Table Block | `anon` | `SELECT COUNT(*) FROM public.projects` | **PASS** (Returned 0 rows, deny-all) |
| 3 | Sanitized Public RPC Query | `anon` | `SELECT * FROM get_project_public_info('alice-project')` | **PASS** (Returned safe columns; no `webhook_secret`) |
| 4 | Profile Tier Escalation Attempt | `authenticated` (Alice) | `UPDATE profiles SET tier = 'pro'` | **PASS** (Aborted: `Unauthorized: Billing tier...`) |
| 5 | Legitimate Display Profile Update | `authenticated` (Alice) | `UPDATE profiles SET full_name = 'Alice Champion'` | **PASS** (Updated successfully) |
| 6 | Service Role Tier Promotion | `service_role` | `UPDATE profiles SET tier = 'pro', subscription_status = 'active'` | **PASS** (Updated successfully) |
| 7 | Changelog Unpublishing | `authenticated` (Alice) | `UPDATE changelogs SET is_published = FALSE` | **PASS** (Updated to `is_published = false, status = 'draft'`) |
| 8 | Pull Request Release Unlinking | `authenticated` (Alice) | `UPDATE pull_requests SET changelog_id = NULL` | **PASS** (Both `changelog_id` & `release_id` became `NULL`) |
| 9 | Pull Request Noise Un-exclusion | `authenticated` (Alice) | `UPDATE pull_requests SET status = 'unreleased'` | **PASS** (Updated to `status = 'unreleased', is_filtered = false`) |

---

## 5. Artifact Directory Inventory

The following ready-to-apply artifacts are generated in `.agents/m1_r2_explorer_1/`:
1. `initial_schema.patch` — Unified diff patch for `supabase/migrations/20260922000001_initial_schema.sql`
2. `rls_policies.patch` — Unified diff patch for `supabase/migrations/20260922000002_rls_policies.sql`
3. `proposed_20260922000001_initial_schema.sql` — Complete replacement file for Initial Schema
4. `proposed_20260922000002_rls_policies.sql` — Complete replacement file for RLS Policies
5. `test_pg_verification.sql` — Supabase schema simulation setup for local PostgreSQL engine
6. `test_empirical_verification.sql` — Automated 9-test verification script for CI or local Docker verification

---

## 6. Caveats

- In production Supabase, `service_role` possesses the `BYPASSRLS` attribute and sets `request.jwt.claim.role = 'service_role'`. In local / mock environments, if neither JWT claim nor role is set, `protect_profile_tier` defaults to blocking updates to tier columns unless run by superuser `postgres`.
- The `get_project_public_info` function is `SECURITY DEFINER` and explicitly sets `search_path = public, pg_temp;` to mitigate search path hijacking risks.

---

## 7. Conclusion

The database security model for ShipLog Milestone 1 is now completely resolved. By:
1. Stripping `USING (true)` from `projects` and utilizing `createAdminClient()` or `get_project_public_info()`, multi-tenant isolation is strictly preserved and `webhook_secret` is safe from anonymous exfiltration.
2. Introducing `protect_profile_tier` without `SECURITY DEFINER`, authenticated users cannot manipulate billing tiers or subscription statuses.
3. Incorporating delta comparisons (`TG_OP = 'UPDATE'` and `IS DISTINCT FROM`) into schema synchronization triggers, state-trapping bugs are eliminated.

The worker (`m1_worker_1`) can apply these patches immediately and update the test assertions to achieve 100% green status across all test suites.

---

## 8. Verification Method

To independently verify the fixes:

1. **Apply Patches**:
   ```bash
   patch -p0 < .agents/m1_r2_explorer_1/initial_schema.patch
   patch -p0 < .agents/m1_r2_explorer_1/rls_policies.patch
   ```
2. **Execute Full Test Suite in PostgreSQL 16 Docker**:
   ```bash
   docker run --rm -d --name verify_pg -e POSTGRES_PASSWORD=postgres -p 54322:5432 postgres:16-alpine
   sleep 3
   docker exec -i verify_pg psql -U postgres -d postgres < .agents/m1_r2_explorer_1/test_pg_verification.sql
   docker exec -i verify_pg psql -U postgres -d postgres < supabase/migrations/20260922000001_initial_schema.sql
   docker exec -i verify_pg psql -U postgres -d postgres < supabase/migrations/20260922000002_rls_policies.sql
   docker exec -i verify_pg psql -U postgres -d postgres < .agents/m1_r2_explorer_1/test_empirical_verification.sql
   docker rm -f verify_pg
   ```
   *Expected Output*: All 9 tests pass with `NOTICE: TEST X PASSED`.
3. **Invalidation Conditions**:
   - If Bob or anon can read Alice's `webhook_secret`.
   - If an authenticated user can set `tier = 'pro'`.
   - If setting `is_published = false` does not set `status = 'draft'`.
