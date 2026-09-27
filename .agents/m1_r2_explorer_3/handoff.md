# M1 Mock Database & Component Remediation Handoff Report (Iteration 2)

**Agent**: `m1_r2_explorer_3` (M1 Mock DB & Component Explorer — Iteration 2)  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  
**Working Directory**: `/home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3`  
**Date**: 2026-09-22T18:35:00Z  

---

## 1. Observation

### 1.1 Direct Code Observations & Verbatim Citations

1. **`tests/mocks/mock-supabase.ts:124-137` — Mutation Action Overwrite in Query Builder**:
   ```typescript
   124: select: (_fields = '*') => {
   125:   action = 'select';
   126:   return builder;
   127: },
   128: insert: (data: any | any[]) => {
   129:   action = 'insert';
   130:   mutationValues = data;
   131:   return builder;
   132: },
   133: update: (updates: any) => {
   134:   action = 'update';
   135:   mutationValues = updates;
   136:   return builder;
   137: },
   ```
   Calling `.insert(data).select()` or `.update(data).select()` or `.delete().select()` reassigns `action = 'select'` on line 125. In `execute()`, lines 32 (`action === 'insert'`), 44 (`action === 'upsert'`), 70 (`action === 'update'`), and 85 (`action === 'delete'`) are skipped entirely. Mutation logic is never executed, and `store[tableName]` is never altered.

2. **`tests/mocks/mock-supabase.ts:44-64` — Upsert Hardcoded Strictly to `id` Column**:
   ```typescript
   47: for (const item of items) {
   48:   const idx = store[tableName].findIndex((r: any) => r.id === item.id);
   49:   if (idx >= 0) {
   50:     store[tableName][idx] = { ...store[tableName][idx], ...item, updated_at: new Date().toISOString() };
   51:     upserted.push(store[tableName][idx]);
   52:   } else {
   53:     const newItem = {
   54:       id: item.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
   55:       created_at: new Date().toISOString(),
   56:       updated_at: new Date().toISOString(),
   57:       ...item,
   58:     };
   59:     store[tableName].push(newItem);
   60:     upserted.push(newItem);
   61:   }
   62: }
   ```
   Upsert matching strictly assumes `item.id`. Furthermore, the builder method `upsert: (values: any | any[]) => { ... }` lacks the `options?: { onConflict?: string; ignoreDuplicates?: boolean }` argument expected by Supabase JS v2. For tables like `dodo_webhook_events` (where `event_id` is the idempotency key) and `pull_requests` (where `(project_id, pr_number)` is the composite key), `item.id` is undefined. Every upsert generates a new ID (`mock_...`), storing duplicate event rows instead of deduplicating.

3. **`tests/mocks/mock-supabase.ts:105-118` — Cardinality Suppression on `.single()` and `.maybeSingle()`**:
   ```typescript
   105: if (isSingle) {
   106:   if (rows.length === 0) {
   107:     return {
   108:       data: null,
   109:       error: { message: 'Row not found', code: 'PGRST116' },
   110:       count: 0,
   111:     };
   112:   }
   113:   return { data: rows[0], error: null, count: 1 };
   114: }
   115: 
   116: if (isMaybeSingle) {
   117:   return { data: rows[0] || null, error: null, count: rows.length };
   118: }
   ```
   PostgREST specification and Supabase JS v2 require that when multiple rows match (`rows.length > 1`), `.single()` and `.maybeSingle()` return an error (`PGRST116: JSON object requested, multiple rows returned`) and `data: null`. In `mock-supabase.ts`, line 113 and line 117 silently returned `rows[0]` with `error: null`.

