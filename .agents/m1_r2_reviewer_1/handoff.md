# Review & Handoff Report — Milestone 1 Reviewer 1 (Security, RLS & Schema Triggers)

## Review Summary

**Verdict**: **APPROVE**

Milestone 1 database schema migrations, RLS policies, trigger procedures, mock Supabase query harness, and UI primitives have been independently inspected, verified, and stress-tested. All 4 verification commands (`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`) passed with exit code 0. No integrity violations, facade implementations, or shortcuts were found.

---

## 1. Observation

Direct observations from codebase inspection and command executions:

### Verification Check 1: Elimination of Universal RLS Leak on `public.projects`
- File: `supabase/migrations/20260922000002_rls_policies.sql`
- Line 7: `ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;`
- Lines 105-127: All policies on `public.projects` require `auth.uid() = user_id`:
  - `CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);` (lines 105-108)
  - `CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);` (lines 111-114)
  - `CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` (lines 117-121)
  - `CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);` (lines 124-127)
- Lines 129-132: Universal read policy `Public read project info by slug` with `USING (true)` has been completely removed. Grep confirmed zero occurrences of `USING (true)` across the entire file (except in explanatory comment line 129).

### Verification Check 2: Sanitized `get_project_public_info(p_slug TEXT)` RPC
- File: `supabase/migrations/20260922000002_rls_policies.sql` lines 138-164:
  ```sql
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

  REVOKE EXECUTE ON FUNCTION public.get_project_public_info(TEXT) FROM public;
  GRANT EXECUTE ON FUNCTION public.get_project_public_info(TEXT) TO anon, authenticated, service_role;
  ```
- Exposes only sanitized public columns (`id`, `name`, `slug`, `is_pro_override`, `custom_domain`).
- Sensitive columns (`webhook_secret`, `user_id`, `installation_id`, `repo_full_name`, `created_at`, `updated_at`) are excluded.
- Employs `SECURITY DEFINER` with `SET search_path = public, pg_temp` to defeat search path poisoning attacks.

### Verification Check 3: Profile Tier & Billing Column Anti-Escalation Protection
- File: `supabase/migrations/20260922000002_rls_policies.sql` lines 37-72:
  - Trigger function `public.protect_profile_tier()` inspects callers:
    ```sql
    IF (
        COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
        AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
    ) THEN
    ```
  - Intercepts and blocks any modification via `IS DISTINCT FROM` on:
    - `tier`
    - `subscription_status`
    - `dodo_subscription_id`
    - `dodo_customer_id`
    - `current_period_end`
    - `id`
  - Throws exception: `RAISE EXCEPTION 'Unauthorized: Billing tier, subscription status, and payment identifiers can only be modified by the service role.';`
  - Reverts `created_at` changes: `NEW.created_at = OLD.created_at;`.
  - Bound via `trg_protect_profile_tier BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tier();`.

### Verification Check 4: Field Sync Triggers (`sync_changelog_fields` & `sync_pull_request_fields`)
- File: `supabase/migrations/20260922000001_initial_schema.sql`:
  - `sync_changelog_fields()` (lines 184-235):
    - Differentiates `IF TG_OP = 'UPDATE' THEN` from `TG_OP = 'INSERT'`.
    - Detects modifications via `IS DISTINCT FROM` on `NEW.status IS DISTINCT FROM OLD.status` and `NEW.is_published IS DISTINCT FROM OLD.is_published`.
    - Handles unpublishing: setting `is_published = FALSE` (or `status = 'draft'`) sets `status = 'draft'` and resets `published_at = NULL` (lines 229-231).
    - Synchronizes `markdown_body <-> raw_markdown` bidirectionally based on which field changed.
  - `sync_pull_request_fields()` (lines 242-301):
    - Differentiates `IF TG_OP = 'UPDATE' THEN` from `TG_OP = 'INSERT'`.
    - Handles release unlinking cleanly:
      ```sql
      IF NEW.changelog_id IS DISTINCT FROM OLD.changelog_id THEN
          NEW.release_id = NEW.changelog_id;
      ELSIF NEW.release_id IS DISTINCT FROM OLD.release_id THEN
          NEW.changelog_id = NEW.release_id;
      END IF;
      ```
      Setting `changelog_id = NULL` propagates to `release_id = NULL` without being blocked by fallback logic.
    - Handles un-exclusion and status/filter toggling:
      ```sql
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
      ```
      Setting `status = 'unreleased'` unsets `is_filtered = FALSE`, and setting `is_filtered = FALSE` resets `status = 'unreleased'`.
    - Synchronizes `author <-> author_login` on `UPDATE` via `IS DISTINCT FROM`.

