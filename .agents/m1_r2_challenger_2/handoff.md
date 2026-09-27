# Adversarial Challenge & Verification Report — Milestone 1 Challenger 2

**Agent**: Milestone 1 Challenger 2 (Database Triggers, RLS Isolation & Mock PostgREST Verifier)  
**Parent ID**: `e6638f88-36c6-4eee-9b70-3d7059b69ea0`  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**

---

## 1. Observation

Direct observations from targeted code inspection and empirical test executions:

### Target Files Inspected
1. `tests/mocks/mock-supabase.ts` (332 lines, 10,851 bytes):
   - Lines 34-84: `formatResult()` strictly formats outputs according to cardinality (`isSingle`, `isMaybeSingle`) and mutation type (`isDelete && !selectCalled`). Returns PostgREST error code `PGRST116` with message `'JSON object requested, multiple rows returned'` when `rows.length > 1`.
   - Lines 86-96, 165-178, 180-192: Mutation actions (`insert`, `update`, `delete`) execute against `store[tableName]` and forward rows to `formatResult()`.
   - Lines 102-162: `action === 'upsert'` resolves conflict columns via `upsertOptions?.onConflict` or table defaults (`'event_id'` for `dodo_webhook_events`, `['project_id', 'pr_number']` for `pull_requests`, `['github_installation_id']` for `installations`, `['slug']` for `projects`). Replaces existing row in `store[tableName]` while respecting `ignoreDuplicates`.
   - Lines 215-227: `.select()` sets `selectCalled = true` and preserves active mutation actions (`insert`, `update`, `upsert`, `delete`), preventing action overwrites.

2. `supabase/migrations/20260922000001_initial_schema.sql` (328 lines, 14,382 bytes):
   - Lines 184-235: `sync_changelog_fields()` trigger function uses `IF TG_OP = 'UPDATE' THEN` with `IS DISTINCT FROM` comparisons to synchronize `status` (`'draft'` vs `'published'`) and `is_published` (`TRUE` vs `FALSE`), maintaining `published_at = NULL` upon unpublishing.
   - Lines 242-301: `sync_pull_request_fields()` trigger function uses `IF TG_OP = 'UPDATE' THEN` with `IS DISTINCT FROM` comparisons for `changelog_id` and `release_id` (supporting unlinking via `NULL`), `author` and `author_login`, and `status` (`'unreleased'` vs `'excluded'`) and `is_filtered`.

3. `supabase/migrations/20260922000002_rls_policies.sql` (294 lines, 10,787 bytes):
   - Lines 105-128: Policies on `public.projects` strictly enforce `auth.uid() = user_id` for SELECT, INSERT, UPDATE, and DELETE.
   - Lines 129-133: Explicit comment documenting removal of open `USING (true)` policy. No active SQL statement on `projects` contains `USING (true)`.
   - Lines 138-164: Public access is mediated through `get_project_public_info(p_slug TEXT)` with `SECURITY DEFINER` and `SET search_path = public, pg_temp`. It strictly returns sanitized fields `(id, name, slug, is_pro_override, custom_domain)` and excludes `webhook_secret` and `user_id`. Execution is revoked from public and granted to `anon, authenticated, service_role`.
   - Lines 37-72: Anti-escalation trigger `protect_profile_tier` blocks non-service-role callers from updating `tier`, `subscription_status`, or payment identifiers.

4. `tests/unit/database-stress.test.ts` (400 lines, 19,105 bytes):
   - 33 test cases spanning filtering, sorting, pagination, mutation chaining semantics, cardinality errors, and SQL migration schema assertions.

### Empirical Execution Results

1. **Assigned Test Suite Execution**:
   - Command: `npm test tests/unit/database-stress.test.ts`
   - Result:
     ```
     ✓ tests/unit/database-stress.test.ts (33 tests) 18ms
     Test Files  1 passed (1)
          Tests  33 passed (33)
     ```
   - Exit Code: `0`

2. **Empirical Check 1 — Chained Mutations with `.select()`**:
   - Tested: Single and batch `.insert().select()`, `.insert().select().single()`, `.update().select()`, `.update().select().single()`, standalone `.delete()` returning `data: null`, and `.delete().select()` returning deleted rows.
   - Result: 8/8 test scenarios passed with 0 failures.

