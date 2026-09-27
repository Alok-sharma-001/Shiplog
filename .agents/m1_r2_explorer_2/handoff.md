# Milestone 1 Trigger Synchronization Remediation Report (Iteration 2)

**Agent**: `m1_r2_explorer_2` (M1 Trigger Synchronization Explorer, Iteration 2)  
**Date**: 2026-09-22T18:32:00Z  
**Working Directory**: `/home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_2`  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  
**Target File**: `supabase/migrations/20260922000001_initial_schema.sql` (Lines 182–251)  
**Deliverables Produced**:
- `schema_triggers.patch` (Machine-applicable unified diff patch)
- `proposed_triggers.sql` (Drop-in SQL functions and trigger bindings)
- This `handoff.md` report

---

## 1. Observation

### 1.1 Direct Observations in `supabase/migrations/20260922000001_initial_schema.sql`
Lines 183–213 define `sync_changelog_fields()`:
```sql
183: CREATE OR REPLACE FUNCTION public.sync_changelog_fields()
184: RETURNS TRIGGER AS $$
185: BEGIN
186:     -- Synchronize publish boolean & status
187:     IF NEW.is_published = TRUE AND (NEW.status IS NULL OR NEW.status = 'draft') THEN
188:         NEW.status = 'published';
189:     ELSIF NEW.status = 'published' THEN
190:         NEW.is_published = TRUE;
191:     ELSIF NEW.is_published = FALSE AND (NEW.status IS NULL OR NEW.status = 'published') THEN
192:         NEW.status = 'draft';
193:     ELSIF NEW.status = 'draft' THEN
194:         NEW.is_published = FALSE;
195:     END IF;
196: 
197:     -- Automatically set published_at timestamp
198:     IF NEW.is_published = TRUE AND NEW.published_at IS NULL THEN
199:         NEW.published_at = timezone('utc'::text, now());
200:     ELSIF NEW.is_published = FALSE THEN
201:         NEW.published_at = NULL;
202:     END IF;
203: 
204:     -- Synchronize markdown fields
205:     IF NEW.raw_markdown IS NOT NULL AND NEW.raw_markdown <> '' AND (NEW.markdown_body IS NULL OR NEW.markdown_body = '') THEN
206:         NEW.markdown_body = NEW.raw_markdown;
207:     ELSIF NEW.markdown_body IS NOT NULL AND NEW.markdown_body <> '' AND (NEW.raw_markdown IS NULL OR NEW.raw_markdown = '') THEN
208:         NEW.raw_markdown = NEW.markdown_body;
209:     END IF;
210: 
211:     RETURN NEW;
212: END;
213: $$ LANGUAGE plpgsql;
```

Lines 220–246 define `sync_pull_request_fields()`:
```sql
220: CREATE OR REPLACE FUNCTION public.sync_pull_request_fields()
221: RETURNS TRIGGER AS $$
222: BEGIN
223:     -- Sync author names
224:     IF NEW.author_login IS NOT NULL AND NEW.author_login <> '' AND (NEW.author IS NULL OR NEW.author = '') THEN
225:         NEW.author = NEW.author_login;
226:     ELSIF NEW.author IS NOT NULL AND NEW.author <> '' AND (NEW.author_login IS NULL OR NEW.author_login = '') THEN
227:         NEW.author_login = NEW.author;
228:     END IF;
229: 
230:     -- Sync release/changelog IDs
231:     IF NEW.changelog_id IS NOT NULL AND NEW.release_id IS NULL THEN
232:         NEW.release_id = NEW.changelog_id;
233:     ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL THEN
234:         NEW.changelog_id = NEW.release_id;
235:     END IF;
236: 
237:     -- Sync status and noise filter
238:     IF NEW.is_filtered = TRUE AND NEW.status NOT IN ('excluded', 'filtered') THEN
239:         NEW.status = 'excluded';
240:     ELSIF NEW.status IN ('excluded', 'filtered') THEN
241:         NEW.is_filtered = TRUE;
242:     END IF;
243: 
244:     RETURN NEW;
245: END;
246: $$ LANGUAGE plpgsql;
```

