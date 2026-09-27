# Operational Plan: ShipLog SaaS Engine

## Objective
Lead and orchestrate the complete engineering, implementation, and rigorous verification of ShipLog per requirements R1-R5 and acceptance criteria.

## Phases

### Phase 0: Survey & Specification Mining
- Spawn 3 parallel Survey Explorers / Spec Miners to map project context, requirements, toolchains, architecture, and verification strategy.
- Synthesize findings into `PROJECT.md` at project root with complete Feature Inventory, Milestones, Interface Contracts, and Code Layout.

### Phase 1: Dual Track Initialization
- Track 1: E2E Testing Orchestrator
  - Opaque-box requirement-driven testing harness.
  - Multi-tier test suite (Tier 1: Feature, Tier 2: Boundary/Edge, Tier 3: Pairwise Combinations, Tier 4: Real-world Workload).
  - Publishes `TEST_READY.md`.
- Track 2: Core Implementation Milestones
  - M1: Foundation & Data Model (Next.js 15, Supabase migrations & RLS, Tailwind, shadcn/ui primitives, environment config).
  - M2: GitHub Ingestion & Structured AI Pipeline (webhook receiver, regex noise filter, Gemini 1.5 Flash structured JSON transformation, hybrid execution with deterministic mock fixtures and local dispatcher).
  - M3: SaaS Dashboard & Public SSR Changelog Portal (Repo connection, unreleased queue, inline markdown editor, one-click publish & copy actions, `/c/[slug]` SSR portal with dynamic OG tags).
  - M4: Standalone Embeddable In-App Widget (Shadow DOM, <5KB bundle, unread bell indicator, slide-out drawer, viral badge logic, `/api/v1/widget/[slug]` edge endpoint with CORS).
  - M5: Monetization & Subscription Infrastructure (Dodo Payments checkout flow, webhook handling, mock signature bypass, feature gating: Free vs Pro).

### Phase 2: Integration & Verification (Final Milestone)
- Sub-milestone 1: E2E Test Suite Execution (pass 100% of Tiers 1-4 from `TEST_READY.md`).
- Sub-milestone 2: Adversarial Coverage Hardening (Tier 5 white-box challenger analysis and edge-case testing).
- Verification Tools:
  - `npm test`: clean pass of all unit and integration tests.
  - `npm run test:simulate`: full E2E pipeline simulation.
  - `npm run check:widget-size`: strict < 5 KB bundle size verification.
  - `npm run build`: zero TS errors, zero lint errors.

### Phase 3: Final Forensic Audit & Delivery
- Forensic integrity audit of all deliverables.
- Final handoff report to Sentinel for victory audit trigger.