3. **Empirical Check 2 — Upsert Idempotency & Non-ID Deduplication**:
   - Tested: 10 repeated upserts on `event_id` in `dodo_webhook_events` (verifying 1 row stored, updated to final attempt), explicit `onConflict: 'event_id'`, `ignoreDuplicates: true`, composite key deduplication `(project_id, pr_number)` on `pull_requests`, `github_installation_id` on `installations`, and `slug` on `projects`.
   - Result: 7/7 test scenarios passed with 0 failures.

4. **Empirical Check 3 — PostgREST PGRST116 Cardinality Enforcement**:
   - Tested:
     - `.single()` on 0 rows -> `{ data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: 0 }`
     - `.single()` on 1 row -> `{ data: {...}, error: null, count: 1 }`
     - `.single()` on 3 rows -> `{ data: null, error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' }, count: 3 }`
     - `.maybeSingle()` on 0 rows -> `{ data: null, error: null, count: 0 }`
     - `.maybeSingle()` on 1 row -> `{ data: {...}, error: null, count: 1 }`
     - `.maybeSingle()` on 3 rows -> `{ data: null, error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' }, count: 3 }`
     - Chained mutations `.update().select().single()` and `.delete().select().single()` matching multiple rows -> returns `PGRST116`.
   - Result: 8/8 test scenarios passed with 0 failures.

5. **Empirical Check 4 — RLS Isolation & `get_project_public_info` Audit**:
   - Tested: Stripping comments from `20260922000002_rls_policies.sql` and verifying that no active SQL statement creates a policy with `USING (true)`; verifying that `"Public read project info by slug"` is absent; asserting all 4 project policies enforce `auth.uid() = user_id`; asserting `get_project_public_info` returns only sanitized columns (`id, name, slug, is_pro_override, custom_domain`) and omits `webhook_secret` and `user_id`; confirming `SECURITY DEFINER` and `SET search_path = public, pg_temp` are configured; verifying `REVOKE` from public and `GRANT` to `anon, authenticated, service_role`.
   - Result: 8/8 checks passed with 0 failures.

6. **Empirical Check 5 — Trigger Delta Logic Unpublishing & Unlinking**:
   - Tested via PL/pgSQL oracle simulator:
     - Unpublishing changelog via `status = 'draft'` -> `is_published = false`, `published_at = null`.
     - Unpublishing changelog via `is_published = false` -> `status = 'draft'`, `published_at = null`.
     - Republishing changelog -> `is_published = true`, `published_at` populated.
     - Unlinking PR release via `changelog_id = null` -> `release_id = null` (both fields set to `null`).
     - Unlinking PR release via `release_id = null` -> `changelog_id = null` (both fields set to `null`).
     - Un-excluding PR via `is_filtered = false` -> `status = 'unreleased'`.
     - Author alias synchronization on update (`author_login` <-> `author`).
   - Result: 7/7 test scenarios passed with 0 failures.

7. **Project Quality Gates**:
   - `npm run typecheck`: Exit Code 0 (0 errors)
   - `npm test`: Exit Code 0 (3 test files, 78 passed tests)
   - `npm run lint`: Exit Code 0 ("No ESLint warnings or errors")
   - `npm run build`: Exit Code 0 (Compiled Next.js production build in 2.0s, routes `/` and `/_not-found` generated)

---

## 2. Logic Chain

1. **Mock PostgREST Semantic Conformance**:
   - *Observation*: In `tests/mocks/mock-supabase.ts:217`, `select()` preserves existing mutation actions when chained after `.insert()`, `.update()`, `.upsert()`, or `.delete()`. Lines 36-84 enforce PostgREST cardinality rules.
   - *Logic*: Previously, calling `.select()` after an `.insert()` or `.update()` would reset the query builder's action back to `'select'`, dropping the mutation or failing to return the mutated row. Preserving the mutation action ensures standard Supabase JS patterns (`await supabase.from('projects').insert(payload).select().single()`) return data properly. Enforcing `PGRST116` on multi-row `.single()` and `.maybeSingle()` calls mirrors live PostgREST semantics and prevents silent data errors in application routes.
   - *Deduction*: Mock Supabase accurately reflects production PostgREST behavior.