4. **`components/ui/toast.tsx:26-42 & 119-129` — Unexported `toastVariants`**:
   ```typescript
   26: const toastVariants = cva(
   27:   "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all ...",
   ...
   42: );
   ...
   119: export {
   120:   type ToastProps,
   121:   type ToastActionElement,
   122:   ToastProvider,
   123:   ToastViewport,
   124:   Toast,
   125:   ToastTitle,
   126:   ToastDescription,
   127:   ToastClose,
   128:   ToastAction,
   129: };
   ```
   `toastVariants` is declared locally at line 26 but omitted from the `export` statement at lines 119-129. If external callers or tests import `import { toastVariants } from "@/components/ui/toast"`, TypeScript produces error `TS2459: Module '"@/components/ui/toast"' declares 'toastVariants' locally, but it is not exported`. In contrast, `buttonVariants` is exported in `components/ui/button.tsx:56` and `badgeVariants` is exported in `components/ui/badge.tsx:43`.

5. **`tests/unit/database-stress.test.ts:139-332` — Empirical Negative Assertions**:
   In `tests/unit/database-stress.test.ts`, Challenger 2 added 6 empirical tests that verified these defects by asserting the buggy output:
   - Line 146: `expect(res.data).toEqual([]); expect(check.data).toHaveLength(0);`
   - Line 161: `expect(res.data[0].name).toBe('Original'); expect(check.data.name).toBe('Original');`
   - Line 176: `expect(res.data).toHaveLength(1); expect(check.data).toHaveLength(1);`
   - Line 235: `expect(check.data).toHaveLength(2);`
   - Line 299: `expect(res.error).toBeNull(); expect(res.data.id).toBe('p1');`
   - Line 330: `expect(res.error).toBeNull(); expect(res.data.id).toBe('p1');`

---

## 2. Logic Chain

1. **Mutation Chaining Failure (Observation 1.1.1)**:
   - Standard Supabase v2 code relies on `.insert(row).select()` or `.update(row).eq('id', id).select()` to perform the mutation and immediately return the mutated record.
   - When `.select()` unconditionally assigns `action = 'select'`, it overwrites the `'insert'`, `'update'`, `'upsert'`, or `'delete'` intent.
   - The query execution branch drops through to reading `store[tableName]` before any row is written, returning `[]` or unmodified stale rows.
   - *Deduction*: `.select()` must check if `action` is already a mutation. If so, `action` must remain unchanged, and `selectCalled = true` must be flagged so that subsequent execution executes the mutation and returns the mutated rows.

2. **Webhook Idempotency Failure (Observation 1.1.2)**:
   - Requirements R4 / M6 mandate idempotent webhook processing for `dodo_webhook_events` (deduplicated on `event_id`) and GitHub pull requests (deduplicated on `(project_id, pr_number)`).
   - Because `mock-supabase.ts` only evaluated `r.id === item.id`, and `item.id` is not provided in webhook ingestion payloads, `r.id === item.id` was always false.
   - *Deduction*: `.upsert()` must accept `options?: { onConflict?: string; ignoreDuplicates?: boolean }`. When `onConflict` is provided, it must split and match by the specified column(s). When `onConflict` is omitted, it should fall back to known table unique keys (`event_id` for `dodo_webhook_events`, `(project_id, pr_number)` for `pull_requests`, `slug` for `projects`, `id` as default).

3. **Cardinality Violation Masking (Observation 1.1.3)**:
   - In PostgREST / Supabase, `.single()` and `.maybeSingle()` both specify that returning more than 1 row is an invalid state that must fail with PostgREST error `PGRST116: JSON object requested, multiple rows returned`.
   - By returning `rows[0]` with `error: null`, the mock masked duplicate-row bugs and prevented tests from verifying that unique indexes and single-record queries function as intended.
   - *Deduction*: A centralized `formatResult(rows)` function must evaluate:
     - If `rows.length === 0`: `.single()` returns `PGRST116: Row not found`; `.maybeSingle()` returns `{ data: null, error: null }`.
     - If `rows.length === 1`: both return `{ data: rows[0], error: null, count: 1 }`.
     - If `rows.length > 1`: both return `{ data: null, error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' }, count: rows.length }`.