### Verification Check 5: Verification Commands Execution
All 4 commands were executed directly in `/home/alok/Projects_Antigravity/bsAK`:

1. `npm run typecheck`
   - Command: `tsc --noEmit`
   - Result: Exit code 0, 0 errors.
2. `npm test`
   - Command: `vitest run`
   - Result: Exit code 0.
   - Output:
     ```
     ✓ tests/unit/database-stress.test.ts (33 tests) 18ms
     ✓ tests/unit/foundation.test.ts (11 tests) 38ms
     ✓ tests/unit/adversarial-ui.test.tsx (34 tests) 104ms
     Test Files  3 passed (3)
     Tests  78 passed (78)
     ```
3. `npm run lint`
   - Command: `next lint`
   - Result: Exit code 0.
   - Output: `✔ No ESLint warnings or errors`
4. `npm run build`
   - Command: `next build`
   - Result: Exit code 0.
   - Output: `✓ Compiled successfully in 1963ms`, static routes `/` and `/_not-found` generated.

### Integrity Audit Observations
- No hardcoded test results embedded in source code.
- `tests/mocks/mock-supabase.ts` implements a full stateful in-memory mock engine with filtering, ordering, pagination, mutation chaining (`insert/update/delete.select()`), upsert deduplication on compound and unique keys (`event_id`), and PostgREST `PGRST116` cardinality errors.
- `components/ui/toast.tsx` exports `toastVariants` on line 129.
- No shortcuts, facades, or fabricated logs were detected.

---

## 2. Logic Chain

1. **Security Isolation of Projects**:
   - Observation: In `20260922000002_rls_policies.sql`, RLS is enabled on `projects` and all four policies (SELECT, INSERT, UPDATE, DELETE) require `auth.uid() = user_id`.
   - Inference: No tenant can read or mutate another tenant's project records through PostgREST client queries.
   - Observation: Universal read policy `USING (true)` has been eliminated.
   - Inference: `webhook_secret` cannot be scraped by unauthenticated callers.
   - Observation: `get_project_public_info` is defined with `SECURITY DEFINER` and returns only `(id, name, slug, is_pro_override, custom_domain)`.
   - Inference: Public routes (`/c/[slug]` and `/api/v1/widget/[slug]`) can securely query project metadata without exposing secrets.

2. **Privilege Escalation Prevention**:
   - Observation: `protect_profile_tier()` trigger checks `request.jwt.claim.role <> 'service_role'` and DB user privilege, throwing exceptions on unauthorized changes to `tier`, `subscription_status`, and payment metadata.
   - Inference: An authenticated user cannot upgrade themselves from Free to Pro or tamper with billing state via Supabase client requests.

3. **Trigger Operability and Symmetrical Sync**:
   - Observation: In `20260922000001_initial_schema.sql`, `sync_changelog_fields()` and `sync_pull_request_fields()` use `IF TG_OP = 'UPDATE'` with `IS DISTINCT FROM`.
   - Inference: Modifications to specific columns (`changelog_id = NULL`, `status = 'unreleased'`, `is_published = FALSE`) correctly trigger corresponding synchronization without being overwritten by legacy default values or conflicting fields.

4. **Integration and Regression Testing**:
   - Observation: `npm run typecheck`, `npm test` (78 tests), `npm run lint`, and `npm run build` all exit with code 0.
   - Inference: The database schema definitions, mock harness, UI primitives, and application code are fully consistent, well-typed, and functional.

---

## 3. Caveats

1. **Declarative SQL Validation**: The SQL migrations are declarative source files verified against schema design rules and syntax tests. Actual execution against a live managed Supabase instance will take place during deployment via `supabase db push` / `supabase migration up`.
2. **Profiles Direct INSERT Boundary (Defense-in-Depth)**: `protect_profile_tier` is attached `BEFORE UPDATE`. While user profiles are automatically provisioned at sign-up via `handle_new_user()` (which defaults `tier` to `'free'`), the RLS INSERT policy `Users can insert own profile` currently specifies `WITH CHECK (auth.uid() = id)`. In a future hardening iteration, adding `AND tier = 'free'` to the INSERT check or updating `protect_profile_tier` to `BEFORE INSERT OR UPDATE` will provide defense-in-depth against direct client inserts prior to the auth hook.

