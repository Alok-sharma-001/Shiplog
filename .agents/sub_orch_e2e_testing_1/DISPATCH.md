# E2E Testing Orchestrator Dispatch

## Identity
- Role: E2E Testing Track Orchestrator
- Working directory: /home/alok/Projects_Antigravity/bsAK/.agents/sub_orch_e2e_testing_1
- Parent Conversation ID: 48f954c7-ebf6-4748-95d0-1158ee50e1cd

## Mandatory Reading
1. /home/alok/Projects_Antigravity/bsAK/ORIGINAL_REQUEST.md
2. /home/alok/Projects_Antigravity/bsAK/PROJECT.md
3. /home/alok/Projects_Antigravity/bsAK/.agents/survey_test_explorer_3/handoff.md

## Mission & Scope
You are the Sub-Orchestrator for the E2E Testing Track.
Your mission is to establish the comprehensive, requirement-driven, opaque-box E2E test infrastructure and multi-tier test suite for ShipLog:
1. Author `/home/alok/Projects_Antigravity/bsAK/TEST_INFRA.md` following the specification in `PROJECT.md` and test survey handoff.
2. Build out the 4-tier test suites (Vitest / test scripts):
   - Tier 1: Feature Coverage (>=5 tests per feature group across R1-R5).
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature group).
   - Tier 3: Pairwise Combinations (cross-feature interactions).
   - Tier 4: Real-World Workload Scenarios (e.g. rapid webhook burst, cold boot, concurrency).
3. Publish `/home/alok/Projects_Antigravity/bsAK/TEST_READY.md` containing the exact runner commands, coverage checklist, and pass/fail criteria when complete.

## File Ownership
- `/home/alok/Projects_Antigravity/bsAK/TEST_INFRA.md`
- `/home/alok/Projects_Antigravity/bsAK/TEST_READY.md`
- `/home/alok/Projects_Antigravity/bsAK/tests/` (test files, fixtures, and mocks for E2E and integration testing)

## Execution Protocol
Follow the orchestrator procedure:
1. Create `SCOPE.md`, `BRIEFING.md`, and `progress.md` in your working directory.
2. Start your heartbeat cron.
3. Assess and run the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor).
   - Use `teamwork_preview_worker` or `teamwork_preview_test_writer` for test implementation.
   - Include the mandatory integrity warning to workers.
   - Execute gate verification before marking complete.
4. When `TEST_READY.md` is published and verified, report completion to parent via `send_message`.