4. **Component Export Parity (Observation 1.1.4)**:
   - Design system primitives in `components/ui/` (`button.tsx`, `badge.tsx`) export their `*Variants` CVA instances for external consumers (e.g., custom wrappers, compound components, or unit tests).
   - `toastVariants` was omitted from `export { ... }` in `components/ui/toast.tsx`.
   - *Deduction*: Adding `toastVariants` to the `export { ... }` list resolves the export gap, aligns with the rest of the UI primitives, and prevents `TS2459` compiler errors.

5. **Test Alignment (Observation 1.1.5)**:
   - Once the remediation is applied, Challenger 2's negative empirical reproduction tests in `database-stress.test.ts` will fail unless their assertions are updated to verify the corrected PostgREST behavior.
   - *Deduction*: A patch must be provided for `database-stress.test.ts` to convert the 6 negative bug tests into positive regression tests.

---

## 3. Caveats

1. **Read-Only Scope**: Per the explorer role constraints, no source files were directly edited. All proposed code has been written as drop-in replacement and patch artifacts in `/home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3/`.
2. **PostgREST Column Projection**: In production Supabase, calling `.select('id, name')` returns a projected object containing only those columns. In this mock harness, the full row object is returned (preserving all keys) to avoid breaking test assertions that check timestamps or metadata, which is standard practice for in-memory unit testing doubles.
3. **Trigger Logic & RLS in SQL Files**: Challenger 2 also identified issues in `supabase/migrations/` regarding the `webhook_secret` RLS policy and trigger traps in `sync_pull_request_fields`. Those are within the scope of database schema remediation (handled by parallel subagents/workers) and are not touched by this TypeScript mock query builder remediation.

---

## 4. Conclusion & Concrete Remediation Plan

The remediation is fully designed and available in three ready-to-apply artifacts in `/home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3/`:
1. `proposed_mock-supabase.ts` (complete drop-in replacement for `tests/mocks/mock-supabase.ts`)
2. `proposed_toast.tsx.patch` (patch for `components/ui/toast.tsx`)
3. `proposed_database-stress.test.ts.patch` (patch for `tests/unit/database-stress.test.ts`)

### 4.1 Exact Code Implementation for `tests/mocks/mock-supabase.ts`

