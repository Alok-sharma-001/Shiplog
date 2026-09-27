# M1 Iteration 2 Explorer 3 Dispatch: Mock Database & Component Remediation

## Identity
- Role: M1 Mock DB & Component Explorer (Iteration 2)
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Mandatory Reading
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/m1_challenger_2/handoff.md
4. /home/alok/Projects_Antigravity/bsAK/tests/mocks/mock-supabase.ts
5. /home/alok/Projects_Antigravity/bsAK/components/ui/toast.tsx

## Iteration 1 Failure Feedback & Mission
Challenger 2 discovered critical defects in `tests/mocks/mock-supabase.ts` and `components/ui/toast.tsx`:
1. Chained Mutation Action Overwrite in Mock Query Builder (`mock-supabase.ts`):
   - Calling `.insert(data).select()` or `.update(data).select()` causes `select()` to overwrite `action = 'select'`. In `execute()`, mutation logic is completely bypassed and rows are never inserted or updated.
2. Webhook Deduplication Key in `.upsert()` (`mock-supabase.ts`):
   - `.upsert()` strictly searches by `r.id === item.id`. Tables like `dodo_webhook_events` deduplicate on `event_id`, and `pull_requests` on `(project_id, pr_number)`. The mock must support matching on a custom conflict column or composite key so idempotent webhook tests pass properly.
3. `.single()` / `.maybeSingle()` Cardinality Check:
   - When multiple rows match, `.single()` must return `{ data: null, error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' }, count: rows.length }`.
4. Component Export Gap:
   - In `components/ui/toast.tsx`, `toastVariants` is declared but not exported, causing potential TS2459 errors when external modules import it.

Your Mission:
Design the exact, drop-in TypeScript remediation for `tests/mocks/mock-supabase.ts` and `components/ui/toast.tsx`:
- Fix query builder so that `.select()` preserves existing mutation actions (`insert`, `update`, `upsert`, `delete`) and returns the mutated data.
- Support options in `.upsert(values, options?: { onConflict?: string })`.
- Return PGRST116 error when `rows.length > 1` on `.single()` or `.maybeSingle()`.
- Export `toastVariants` in `components/ui/toast.tsx`.
Deliver your report to `.agents/m1_r2_explorer_3/handoff.md` and notify parent via `send_message`.
Do NOT implement code directly.

## 2026-09-22T18:27:13Z
<USER_REQUEST>
You are M1 Mock DB & Component Explorer (Iteration 2) for ShipLog.
Your working directory is: /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3
Your parent is conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

You MUST read:
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3/DISPATCH.md
4. /home/alok/Projects_Antigravity/bsAK/.agents/m1_challenger_2/handoff.md
5. /home/alok/Projects_Antigravity/bsAK/tests/mocks/mock-supabase.ts
6. /home/alok/Projects_Antigravity/bsAK/components/ui/toast.tsx

Your mission:
Design the drop-in TypeScript remediation for tests/mocks/mock-supabase.ts (fixing mutation action chaining, upsert onConflict matching, and single/maybeSingle cardinality checks) and export toastVariants in components/ui/toast.tsx.
Deliver your report to /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_3/handoff.md and notify parent via send_message.
Do NOT write code to source files.
</USER_REQUEST>
