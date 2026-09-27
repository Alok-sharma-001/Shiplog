# M1 Iteration 2 Explorer 2 Dispatch: Database Trigger Synchronization Remediation

## Identity
- Role: M1 Trigger Synchronization Explorer (Iteration 2)
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_2
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Mandatory Reading
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/m1_reviewer_2/handoff.md
4. /home/alok/Projects_Antigravity/bsAK/.agents/m1_challenger_2/handoff.md

## Iteration 1 Failure Feedback & Mission
Reviewer 2 and Challenger 2 discovered critical state traps in PostgreSQL triggers in `supabase/migrations/20260922000001_initial_schema.sql`:
1. `sync_changelog_fields()`: During an `UPDATE`, updating `{ is_published: false }` causes the trigger to see `OLD.status = 'published'` and forcibly revert `is_published` back to `true`. Updating `{ status: 'draft' }` causes the trigger to see `OLD.is_published = true` and forcibly revert `status` back to `'published'`. Markdown synchronization also fails when editing existing markdown because neither column is empty.
2. `sync_pull_request_fields()`: During an `UPDATE`, clearing a release (`changelog_id = NULL`) causes the trigger to see `OLD.release_id` and restore `changelog_id`. Un-excluding a PR by setting `status = 'unreleased'` or `is_filtered = false` is forcibly overridden and reverted back to `'excluded'`.

Your Mission:
Design the exact, drop-in SQL trigger functions for `supabase/migrations/20260922000001_initial_schema.sql`:
- Implement proper delta detection comparing `NEW` against `OLD` during updates.
- If `NEW.is_published IS DISTINCT FROM OLD.is_published`, update `NEW.status = CASE WHEN NEW.is_published THEN 'published' ELSE 'draft' END`.
- If `NEW.status IS DISTINCT FROM OLD.status`, update `NEW.is_published = (NEW.status = 'published')`.
- If `NEW.markdown_body IS DISTINCT FROM OLD.markdown_body`, sync `NEW.raw_markdown = NEW.markdown_body`.
- If `NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown`, sync `NEW.markdown_body = NEW.raw_markdown`.
- For pull requests: if `changelog_id IS NULL AND release_id IS NULL`, keep both NULL. If one changed to NULL, clear both.
- If `NEW.status` changed to `'unreleased'`, `'queued'`, or `'included'`, set `NEW.is_filtered = FALSE`. If `NEW.is_filtered` changed to `FALSE`, set `NEW.status = 'unreleased'`.
Deliver your report to `.agents/m1_r2_explorer_2/handoff.md` and notify parent via `send_message`.
Do NOT implement code directly.

## 2026-09-22T18:27:13Z
User Request received:
Design the drop-in SQL trigger functions for supabase/migrations/20260922000001_initial_schema.sql (sync_changelog_fields and sync_pull_request_fields) using delta detection comparing NEW against OLD to eliminate state-trapping bugs.
Deliver report to /home/alok/Projects_Antigravity/bsAK/.agents/m1_r2_explorer_2/handoff.md and notify parent via send_message.
Do NOT write code to source files.