### 1.2 Empirical Failure Reproduction from Reviewer 2 & Challenger 2
1. **Unpublishing Trap (`sync_changelog_fields`)**:
   - Starting state: `is_published = true, status = 'published'`.
   - Mutation: `UPDATE changelogs SET is_published = false WHERE id = '...';`
   - Omitted column: `status` remains `'published'` from `OLD.status`.
   - Line 187 evaluates `false`.
   - Line 189 `ELSIF NEW.status = 'published'` evaluates `true`.
   - Line 190 forces `NEW.is_published = TRUE;`.
   - Result: Unpublishing is cancelled; row remains `is_published = true, status = 'published'`.
2. **Draft Status Trap (`sync_changelog_fields`)**:
   - Starting state: `is_published = true, status = 'published'`.
   - Mutation: `UPDATE changelogs SET status = 'draft' WHERE id = '...';`
   - Omitted column: `is_published` remains `true` from `OLD.is_published`.
   - Line 187 evaluates `true` because `NEW.is_published = TRUE AND NEW.status = 'draft'`.
   - Line 188 forces `NEW.status = 'published';`.
   - Result: Setting status to draft is cancelled; row remains `status = 'published'`.
3. **Markdown Desynchronization Trap (`sync_changelog_fields`)**:
   - Starting state: `raw_markdown = '# Notes', markdown_body = '# Notes'`.
   - Mutation: `UPDATE changelogs SET markdown_body = '# Updated Notes' WHERE id = '...';`
   - Neither line 205 nor line 207 evaluates `true` because both fields are non-empty.
   - Result: `raw_markdown` retains `# Notes` while `markdown_body` receives `# Updated Notes`. The two columns permanently diverge.
4. **Release Detachment Resurrect Trap (`sync_pull_request_fields`)**:
   - Starting state: `changelog_id = 'c1', release_id = 'c1'`.
   - Mutation: `UPDATE pull_requests SET changelog_id = NULL WHERE id = '...';`
   - Omitted column: `release_id` remains `'c1'` from `OLD.release_id`.
   - Line 231 evaluates `false`.
   - Line 233 `ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL` evaluates `true`.
   - Line 234 forces `NEW.changelog_id = NEW.release_id;` (repopulating `'c1'`).
   - Result: Detaching a PR from a release is completely cancelled.
5. **Un-exclusion Overwrite Trap (`sync_pull_request_fields`)**:
   - Starting state: `status = 'excluded', is_filtered = true`.
   - Mutation A: `UPDATE pull_requests SET is_filtered = false WHERE id = '...';`
     - Line 238 evaluates `false`.
     - Line 240 `ELSIF NEW.status IN ('excluded', 'filtered')` evaluates `true`.
     - Line 241 forces `NEW.is_filtered = TRUE;`.
   - Mutation B: `UPDATE pull_requests SET status = 'unreleased' WHERE id = '...';`
     - Line 238 evaluates `true` because `NEW.is_filtered = TRUE` and `'unreleased'` is not in `('excluded', 'filtered')`.
     - Line 239 forces `NEW.status = 'excluded';`.
   - Result: Founders in M4 dashboard cannot toggle PRs from excluded to unreleased/included unless both columns are passed simultaneously.

---

## 2. Logic Chain

1. **State-Trapping Mechanism**:
   - In PostgreSQL, column values not specified in an `UPDATE` statement default to the row's prior values (`OLD.<column>`).
   - The original trigger functions did not branch on `TG_OP` (`INSERT` vs `UPDATE`).
   - The original triggers used static `IF ... ELSIF` chains that checked column equality against literal values rather than detecting which field changed relative to `OLD`.
   - Because one side of each synchronized pair was populated from `OLD`, the static conditions evaluated old state and forcefully overwrote the newly requested changes.