```typescript
/**
 * In-memory deterministic mock Supabase client for unit and integration testing.
 * Implements standard query chaining: .from().select().insert().update().upsert().delete().eq().single()
 * Faithfully mirrors Supabase JS v2 & PostgREST semantics for mutations, upsert conflict matching,
 * and single/maybeSingle cardinality enforcement.
 */
export function createMockSupabaseClient(initialData: Record<string, any[]> = {}) {
  const store: Record<string, any[]> = {
    profiles: [],
    installations: [],
    projects: [],
    changelogs: [],
    pull_requests: [],
    dodo_webhook_events: [],
    ...initialData,
  };

  return {
    from: (tableName: string) => {
      if (!store[tableName]) {
        store[tableName] = [];
      }
      let filters: Array<(row: any) => boolean> = [];
      let orderField: string | null = null;
      let orderAsc: boolean = true;
      let limitCount: number | null = null;
      let isSingle = false;
      let isMaybeSingle = false;
      let selectCalled = false;
      let action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
      let mutationValues: any = null;
      let upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | undefined = undefined;

      const execute = () => {
        const formatResult = (rows: any[], isDelete = false) => {
          if (isSingle) {
            if (rows.length === 0) {
              return {
                data: null,
                error: { message: 'Row not found', code: 'PGRST116' },
                count: 0,
              };
            }
            if (rows.length > 1) {
              return {
                data: null,
                error: {
                  message: 'JSON object requested, multiple rows returned',
                  code: 'PGRST116',
                },
                count: rows.length,
              };
            }
            return {
              data: isDelete && !selectCalled ? null : rows[0],
              error: null,
              count: 1,
            };
          }

          if (isMaybeSingle) {
            if (rows.length > 1) {
              return {
                data: null,
                error: {
                  message: 'JSON object requested, multiple rows returned',
                  code: 'PGRST116',
                },
                count: rows.length,
              };
            }
            return {
              data: isDelete && !selectCalled ? null : (rows[0] || null),
              error: null,
              count: rows.length,
            };
          }

          if (isDelete && !selectCalled) {
            return { data: null, error: null, count: rows.length };
          }

          return { data: rows, error: null, count: rows.length };
        };

        if (action === 'insert') {
          const items = Array.isArray(mutationValues) ? mutationValues : [mutationValues];
          const inserted = items.map((item: any) => ({
            id: item.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          }));
          store[tableName] = [...store[tableName], ...inserted];
          return formatResult(inserted);
        }

        if (action === 'upsert') {
          const items = Array.isArray(mutationValues) ? mutationValues : [mutationValues];
          const upserted: any[] = [];

          const getConflictCols = (item: any): string[] => {
            if (upsertOptions?.onConflict) {
              return upsertOptions.onConflict
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            }
            // Table-specific unique conflict keys when onConflict option is omitted
            if (tableName === 'dodo_webhook_events' && item.event_id !== undefined) {
              return ['event_id'];
            }
            if (
              tableName === 'pull_requests' &&
              item.project_id !== undefined &&
              item.pr_number !== undefined
            ) {
              return ['project_id', 'pr_number'];
            }
            if (
              tableName === 'installations' &&
              item.github_installation_id !== undefined &&
              item.id === undefined
            ) {
              return ['github_installation_id'];
            }
            if (tableName === 'projects' && item.slug !== undefined && item.id === undefined) {
              return ['slug'];
            }
            return ['id'];
          };

          for (const item of items) {
            const conflictCols = getConflictCols(item);
            const idx = store[tableName].findIndex((r: any) =>
              conflictCols.length > 0 &&
              conflictCols.every(
                (col) => r[col] !== undefined && item[col] !== undefined && r[col] === item[col]
              )
            );

            if (idx >= 0) {
              if (!upsertOptions?.ignoreDuplicates) {
                store[tableName][idx] = {
                  ...store[tableName][idx],
                  ...item,
                  updated_at: item.updated_at || new Date().toISOString(),
                };
              }
              upserted.push(store[tableName][idx]);
            } else {
              const newItem = {
                id: item.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
                created_at: item.created_at || new Date().toISOString(),
                updated_at: item.updated_at || new Date().toISOString(),
                ...item,
              };
              store[tableName].push(newItem);
              upserted.push(newItem);
            }
          }
          return formatResult(upserted);
        }

        if (action === 'update') {
          const updated: any[] = [];
          for (let i = 0; i < store[tableName].length; i++) {
            if (filters.every((f) => f(store[tableName][i]))) {
              store[tableName][i] = {
                ...store[tableName][i],
                ...mutationValues,
                updated_at: new Date().toISOString(),
              };
              updated.push(store[tableName][i]);
            }
          }
          return formatResult(updated);
        }

        if (action === 'delete') {
          const deleted: any[] = [];
          const remaining: any[] = [];
          for (const row of store[tableName]) {
            if (filters.every((f) => f(row))) {
              deleted.push(row);
            } else {
              remaining.push(row);
            }
          }
          store[tableName] = remaining;
          return formatResult(deleted, true);
        }

        // SELECT
        let rows = store[tableName].filter((row: any) =>
          filters.every((f) => f(row))
        );

        if (orderField) {
          rows.sort((a: any, b: any) => {
            if (a[orderField!] < b[orderField!]) return orderAsc ? -1 : 1;
            if (a[orderField!] > b[orderField!]) return orderAsc ? 1 : -1;
            return 0;
          });
        }

        if (limitCount !== null) {
          rows = rows.slice(0, limitCount);
        }

        return formatResult(rows);
      };

      const builder: any = {
        select: (_fields = '*') => {
          selectCalled = true;
          // Preserve active mutation action (insert, update, upsert, delete)
          if (
            action !== 'insert' &&
            action !== 'update' &&
            action !== 'upsert' &&
            action !== 'delete'
          ) {
            action = 'select';
          }
          return builder;
        },
        insert: (data: any | any[]) => {
          action = 'insert';
          mutationValues = data;
          return builder;
        },
        update: (updates: any) => {
          action = 'update';
          mutationValues = updates;
          return builder;
        },
        upsert: (
          values: any | any[],
          options?: { onConflict?: string; ignoreDuplicates?: boolean }
        ) => {
          action = 'upsert';
          mutationValues = values;
          upsertOptions = options;
          return builder;
        },
        delete: () => {
          action = 'delete';
          return builder;
        },
        eq: (column: string, value: any) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        neq: (column: string, value: any) => {
          filters.push((row) => row[column] !== value);
          return builder;
        },
        in: (column: string, values: any[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        is: (column: string, value: any) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        gte: (column: string, value: any) => {
          filters.push((row) => row[column] >= value);
          return builder;
        },
        gt: (column: string, value: any) => {
          filters.push((row) => row[column] > value);
          return builder;
        },
        lte: (column: string, value: any) => {
          filters.push((row) => row[column] <= value);
          return builder;
        },
        lt: (column: string, value: any) => {
          filters.push((row) => row[column] < value);
          return builder;
        },
        match: (query: Record<string, any>) => {
          for (const [key, value] of Object.entries(query)) {
            filters.push((row) => row[key] === value);
          }
          return builder;
        },
        order: (column: string, { ascending = true } = {}) => {
          orderField = column;
          orderAsc = ascending;
          return builder;
        },
        limit: (count: number) => {
          limitCount = count;
          return builder;
        },
        single: () => {
          isSingle = true;
          return builder;
        },
        maybeSingle: () => {
          isMaybeSingle = true;
          return builder;
        },
        then: (onfulfilled?: any, onrejected?: any) => {
          try {
            const res = execute();
            return Promise.resolve(res).then(onfulfilled, onrejected);
          } catch (err) {
            if (onrejected) return Promise.resolve(onrejected(err));
            return Promise.reject(err);
          }
        },
      };

      return builder;
    },
    auth: {
      getUser: async () => ({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { user: { id: 'mock-user-id' } } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
  };
}
```