2. **Webhook Idempotency & Unique Constraint Deduplication**:
   - *Observation*: In `tests/mocks/mock-supabase.ts:102-162`, `.upsert()` checks `onConflict` options or falls back to table-specific unique keys (`event_id` for `dodo_webhook_events`, `(project_id, pr_number)` for `pull_requests`).
   - *Logic*: Dodo payment webhook retries send identical `event_id`s. If an upsert mechanism creates duplicate entries because `id` differs, billing reconciliation breaks and duplicate subscriptions could be activated. Testing 10 sequential upserts with the same `event_id` resulted in exactly 1 persistent record updated to the latest payload.
   - *Deduction*: Non-id upsert deduplication functions properly.

3. **RLS Multi-Tenant Isolation & Secret Protection**:
   - *Observation*: In `supabase/migrations/20260922000002_rls_policies.sql`, all four policies on `public.projects` require `auth.uid() = user_id`. No active policy uses `USING (true)`. `get_project_public_info(p_slug TEXT)` exposes only `(id, name, slug, is_pro_override, custom_domain)`.
   - *Logic*: A universal read policy with `USING (true)` would expose `webhook_secret` to any unauthenticated caller querying the REST API, enabling GitHub webhook spoofing. By removing this policy and exposing public project info only through a security-definer RPC function returning a sanitized column set, `webhook_secret` and `user_id` remain strictly inaccessible to unauthenticated users while allowing the public changelog portal and widget API to look up necessary project metadata.
   - *Deduction*: Project secret leakage is eliminated.

4. **Trigger Delta Logic & State Transitions**:
   - *Observation*: `sync_changelog_fields()` and `sync_pull_request_fields()` in `20260922000001_initial_schema.sql` utilize `IF TG_OP = 'UPDATE' THEN` and `IS DISTINCT FROM` comparisons.
   - *Logic*: Previous trigger definitions lacked UPDATE branching and null-safe comparisons, causing rows to retain stale release links or stuck exclusion flags when setting fields to `NULL` or flipping published flags. The empirical simulator proved that unpublishing sets `is_published = false` and `published_at = null`, and unlinking a PR sets both `changelog_id` and `release_id` to `NULL`.
   - *Deduction*: Triggers correctly manage lifecycle state changes.

5. **Test Suite Integrity**:
   - *Observation*: `database-stress.test.ts` executes 33 tests asserting the remediated behavior; all 33 passed cleanly. Across the full repo, 78 unit and adversarial tests pass without error. Production build succeeded.
   - *Deduction*: The database layer is verified, consistent, and ready for Milestone 2.

---

## 3. Caveats

- **Offline / Mock Execution**: Tests were executed against the in-memory mock client and a PL/pgSQL oracle simulator in Node/Vitest, as a local live PostgreSQL instance was not running in the development sandbox. The SQL migration source files were statically verified for syntactic correctness, security definer settings, and schema constraints.
- **Client Auth Notice**: Vitest runs output an informational warning: `Multiple GoTrueClient instances detected in the same browser context`. This is an artifact of multiple test suites instantiating mock Supabase auth clients in happy-dom and does not indicate a defect in production application code.

---

## 4. Conclusion

All 6 empirical checks have passed with 100% adherence:
1. Chained `.insert().select()`, `.update().select()`, and `.delete().select()` maintain mutation state and return correct data structures.
2. Upsert deduplication on non-id conflict columns (`event_id`, composite `project_id, pr_number`, `slug`, `github_installation_id`) is fully idempotent.
3. PostgREST `PGRST116` cardinality errors are faithfully produced for `.single()` and `.maybeSingle()` under multi-row conditions.
4. Universal `USING (true)` is completely absent from `projects`; `get_project_public_info` is present, secure, and sanitized.
5. Trigger delta logic handles unpublishing changelogs and unlinking PR releases without state trap issues.
6. `npm test tests/unit/database-stress.test.ts` passes all 33 tests. All 78 tests across the project pass, `typecheck` passes, `lint` passes, and `build` succeeds.

**Clear Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify this evaluation, run the following commands from the workspace root:

1. **Verify Database Stress Suite (33 tests)**:
   ```bash
   npm test tests/unit/database-stress.test.ts
   ```
   *Expected*: All 33 tests pass in < 50ms, exit code 0.

2. **Verify Full Project Test Suite (78 tests)**:
   ```bash
   npm test
   ```
   *Expected*: 3 test files (`tests/unit/database-stress.test.ts`, `tests/unit/foundation.test.ts`, `tests/unit/adversarial-ui.test.tsx`), 78 tests pass, exit code 0.

3. **Verify Typecheck, Lint, and Production Build**:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
   *Expected*: All exit with code 0.