2. **Remediation Strategy — Delta Detection via `IS DISTINCT FROM`**:
   - **Changelog Status & Publication**:
     - Check `IF NEW.status IS DISTINCT FROM OLD.status`: The caller deliberately altered `status`. Therefore, synchronize `NEW.is_published = (NEW.status = 'published')`.
     - `ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published`: The caller deliberately altered `is_published`. Therefore, synchronize `NEW.status = CASE WHEN NEW.is_published THEN 'published' ELSE 'draft' END`.
     - `published_at`: If `NEW.is_published = TRUE`, set `published_at = timezone('utc'::text, now())` only if `NEW.published_at IS NULL` (preserving explicit/historical timestamps). If `NEW.is_published = FALSE`, set `NEW.published_at = NULL`.
   - **Changelog Markdown Synchronization**:
     - Check `IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body`: Synchronize `NEW.raw_markdown = COALESCE(NEW.markdown_body, '')`.
     - `ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown`: Synchronize `NEW.markdown_body = COALESCE(NEW.raw_markdown, '')`.
   - **Pull Request Release Unlinking & Attachment**:
     - Check `IF (NEW.changelog_id IS NULL AND OLD.changelog_id IS NOT NULL) OR (NEW.release_id IS NULL AND OLD.release_id IS NOT NULL)`: The caller explicitly cleared release association. Therefore, clear BOTH: `NEW.changelog_id = NULL; NEW.release_id = NULL;`.
     - Furthermore, if `OLD.status = 'released'` and the caller did not specify a new status (`NEW.status IS NOT DISTINCT FROM OLD.status`), automatically return the PR to the unreleased queue: `NEW.status = 'unreleased'; NEW.is_filtered = FALSE;`. This also cleanly handles `ON DELETE SET NULL` cascade when a changelog draft is deleted.
     - `ELSIF NEW.changelog_id IS DISTINCT FROM OLD.changelog_id`: Synchronize `NEW.release_id = NEW.changelog_id;`.
     - `ELSIF NEW.release_id IS DISTINCT FROM OLD.release_id`: Synchronize `NEW.changelog_id = NEW.release_id;`.
   - **Pull Request Status & Noise Filtering**:
     - Check `IF NEW.status IS DISTINCT FROM OLD.status`:
       - If `NEW.status IN ('unreleased', 'queued', 'included', 'released')`, set `NEW.is_filtered = FALSE;`.
       - If `NEW.status IN ('excluded', 'filtered')`, set `NEW.is_filtered = TRUE;`.
     - `ELSIF NEW.is_filtered IS DISTINCT FROM OLD.is_filtered`:
       - If `NEW.is_filtered = FALSE`, set `NEW.status = 'unreleased';`.
       - If `NEW.is_filtered = TRUE` and `NEW.status NOT IN ('excluded', 'filtered')`, set `NEW.status = 'excluded';`.
   - **Author Synchronization**:
     - Check `IF NEW.author_login IS DISTINCT FROM OLD.author_login`: `NEW.author = COALESCE(NEW.author_login, '')`.
     - `ELSIF NEW.author IS DISTINCT FROM OLD.author`: `NEW.author_login = COALESCE(NEW.author, '')`.
   - **INSERT Branch Separation**:
     - On `INSERT`, `OLD` is not assigned. The trigger branches on `ELSE -- INSERT` and evaluates initial non-null values without referencing `OLD`.

3. **Empirical Validation**:
   - The proposed functions were tested against an isolated PostgreSQL 16 Alpine instance across 21 rigorous test cases:
     - 6 changelog test cases: Insert published, update unpublish, update status publish, update status draft, update markdown body, update raw markdown.
     - 15 pull request test cases: Ingest active, ingest noise by filter, ingest noise by status, attach release via changelog_id, detach release via changelog_id=NULL, attach via release_id, detach via release_id=NULL, un-exclude via is_filtered=false, un-exclude via status=unreleased, set included, set queued, exclude via is_filtered=true, exclude via status=filtered, update title with no side effects, and detach released PR returning to unreleased queue.
   - Result: All 21 tests succeeded with 100% expected state transitions and zero regressions.

---

## 3. Caveats

1. **Adversarial Audit Tests in `tests/unit/database-stress.test.ts`**:
   - Lines 363–389 of `tests/unit/database-stress.test.ts` contain tests written by Challenger 2 that intentionally assert that `initial_schema.sql` contains the **vulnerable code strings**:
     - Line 369: `expect(initialSql).toContain('ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL THEN');`
     - Line 378: `expect(initialSql).toContain("IF NEW.is_filtered = TRUE AND NEW.status NOT IN ('excluded', 'filtered') THEN");`
     - Line 386: `expect(initialSql).toContain("IF NEW.raw_markdown IS NOT NULL AND NEW.raw_markdown <> '' AND (NEW.markdown_body IS NULL OR NEW.markdown_body = '') THEN");`
   - When the worker applies this remediation patch to `initial_schema.sql`, those three specific assertions in `database-stress.test.ts` will fail unless they are updated to assert the remediated delta-detection signatures. The updated test code is provided below in Section 4.3.