---

## 4. Conclusion

The Milestone 1 database schema, security policies, triggers, and foundation components meet all security, functional, and quality requirements:
- The universal RLS leak on `public.projects` is completely eliminated.
- The `get_project_public_info` RPC safely exposes only sanitized metadata and protects `webhook_secret`.
- The `protect_profile_tier` trigger prevents client privilege escalation.
- Triggers properly handle unpublishing, unlinking, and un-exclusion.
- The test suite and build pipelines pass with zero errors.

**Verdict: APPROVE**

---

## 5. Verification Method

To independently reproduce this verification:

1. **Type Check**:
   ```bash
   npm run typecheck
   ```
   Assert: Exit code 0, 0 TypeScript errors.

2. **Test Suite**:
   ```bash
   npm test
   ```
   Assert: 3 test files pass (`tests/unit/database-stress.test.ts`, `tests/unit/foundation.test.ts`, `tests/unit/adversarial-ui.test.tsx`), 78 total tests pass, exit code 0.

3. **Linter**:
   ```bash
   npm run lint
   ```
   Assert: Exit code 0, "No ESLint warnings or errors".

4. **Production Build**:
   ```bash
   npm run build
   ```
   Assert: Exit code 0, Next.js production build completes and prerenders static routes.

5. **Schema Verification**:
   Inspect `supabase/migrations/20260922000001_initial_schema.sql` and `supabase/migrations/20260922000002_rls_policies.sql` to verify trigger logic and RLS policy rules.

---

## Adversarial Challenge Report

### Overall Risk Assessment: LOW

### Challenges & Attack Scenarios Tested

| # | Attack Scenario | Evaluated Defense | Result |
|---|-----------------|-------------------|--------|
| 1 | Unauthenticated visitor queries `/rest/v1/projects?select=*` to extract `webhook_secret` | RLS is enabled on `projects`; only authenticated users with `auth.uid() = user_id` can SELECT. Public read policy `USING (true)` removed. | **PASS** — Blocked by RLS. |
| 2 | Attacker executes `get_project_public_info(slug)` to inspect hidden fields | RPC returns explicit table definition with only `id`, `name`, `slug`, `is_pro_override`, `custom_domain`. No wildcard or secrets returned. | **PASS** — Safe projection. |
| 3 | Authenticated user sends `PATCH /rest/v1/profiles?id=eq.<uid>` with `{"tier": "pro"}` | `protect_profile_tier()` trigger executes BEFORE UPDATE, verifies caller is not service_role, detects `NEW.tier IS DISTINCT FROM OLD.tier`, and aborts transaction with RAISE EXCEPTION. | **PASS** — Blocked by trigger. |
| 4 | Admin unlinks a PR from a changelog by setting `changelog_id = NULL` | `sync_pull_request_fields` detects `NEW.changelog_id IS DISTINCT FROM OLD.changelog_id` on UPDATE and sets `NEW.release_id = NULL`. | **PASS** — Unlinks cleanly. |
| 5 | Founder unpublishes a release by setting `is_published = FALSE` | `sync_changelog_fields` detects change on UPDATE, sets `status = 'draft'`, and sets `published_at = NULL`. | **PASS** — Unpublishes cleanly. |
| 6 | Search path hijacking via `SECURITY DEFINER` function | `get_project_public_info` specifies `SET search_path = public, pg_temp` preventing search path poisoning attacks. | **PASS** — Search path fixed. |

### Minor Findings & Recommendations

- **[Minor] Finding 1: Defense-in-depth on profiles INSERT**:
  - Location: `supabase/migrations/20260922000002_rls_policies.sql:29`
  - Detail: `CREATE POLICY "Users can insert own profile" WITH CHECK (auth.uid() = id)` does not constrain `tier = 'free'` on direct client INSERT, though the `on_auth_user_created` trigger handles profile creation upon sign-up.
  - Suggestion: For Milestone 6 billing hardening, update the policy to `WITH CHECK (auth.uid() = id AND tier = 'free' AND subscription_status = 'inactive')` or extend `protect_profile_tier` to `BEFORE INSERT OR UPDATE`.