### 4.2 Exact Code Implementation for `components/ui/toast.tsx`

In `components/ui/toast.tsx`, update lines 119-129 to include `toastVariants`:

```typescript
export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
};
```

---

## 5. Verification Method

### 5.1 Verification Commands

1. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```
   *Expected outcome*: Exit code 0, 0 errors.

2. **Apply proposed replacement and test**:
   ```bash
   cp .agents/m1_r2_explorer_3/proposed_mock-supabase.ts tests/mocks/mock-supabase.ts
   git apply .agents/m1_r2_explorer_3/proposed_toast.tsx.patch
   git apply .agents/m1_r2_explorer_3/proposed_database-stress.test.ts.patch
   npx vitest run tests/unit/database-stress.test.ts
   ```
   *Expected outcome*: All tests in `tests/unit/database-stress.test.ts` pass cleanly.

3. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected outcome*: All test suites pass (foundation, adversarial-ui, database-stress).

### 5.2 Invalidation Conditions

The remediation is considered invalidated if:
1. `mockDb.from('table').insert(data).select()` returns `data: []` or does not mutate `store['table']`.
2. `mockDb.from('dodo_webhook_events').upsert({ event_id: 'duplicate' })` creates 2 records rather than updating the existing row in place.
3. `.single()` or `.maybeSingle()` on matching multiple rows (`rows.length > 1`) returns `error: null` rather than `error.code === 'PGRST116'`.
4. `import { toastVariants } from '@/components/ui/toast'` produces a TypeScript `TS2459` unexported member error.