2. **Scope Boundary**:
   - In accordance with the dispatch instructions, this explorer did not modify source files directly. Code delivery is made via the patch artifact and proposed SQL file in this directory.

---

## 4. Conclusion & Drop-In Code

### 4.1 Exact Drop-In Replacement SQL

Replace lines 182–251 of `supabase/migrations/20260922000001_initial_schema.sql` with:

```sql
-- Synchronize Changelogs fields (is_published <-> status, raw_markdown <-> markdown_body)
CREATE OR REPLACE FUNCTION public.sync_changelog_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Delta detection for status <-> is_published
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.is_published = (NEW.status = 'published');
        ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
            IF NEW.is_published THEN
                NEW.status = 'published';
            ELSE
                NEW.status = 'draft';
            END IF;
        END IF;

        -- Delta detection for markdown fields
        IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body THEN
            NEW.raw_markdown = COALESCE(NEW.markdown_body, '');
        ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown THEN
            NEW.markdown_body = COALESCE(NEW.raw_markdown, '');
        END IF;
    ELSE -- INSERT
        IF NEW.status = 'published' THEN
            NEW.is_published = TRUE;
        ELSIF NEW.is_published = TRUE THEN
            NEW.status = 'published';
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

    -- Manage published_at timestamp
    IF NEW.is_published = TRUE THEN
        IF NEW.published_at IS NULL THEN
            NEW.published_at = timezone('utc'::text, now());
        END IF;
    ELSIF NEW.is_published = FALSE THEN
        NEW.published_at = NULL;
    END IF;

    -- Ensure non-null invariants
    NEW.raw_markdown = COALESCE(NEW.raw_markdown, '');
    NEW.markdown_body = COALESCE(NEW.markdown_body, '');
    NEW.is_published = COALESCE(NEW.is_published, FALSE);
    NEW.status = COALESCE(NEW.status, 'draft');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_changelog_fields
    BEFORE INSERT OR UPDATE ON public.changelogs
    FOR EACH ROW EXECUTE FUNCTION public.sync_changelog_fields();

-- Synchronize Pull Request fields (author <-> author_login, changelog_id <-> release_id, status <-> is_filtered)
CREATE OR REPLACE FUNCTION public.sync_pull_request_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- 1. Sync author <-> author_login
        IF NEW.author_login IS DISTINCT FROM OLD.author_login THEN
            NEW.author = COALESCE(NEW.author_login, '');
        ELSIF NEW.author IS DISTINCT FROM OLD.author THEN
            NEW.author_login = COALESCE(NEW.author, '');
        END IF;

        -- 2. Sync changelog_id <-> release_id (unlinking and attachment)
        IF (NEW.changelog_id IS NULL AND OLD.changelog_id IS NOT NULL) OR
           (NEW.release_id IS NULL AND OLD.release_id IS NOT NULL) THEN
            NEW.changelog_id = NULL;
            NEW.release_id = NULL;
            -- If released PR is detached, return to unreleased queue
            IF (NEW.status IS NOT DISTINCT FROM OLD.status) AND NEW.status = 'released' THEN
                NEW.status = 'unreleased';
                NEW.is_filtered = FALSE;
            END IF;
        ELSIF NEW.changelog_id IS DISTINCT FROM OLD.changelog_id THEN
            NEW.release_id = NEW.changelog_id;
        ELSIF NEW.release_id IS DISTINCT FROM OLD.release_id THEN
            NEW.changelog_id = NEW.release_id;
        END IF;

        -- 3. Sync status <-> is_filtered
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status IN ('unreleased', 'queued', 'included', 'released') THEN
                NEW.is_filtered = FALSE;
            ELSIF NEW.status IN ('excluded', 'filtered') THEN
                NEW.is_filtered = TRUE;
            END IF;
        ELSIF NEW.is_filtered IS DISTINCT FROM OLD.is_filtered THEN
            IF NEW.is_filtered = FALSE THEN
                NEW.status = 'unreleased';
            ELSIF NEW.is_filtered = TRUE THEN
                IF NEW.status NOT IN ('excluded', 'filtered') THEN
                    NEW.status = 'excluded';
                END IF;
            END IF;
        END IF;

    ELSE -- INSERT
        -- 1. Sync author <-> author_login
        IF COALESCE(NEW.author_login, '') <> '' AND COALESCE(NEW.author, '') = '' THEN
            NEW.author = NEW.author_login;
        ELSIF COALESCE(NEW.author, '') <> '' AND COALESCE(NEW.author_login, '') = '' THEN
            NEW.author_login = NEW.author;
        END IF;

        -- 2. Sync release/changelog IDs
        IF NEW.changelog_id IS NOT NULL AND NEW.release_id IS NULL THEN
            NEW.release_id = NEW.changelog_id;
        ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL THEN
            NEW.changelog_id = NEW.release_id;
        END IF;

        -- 3. Sync status and noise filter
        IF NEW.status IN ('excluded', 'filtered') THEN
            NEW.is_filtered = TRUE;
        ELSIF NEW.is_filtered = TRUE THEN
            NEW.status = 'excluded';
        ELSIF NEW.status IN ('unreleased', 'queued', 'included', 'released') THEN
            NEW.is_filtered = FALSE;
        END IF;
    END IF;

    -- Ensure non-null invariants
    NEW.author = COALESCE(NEW.author, '');
    NEW.author_login = COALESCE(NEW.author_login, '');
    NEW.is_filtered = COALESCE(NEW.is_filtered, FALSE);
    NEW.status = COALESCE(NEW.status, 'unreleased');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_pull_request_fields
    BEFORE INSERT OR UPDATE ON public.pull_requests
    FOR EACH ROW EXECUTE FUNCTION public.sync_pull_request_fields();
```

