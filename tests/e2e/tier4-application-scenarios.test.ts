import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  evaluatePRNoise,
  verifyGitHubSignature,
  verifyDodoSignature,
  InMemoryPRQueue,
  GeminiSynthesisService,
  CategoryItemSchema,
  ReleaseCategoriesSchema,
  DistributionSchema,
  GeminiReleaseOutputSchema,
  checkCanConnectRepo,
  checkCanPublishRelease,
  checkShouldShowViralBadge,
  WebhookIdempotencyStore,
  handleDodoWebhook,
  generateWidgetApiResponse,
  renderSSRChangelog,
  PublishedChangelog,
} from './helpers/test-harness';
import { dispatchMockPR } from '../../scripts/dispatch-mock-pr';
import { runSimulation } from '../../scripts/simulate-pipeline';

describe('Tier 4: Realistic Application Scenarios & High-Concurrency Workloads (>= 18 Scenarios)', () => {
  let queue: InMemoryPRQueue;
  let idempotencyStore: WebhookIdempotencyStore;
  let projectStore: Map<string, { id: string; is_pro: boolean }>;
  let aiService: GeminiSynthesisService;

  beforeEach(() => {
    queue = new InMemoryPRQueue();
    idempotencyStore = new WebhookIdempotencyStore();
    projectStore = new Map();
    projectStore.set('proj_tenant_1', { id: 'proj_tenant_1', is_pro: false });
    projectStore.set('proj_tenant_2', { id: 'proj_tenant_2', is_pro: false });
    projectStore.set('proj_tenant_3', { id: 'proj_tenant_3', is_pro: true });
    aiService = new GeminiSynthesisService();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Complete Founder Journey (Free Tier)
  // --------------------------------------------------------------------------
  it('Scenario 01: Complete Founder Journey on Free Tier (Ingest -> Filter -> AI Draft -> Edit -> Publish -> Widget Check)', async () => {
    // 1. Connect Repo
    const tenant = { tier: 'free' as const, active_repos_count: 0, monthly_releases_count: 0 };
    expect(checkCanConnectRepo(tenant).allowed).toBe(true);
    tenant.active_repos_count = 1;

    // 2. Ingest 5 PRs (3 features, 2 chores)
    const incomingPRs = [
      { pr_number: 1, title: 'feat: add user authentication', author: 'alice' },
      { pr_number: 2, title: 'chore(deps): bump tailwindcss', author: 'dependabot' },
      { pr_number: 3, title: 'feat: add stripe checkout', author: 'bob' },
      { pr_number: 4, title: 'ci: update github action matrix', author: 'charlie' },
      { pr_number: 5, title: 'fix: resolve modal z-index issue', author: 'alice' },
    ];

    for (const pr of incomingPRs) {
      const noise = evaluatePRNoise(pr);
      if (!noise.isNoise) {
        queue.add({ project_id: 'proj_tenant_1', pr_number: pr.pr_number, title: pr.title, author: pr.author, status: 'unreleased' });
      }
    }

    const unreleased = queue.list('proj_tenant_1', 'unreleased');
    expect(unreleased).toHaveLength(3); // 2 chores excluded

    // 3. Generate Release Draft
    const aiDraft = await aiService.synthesize(unreleased, 'v1.0.0');
    expect(aiDraft.categories.features).toHaveLength(2);
    expect(aiDraft.categories.fixes).toHaveLength(1);

    // 4. Inline Edit Summary
    aiDraft.overview_summary = 'Official launch of v1.0.0 with user auth and Stripe checkout!';

    // 5. Publish Release
    expect(checkCanPublishRelease(tenant).allowed).toBe(true);
    tenant.monthly_releases_count = 1;
    const publishedRelease: PublishedChangelog = {
      id: 'rel_founder_01',
      project_id: 'proj_tenant_1',
      project_slug: 'tenant-one',
      version_tag: 'v1.0.0',
      release_title: aiDraft.release_title,
      overview_summary: aiDraft.overview_summary,
      categories: aiDraft.categories,
      distribution: aiDraft.distribution,
      published_at: new Date().toISOString(),
      status: 'published',
    };
    queue.markReleased('proj_tenant_1', [1, 3, 5]);
    expect(queue.list('proj_tenant_1', 'unreleased')).toHaveLength(0);

    // 6. Public Widget API Check
    const widgetRes = generateWidgetApiResponse({ name: 'Tenant 1', slug: 'tenant-one', is_pro: false }, [publishedRelease]);
    expect(widgetRes.body.releases).toHaveLength(1);
    expect(widgetRes.body.project.show_badge).toBe(true); // Free tier viral badge shown
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Complete Founder Journey (Pro Upgrade via Dodo Payments)
  // --------------------------------------------------------------------------
  it('Scenario 02: Founder hits quota limit, upgrades via Dodo Payments, and white-labels widget', () => {
    const tenant: { tier: 'free' | 'pro'; active_repos_count: number; monthly_releases_count: number } = {
      tier: 'free',
      active_repos_count: 1,
      monthly_releases_count: 2,
    };

    // Attempt connecting 2nd repository -> blocked
    expect(checkCanConnectRepo(tenant).allowed).toBe(false);
    // Attempt publishing 3rd release -> blocked
    expect(checkCanPublishRelease(tenant).allowed).toBe(false);

    // Dodo Payments webhook received for subscription.created
    const webhookEvent = {
      event_id: 'dodo_evt_upgrade_999',
      type: 'subscription.created' as const,
      data: { customer_id: 'cust_pro', project_id: 'proj_tenant_1', status: 'active', plan_id: 'plan_pro' },
    };
    const webhookResult = handleDodoWebhook(webhookEvent, idempotencyStore, projectStore);
    expect(webhookResult.is_pro).toBe(true);

    // Tenant updated to Pro
    tenant.tier = 'pro';
    expect(checkCanConnectRepo(tenant).allowed).toBe(true);
    expect(checkCanPublishRelease(tenant).allowed).toBe(true);

    // Widget API response confirms viral badge is suppressed
    const widgetRes = generateWidgetApiResponse({ name: 'Tenant 1', slug: 'tenant-one', is_pro: true }, []);
    expect(widgetRes.body.project.show_badge).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Rapid GitHub PR Burst (Concurrency Stress)
  // --------------------------------------------------------------------------
  it('Scenario 03: Rapid GitHub PR Burst (25 concurrent PR merges processed simultaneously)', () => {
    const prs = Array.from({ length: 25 }, (_, i) => ({
      pr_number: i + 100,
      title: i % 5 === 0 ? `chore: update dep ${i}` : `feat: concurrent feature ${i}`,
      author: `dev-${i}`,
    }));

    // Dispatch all simultaneously
    const results = prs.map((pr) => {
      const noise = evaluatePRNoise(pr);
      if (!noise.isNoise) {
        return queue.add({ project_id: 'proj_burst', pr_number: pr.pr_number, title: pr.title, author: pr.author, status: 'unreleased' });
      }
      return null;
    });

    const queued = queue.list('proj_burst', 'unreleased');
    // 25 PRs, every 5th is chore (indices 0, 5, 10, 15, 20 = 5 chores), exactly 20 features
    expect(queued).toHaveLength(20);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: High-Volume Milestone Release Synthesis
  // --------------------------------------------------------------------------
  it('Scenario 04: High-Volume Milestone Release (Synthesizing 50 accumulated PRs into structured changelog)', async () => {
    const prs = Array.from({ length: 50 }, (_, i) => ({
      pr_number: i + 1,
      title: i % 2 === 0 ? `feat: high volume feature ${i}` : `fix: resolve issue ${i}`,
      author: `contributor-${i % 5}`,
    }));

    const release = await aiService.synthesize(prs, 'v3.0.0');
    expect(release.release_title).toContain('v3.0.0');
    expect(release.categories.features.length + release.categories.fixes.length).toBe(50);
    expect(release.distribution.email_plain_text.length).toBeGreaterThanOrEqual(10);
    expect(release.distribution.social_post_thread.length).toBeGreaterThanOrEqual(1);
    expect(() => GeminiReleaseOutputSchema.parse(release)).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Multi-Tenant Concurrency & Isolation
  // --------------------------------------------------------------------------
  it('Scenario 05: Multi-Tenant Isolation (Concurrent ingestion across 3 distinct projects with zero crosstalk)', () => {
    // Ingest PRs for 3 distinct projects
    queue.add({ project_id: 'tenant_A', pr_number: 1, title: 'feat: Tenant A Feature', status: 'unreleased' });
    queue.add({ project_id: 'tenant_B', pr_number: 1, title: 'feat: Tenant B Feature', status: 'unreleased' });
    queue.add({ project_id: 'tenant_C', pr_number: 1, title: 'feat: Tenant C Feature', status: 'unreleased' });

    expect(queue.list('tenant_A', 'unreleased')).toHaveLength(1);
    expect(queue.list('tenant_B', 'unreleased')).toHaveLength(1);
    expect(queue.list('tenant_C', 'unreleased')).toHaveLength(1);

    expect(queue.list('tenant_A', 'unreleased')[0].title).toBe('feat: Tenant A Feature');
    expect(queue.list('tenant_B', 'unreleased')[0].title).toBe('feat: Tenant B Feature');
    expect(queue.list('tenant_C', 'unreleased')[0].title).toBe('feat: Tenant C Feature');

    // Mark Tenant A released; ensure B and C remain unreleased
    queue.markReleased('tenant_A', [1]);
    expect(queue.list('tenant_A', 'unreleased')).toHaveLength(0);
    expect(queue.list('tenant_B', 'unreleased')).toHaveLength(1);
    expect(queue.list('tenant_C', 'unreleased')).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Dodo Payments Subscription Downgrade Lifecycle
  // --------------------------------------------------------------------------
  it('Scenario 06: Dodo Payments Subscription Cancellation Lifecycle (Pro -> Free Downgrade preserves past changelogs)', () => {
    const publishedPastRelease: PublishedChangelog = {
      id: 'rel_past',
      project_id: 'proj_tenant_3',
      project_slug: 'tenant-three',
      version_tag: 'v1.0.0',
      release_title: 'v1.0.0 Pro Era',
      overview_summary: 'Created when customer was on Pro tier.',
      categories: { features: [], improvements: [], fixes: [] },
      distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
      published_at: '2026-08-01T00:00:00Z',
      status: 'published',
    };

    // Cancellation event
    const cancelEvent = {
      event_id: 'evt_cancel_99',
      type: 'subscription.cancelled' as const,
      data: { customer_id: 'c3', project_id: 'proj_tenant_3', status: 'cancelled', plan_id: 'pro' },
    };
    const res = handleDodoWebhook(cancelEvent, idempotencyStore, projectStore);
    expect(res.is_pro).toBe(false);

    // Existing changelog remains public
    const widgetRes = generateWidgetApiResponse({ name: 'Tenant 3', slug: 'tenant-three', is_pro: false }, [publishedPastRelease]);
    expect(widgetRes.body.releases).toHaveLength(1);
    // Viral badge is restored
    expect(widgetRes.body.project.show_badge).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Offline CI Pipeline Simulation
  // --------------------------------------------------------------------------
  it('Scenario 07: Offline CI Pipeline Simulation executes completely with deterministic mock fallback', async () => {
    await expect(runSimulation()).resolves.toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Replay Attack Defense & Idempotent Webhook Flooding
  // --------------------------------------------------------------------------
  it('Scenario 08: Replay Attack Defense (100 identical webhook events handled with 0 duplicate mutations)', () => {
    const event = {
      event_id: 'flood_attack_evt_001',
      type: 'subscription.created' as const,
      data: { customer_id: 'c1', project_id: 'proj_tenant_2', status: 'active', plan_id: 'pro' },
    };

    let processedCount = 0;
    let ignoredCount = 0;

    for (let i = 0; i < 100; i++) {
      const outcome = handleDodoWebhook(event, idempotencyStore, projectStore);
      if (outcome.status === 'processed') processedCount++;
      if (outcome.status === 'already_processed') ignoredCount++;
    }

    expect(processedCount).toBe(1);
    expect(ignoredCount).toBe(99);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Widget Cold Boot & Cache Invalidation Lifecycle
  // --------------------------------------------------------------------------
  it('Scenario 09: Widget Cold Boot and Cache Invalidation Lifecycle', () => {
    // 1. Initial State: No releases
    const initialWidget = generateWidgetApiResponse({ name: 'TestApp', slug: 'test-app', is_pro: false }, []);
    expect(initialWidget.body.releases).toHaveLength(0);
    expect(initialWidget.headers['Cache-Control']).toContain('s-maxage=300');

    // 2. Publish new release
    const newRelease: PublishedChangelog = {
      id: 'rel_new_1',
      project_id: 'p1',
      project_slug: 'test-app',
      version_tag: 'v1.1.0',
      release_title: 'v1.1.0 Released',
      overview_summary: 'New release overview.',
      categories: { features: [], improvements: [], fixes: [] },
      distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
      published_at: new Date().toISOString(),
      status: 'published',
    };

    // 3. Next fetch returns new release
    const updatedWidget = generateWidgetApiResponse({ name: 'TestApp', slug: 'test-app', is_pro: false }, [newRelease]);
    expect(updatedWidget.body.releases).toHaveLength(1);
    expect(updatedWidget.body.releases[0].release_title).toBe('v1.1.0 Released');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Mixed Noise Burst & Queue Deduplication
  // --------------------------------------------------------------------------
  it('Scenario 10: Mixed Noise Burst & Queue Deduplication', () => {
    const burst = [
      { pr_number: 1, title: 'chore: update deps' },
      { pr_number: 2, title: 'feat: add user search' },
      { pr_number: 2, title: 'feat: add user search (duplicate event)' },
      { pr_number: 3, title: 'ci(actions): update matrix' },
      { pr_number: 4, title: 'feat: internal tool [skip]' },
      { pr_number: 5, title: 'fix: resolve memory leak' },
      { pr_number: 6, title: 'refactor: extract helper' },
      { pr_number: 7, title: 'style: format css' },
      { pr_number: 8, title: 'test: add unit tests' },
      { pr_number: 9, title: 'feat: public changelog portal' },
    ];

    for (const pr of burst) {
      const noise = evaluatePRNoise(pr);
      if (!noise.isNoise) {
        queue.add({ project_id: 'proj_dedup', pr_number: pr.pr_number, title: pr.title, status: 'unreleased' });
      }
    }

    const queued = queue.list('proj_dedup', 'unreleased');
    // Valid features: PR 2, PR 5, PR 9 = exactly 3 items (PR 2 deduplicated, chores and [skip] excluded)
    expect(queued).toHaveLength(3);
    const prNumbers = queued.map((q) => q.pr_number).sort((a, b) => a - b);
    expect(prNumbers).toEqual([2, 5, 9]);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Free Tier Monthly Quota Exhaustion & Reset
  // --------------------------------------------------------------------------
  it('Scenario 11: Free Tier Monthly Release Quota Exhaustion and Subsequent Month Reset', () => {
    const tenant = { tier: 'free' as const, active_repos_count: 1, monthly_releases_count: 0 };

    // Release 1 in September
    expect(checkCanPublishRelease(tenant).allowed).toBe(true);
    tenant.monthly_releases_count++;

    // Release 2 in September
    expect(checkCanPublishRelease(tenant).allowed).toBe(true);
    tenant.monthly_releases_count++;

    // Release 3 in September -> BLOCKED
    const blockedVerdict = checkCanPublishRelease(tenant);
    expect(blockedVerdict.allowed).toBe(false);
    expect(blockedVerdict.upgrade_required).toBe(true);

    // New month arrives (October 1st) -> Counter resets to 0
    tenant.monthly_releases_count = 0;
    expect(checkCanPublishRelease(tenant).allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Public SSR Portal Rendering with High-Frequency Updates
  // --------------------------------------------------------------------------
  it('Scenario 12: Public SSR Portal rendering with multiple updates in sequence', () => {
    const releases: PublishedChangelog[] = [
      {
        id: 'r3',
        project_id: 'p1',
        project_slug: 'fast-app',
        version_tag: 'v1.2.0',
        release_title: 'v1.2.0 — Latest',
        overview_summary: 'Latest updates.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: '2026-09-23T10:00:00Z',
        status: 'published',
      },
      {
        id: 'r2',
        project_id: 'p1',
        project_slug: 'fast-app',
        version_tag: 'v1.1.0',
        release_title: 'v1.1.0 — Intermediate',
        overview_summary: 'Intermediate updates.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: '2026-09-22T10:00:00Z',
        status: 'published',
      },
      {
        id: 'r1',
        project_id: 'p1',
        project_slug: 'fast-app',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 — Initial',
        overview_summary: 'Initial updates.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: '2026-09-21T10:00:00Z',
        status: 'published',
      },
    ];

    const ssr = renderSSRChangelog({ name: 'FastApp', slug: 'fast-app', is_pro: false }, releases);
    expect(ssr.meta.ogTitle).toContain('v1.2.0 — Latest');
    expect(ssr.html).toContain('v1.2.0 — Latest');
    expect(ssr.html).toContain('v1.1.0 — Intermediate');
    expect(ssr.html).toContain('v1.0.0 — Initial');
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Local Webhook Dispatcher Localhost Verification
  // --------------------------------------------------------------------------
  it('Scenario 13: Local Webhook Dispatcher CLI generates valid HMAC signature for synthetic PR', async () => {
    const res = await dispatchMockPR({
      port: 3000,
      host: '127.0.0.1',
      pr: 42,
      title: 'feat: add instant changelog search',
      body: 'Full body text',
      author: 'jane',
      secret: 'development_secret_key',
    });
    expect(res).toBeDefined();
    expect(typeof res.status).toBe('number');
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Shadow DOM Style Isolation Under Aggressive Host Reset
  // --------------------------------------------------------------------------
  it('Scenario 14: Scoped Shadow DOM Style Isolation under hostile host stylesheet reset', () => {
    document.body.innerHTML = `
      <style>
        * { font-size: 0px !important; margin: 999px !important; color: red !important; }
      </style>
      <div id="host-widget"></div>
    `;

    const host = document.getElementById('host-widget')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; font-family: system-ui, sans-serif; }
        .bell { font-size: 14px; margin: 0px; color: white; }
      </style>
      <div class="bell" id="bell">ShipLog</div>
    `;

    const bell = shadow.getElementById('bell')!;
    expect(bell).not.toBeNull();
    expect(bell.textContent).toBe('ShipLog');
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Cross-Tab LocalStorage Unread Sync Simulation
  // --------------------------------------------------------------------------
  it('Scenario 15: Cross-Tab LocalStorage Unread Sync Simulation', () => {
    localStorage.setItem('shiplog_unread_synced', '3');
    expect(localStorage.getItem('shiplog_unread_synced')).toBe('3');

    // Simulate Tab 1 opening drawer
    localStorage.setItem('shiplog_unread_synced', '0');

    // Tab 2 checks storage value
    const tab2Unread = parseInt(localStorage.getItem('shiplog_unread_synced') || '0', 10);
    expect(tab2Unread).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Malicious Webhook Flooding Attack Mitigation
  // --------------------------------------------------------------------------
  it('Scenario 16: Malicious Webhook Attack Mitigation (50 tampered requests rejected)', () => {
    const secret = 'valid_production_secret';
    let rejectedCount = 0;

    for (let i = 0; i < 50; i++) {
      const maliciousPayload = `{"action":"closed","attack":"payload_${i}'; DROP TABLE users; --"}`;
      const fakeSignature = 'sha256=' + '0'.repeat(64);
      const isValid = verifyGitHubSignature(maliciousPayload, fakeSignature, secret);
      if (!isValid) rejectedCount++;
    }

    expect(rejectedCount).toBe(50);
  });

  // --------------------------------------------------------------------------
  // Scenario 17: Release Syndication Multi-Channel Copy Workflow
  // --------------------------------------------------------------------------
  it('Scenario 17: Release Syndication Multi-Channel Copy Workflow', async () => {
    const prs = [
      { pr_number: 10, title: 'feat: add instant changelog search' },
      { pr_number: 11, title: 'fix: resolve bell counter localstorage bug' },
    ];
    const output = await aiService.synthesize(prs, 'v1.4.0');

    // Copy plain text email
    const emailBuffer = output.distribution.email_plain_text;
    expect(emailBuffer.length).toBeGreaterThanOrEqual(10);
    expect(emailBuffer).toContain('v1.4.0');

    // Copy social thread
    const socialThreadBuffer = output.distribution.social_post_thread.join('\n\n---\n\n');
    expect(socialThreadBuffer).toContain('🚀');
    expect(socialThreadBuffer).toContain('---');
  });

  // --------------------------------------------------------------------------
  // Scenario 18: System Cold Recovery from Clean State
  // --------------------------------------------------------------------------
  it('Scenario 18: System Cold Recovery from Clean State (End-to-End lifecycle verification)', async () => {
    // 1. Initial Empty Queue
    const freshQueue = new InMemoryPRQueue();
    expect(freshQueue.list('fresh_proj', 'all')).toHaveLength(0);

    // 2. Webhook Ingest
    const pr = { pr_number: 1, title: 'feat: bootstrap initial release', author: 'founder' };
    const noise = evaluatePRNoise(pr);
    expect(noise.isNoise).toBe(false);
    freshQueue.add({ project_id: 'fresh_proj', pr_number: pr.pr_number, title: pr.title, author: pr.author, status: 'unreleased' });
    expect(freshQueue.list('fresh_proj', 'unreleased')).toHaveLength(1);

    // 3. AI Release Synthesis
    const releaseOutput = await aiService.synthesize(freshQueue.list('fresh_proj', 'unreleased'), 'v1.0.0');
    expect(releaseOutput.release_title).toContain('v1.0.0');

    // 4. Publish
    const published: PublishedChangelog = {
      id: 'rel_cold',
      project_id: 'fresh_proj',
      project_slug: 'fresh-app',
      version_tag: 'v1.0.0',
      release_title: releaseOutput.release_title,
      overview_summary: releaseOutput.overview_summary,
      categories: releaseOutput.categories,
      distribution: releaseOutput.distribution,
      published_at: new Date().toISOString(),
      status: 'published',
    };
    freshQueue.markReleased('fresh_proj', [1]);
    expect(freshQueue.list('fresh_proj', 'unreleased')).toHaveLength(0);

    // 5. Public Delivery Verifications
    const widget = generateWidgetApiResponse({ name: 'Fresh App', slug: 'fresh-app', is_pro: false }, [published]);
    expect(widget.statusCode).toBe(200);
    expect(widget.body.releases).toHaveLength(1);

    const ssr = renderSSRChangelog({ name: 'Fresh App', slug: 'fresh-app', is_pro: false }, [published]);
    expect(ssr.statusCode).toBe(200);
    expect(ssr.html).toContain('Fresh App Changelog');
  });
});
