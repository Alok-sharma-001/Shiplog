# M1 Iteration 2 Explorer 1 Dispatch: Database Security & RLS Remediation

## Identity
- Role: M1 Security & RLS Explorer (Iteration 2)
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_1
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Mandatory Reading
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/m1_reviewer_2/handoff.md
4. /home/alok/Projects_Antigravity/bsAK/.agents/m1_challenger_2/handoff.md

## Iteration 1 Failure Feedback & Mission
Reviewer 2 and Challenger 2 discovered critical security vulnerabilities in `supabase/migrations/20260922000002_rls_policies.sql`:
1. Universal RLS Leak on `public.projects`: `CREATE POLICY "Public read project info by slug" ON public.projects ... USING (true)` overrides `auth.uid() = user_id` for authenticated dashboard queries and allows anyone (including anonymous visitors with the public anon key) to read all projects and scrape `webhook_secret` (the GitHub HMAC verification secret).
2. Privilege Escalation on `public.profiles`: The `UPDATE` policy on `profiles` allows any authenticated user to update their own row without column restrictions, allowing any Free user to set `tier = 'pro'` and `subscription_status = 'active'` directly, bypassing Dodo Payments billing.

Your Mission:
Design the exact, drop-in SQL remediation for `supabase/migrations/20260922000002_rls_policies.sql` and `20260922000001_initial_schema.sql`:
- Remove the insecure `USING (true)` policy on `projects`. Public read for `/c/[slug]` and `/api/v1/widget/[slug]` will be performed securely via `createAdminClient()` (or a dedicated sanitized security definer function returning only safe public columns `id`, `name`, `slug`, `is_pro_override`, `custom_domain`).
- Guard `profiles` tier and subscription columns against unauthorized updates (e.g. using a trigger that prevents non-service-role changes to `tier` / `subscription_status`, or column security).
- Ensure `tests/unit/foundation.test.ts` asserts these secure RLS rules.
Deliver your report to `.agents/m1_r2_explorer_1/handoff.md` and notify parent via `send_message`.
Do NOT implement code directly.

## 2026-09-22T18:27:13Z
Received invocation:
Mission: Design the drop-in SQL fixes for supabase/migrations/20260922000002_rls_policies.sql to eliminate the universal RLS leak on public.projects and prevent unauthorized profile tier escalation on public.profiles.
Deliver your report to /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_1/handoff.md and notify parent via send_message.
Do NOT write code to source files.