### 4.2 Machine-Applicable Patch
The complete patch has been verified and saved at:
`/home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_2/schema_triggers.patch`

It can be directly applied to the codebase by `m1_worker_1` using:
```bash
patch -p1 < /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_2/schema_triggers.patch
```

### 4.3 Recommended Test Update for `tests/unit/database-stress.test.ts`
When applying the patch, update lines 363–389 of `tests/unit/database-stress.test.ts` as follows:

```typescript
    it('TRIGGER REMEDIATION: sync_pull_request_fields clears both fields when unlinking release', () => {
      expect(initialSql).toContain('IF (NEW.changelog_id IS NULL AND OLD.changelog_id IS NOT NULL) OR');
      expect(initialSql).toContain('NEW.changelog_id = NULL;');
      expect(initialSql).toContain('NEW.release_id = NULL;');
    });

    it('TRIGGER REMEDIATION: sync_pull_request_fields supports un-exclusion via delta detection', () => {
      expect(initialSql).toContain('ELSIF NEW.is_filtered IS DISTINCT FROM OLD.is_filtered THEN');
      expect(initialSql).toContain("NEW.status = 'unreleased';");
    });

    it('TRIGGER REMEDIATION: sync_changelog_fields synchronizes markdown edits via delta detection', () => {
      expect(initialSql).toContain('IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body THEN');
      expect(initialSql).toContain('ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown THEN');
    });
```

---

## 5. Verification Method

To independently verify the proposed triggers:

1. **Verify Patch Cleanliness**:
   ```bash
   patch -p1 --dry-run < /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_2/schema_triggers.patch
   ```
   *Expected Output*: `checking file supabase/migrations/20260922000001_initial_schema.sql` (exit code 0).

2. **Empirical PostgreSQL Test**:
   Spin up a test database:
   ```bash
   docker run --rm -d --name temp_pg_verify -e POSTGRES_PASSWORD=test postgres:16-alpine && sleep 2
   ```
   Apply schema and test triggers with the provided queries in `.agents/m1_r2_explorer_2/proposed_triggers.sql`.
   Clean up:
   ```bash
   docker stop temp_pg_verify
   ```

3. **Invalidation Conditions**:
   - If an `UPDATE` on `changelogs` with `{ is_published: false }` fails to set `status = 'draft'` or fails to clear `published_at`.
   - If an `UPDATE` on `pull_requests` with `{ changelog_id: null }` resurrects `release_id`.
   - If an `UPDATE` on `pull_requests` with `{ is_filtered: false }` or `{ status: 'unreleased' }` is reverted back to `'excluded'`.
