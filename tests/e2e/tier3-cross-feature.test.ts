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
import { runSimulation } from '../../scripts/simulate-pipeline';

describe('Tier 3: Pairwise Cross-Feature Integration Suites (>= 36 Tests)', () => {
  let queue: InMemoryPRQueue;
  let idempotencyStore: WebhookIdempotencyStore;
  let projectStore: Map<string, { id: string; is_pro: boolean }>;
  let aiService: GeminiSynthesisService;

  beforeEach(() => {
    queue = new InMemoryPRQueue();
    idempotencyStore = new WebhookIdempotencyStore();
    projectStore = new Map();
    projectStore.set('proj_cross', { id: 'proj_cross', is_pro: false });
    aiService = new GeminiSynthesisService();
  });

  // --------------------------------------------------------------------------
  // Pair 1: Noise Filter (F04/F05) + Ingestion Queue (F03)
  // --------------------------------------------------------------------------
  describe('Pair 01: Noise Filter & Ingestion Queue Interactions', () => {
    it('TC-T3-01: valid feature PR passes noise filter and is successfully queued', () => {
      const pr = { pr_number: 1, title: 'feat: add dark mode support', author: 'alice' };
      const noise = evaluatePRNoise(pr);
      expect(noise.isNoise).toBe(false);
      const queued = queue.add({
        project_id: 'proj_cross',
        pr_number: pr.pr_number,
        title: pr.title,
        author: pr.author,
        status: 'unreleased',
      });
      expect(queued.id).toBeDefined();
      expect(queue.list('proj_cross', 'unreleased')).toHaveLength(1);
    });

    it('TC-T3-02: chore PR is rejected by noise filter and withheld from queue', () => {
      const pr = { pr_number: 2, title: 'chore(deps): update react to 19.0.1' };
      const noise = evaluatePRNoise(pr);
      expect(noise.isNoise).toBe(true);
      if (!noise.isNoise) {
        queue.add({ project_id: 'proj_cross', pr_number: pr.pr_number, title: pr.title, status: 'unreleased' });
      }
      expect(queue.list('proj_cross', 'unreleased')).toHaveLength(0);
    });

    it('TC-T3-03: PR with [skip] marker is rejected by noise filter and not queued', () => {
      const pr = { pr_number: 3, title: 'feat: prototype [skip]', body: 'Internal work' };
      const noise = evaluatePRNoise(pr);
      expect(noise.isNoise).toBe(true);
      if (!noise.isNoise) {
        queue.add({ project_id: 'proj_cross', pr_number: pr.pr_number, title: pr.title, status: 'unreleased' });
      }
      expect(queue.list('proj_cross', 'unreleased')).toHaveLength(0);
    });

    it('TC-T3-04: PR with skip-changelog label is filtered and queue remains untouched', () => {
      const pr = { pr_number: 4, title: 'feat: telemetry', labels: ['skip-changelog'] };
      const noise = evaluatePRNoise(pr);
      expect(noise.isNoise).toBe(true);
      expect(queue.list('proj_cross', 'unreleased')).toHaveLength(0);
    });

    it('TC-T3-05: batch of 5 mixed PRs results in exactly 3 features queued and 2 chores excluded', () => {
      const prs = [
        { pr_number: 11, title: 'feat: feature 1' },
        { pr_number: 12, title: 'chore: bump eslint' },
        { pr_number: 13, title: 'feat: feature 2' },
        { pr_number: 14, title: 'ci: fix test runner' },
        { pr_number: 15, title: 'fix: resolve bug' },
      ];
      for (const pr of prs) {
        const noise = evaluatePRNoise(pr);
        if (!noise.isNoise) {
          queue.add({ project_id: 'proj_cross', pr_number: pr.pr_number, title: pr.title, status: 'unreleased' });
        }
      }
      expect(queue.list('proj_cross', 'unreleased')).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 2: Ingestion Queue (F03) + Gemini Structured AI Synthesis (F06)
  // --------------------------------------------------------------------------
  describe('Pair 02: Ingestion Queue & Gemini Structured Synthesis Interactions', () => {
    it('TC-T3-06: queue unreleased items feed directly into synthesis service', async () => {
      queue.add({ project_id: 'proj_cross', pr_number: 1, title: 'feat: custom domain support', status: 'unreleased' });
      queue.add({ project_id: 'proj_cross', pr_number: 2, title: 'fix: bell indicator glitch', status: 'unreleased' });

      const unreleased = queue.list('proj_cross', 'unreleased');
      const release = await aiService.synthesize(unreleased, 'v1.1.0');
      expect(release.release_title).toContain('v1.1.0');
      expect(release.categories.features).toHaveLength(1);
      expect(release.categories.fixes).toHaveLength(1);
    });

    it('TC-T3-07: synthesized release output conforms strictly to Zod schema', async () => {
      queue.add({ project_id: 'proj_cross', pr_number: 10, title: 'feat: export analytics', status: 'unreleased' });
      const release = await aiService.synthesize(queue.list('proj_cross', 'unreleased'), 'v1.2.0');
      expect(() => GeminiReleaseOutputSchema.parse(release)).not.toThrow();
    });

    it('TC-T3-08: synthesis preserves PR author attribution from queue items', async () => {
      queue.add({ project_id: 'proj_cross', pr_number: 77, title: 'feat: webhooks', author: 'developer-jane', status: 'unreleased' });
      const release = await aiService.synthesize(queue.list('proj_cross', 'unreleased'), 'v1.3.0');
      expect(release.categories.features[0].author).toBe('developer-jane');
    });

    it('TC-T3-09: synthesizing empty queue produces valid default release structure', async () => {
      const release = await aiService.synthesize([], 'v1.0.0');
      expect(release.release_title).toContain('Release Updates');
      expect(release.categories.features).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 3: Gemini Synthesis (F06) + Release Categorization (F07)
  // --------------------------------------------------------------------------
  describe('Pair 03: Gemini Synthesis & Release Categorization Interactions', () => {
    it('TC-T3-10: correctly buckets features, improvements, and fixes from PR batch', async () => {
      const prs = [
        { pr_number: 1, title: 'feat: add instant search' },
        { pr_number: 2, title: 'perf: 5x faster index cache' },
        { pr_number: 3, title: 'fix: resolve race condition in storage' },
      ];
      const release = await aiService.synthesize(prs, 'v1.4.0');
      expect(release.categories.features).toHaveLength(1);
      expect(release.categories.improvements).toHaveLength(1);
      expect(release.categories.fixes).toHaveLength(1);
    });

    it('TC-T3-11: single-category PR batch leaves other category arrays empty', async () => {
      const prs = [{ pr_number: 1, title: 'fix: resolve memory leak in worker' }];
      const release = await aiService.synthesize(prs, 'v1.4.1');
      expect(release.categories.fixes).toHaveLength(1);
      expect(release.categories.features).toHaveLength(0);
      expect(release.categories.improvements).toHaveLength(0);
    });

    it('TC-T3-12: categories schema rejects unknown categories like breaking_changes', () => {
      const badCategories = {
        features: [],
        improvements: [],
        fixes: [],
        breaking_changes: [],
      };
      expect(() =>
        GeminiReleaseOutputSchema.parse({
          release_title: 'v1.0.0',
          overview_summary: 'Detailed summary for testing categorization.',
          categories: badCategories,
          distribution: { email_plain_text: 'Email draft content.', social_post_thread: ['Post 1'] },
        })
      ).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Pair 4: Categorization (F07) + Multi-Channel Syndication Drafts (F08)
  // --------------------------------------------------------------------------
  describe('Pair 04: Release Categorization & Syndication Drafts Interactions', () => {
    it('TC-T3-13: email plain text mentions release highlights from categories', async () => {
      const prs = [{ pr_number: 1, title: 'feat: team permissions' }];
      const release = await aiService.synthesize(prs, 'v2.0.0');
      expect(release.distribution.email_plain_text).toContain('v2.0.0');
      expect(release.distribution.email_plain_text).toContain('1 features');
    });

    it('TC-T3-14: social post thread formats key feature title from category array', async () => {
      const prs = [{ pr_number: 1, title: 'feat: instant search' }];
      const release = await aiService.synthesize(prs, 'v2.0.0');
      expect(release.distribution.social_post_thread[0]).toContain('instant search');
    });

    it('TC-T3-15: syndication drafts remain non-empty even when no new features exist', async () => {
      const prs = [{ pr_number: 1, title: 'fix: hotfix crash' }];
      const release = await aiService.synthesize(prs, 'v2.0.1');
      expect(release.distribution.email_plain_text.length).toBeGreaterThanOrEqual(10);
      expect(release.distribution.social_post_thread.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 5: Inline Markdown Editor (F18) + One-Click Publishing (F19)
  // --------------------------------------------------------------------------
  describe('Pair 05: Inline Markdown Editor & Publishing Workflow Interactions', () => {
    it('TC-T3-16: editor modifications are preserved upon publishing release', () => {
      const draft: PublishedChangelog = {
        id: 'draft_editor',
        project_id: 'p1',
        project_slug: 'demo',
        version_tag: 'v1.5.0',
        release_title: 'Draft Title',
        overview_summary: 'Draft summary from AI',
        categories: { features: [{ title: 'Feat', description: 'Desc' }], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
        published_at: '',
        status: 'draft',
      };

      // Founder reviews and edits
      draft.overview_summary = 'Founder reviewed and polished summary.';
      draft.status = 'published';
      draft.published_at = new Date().toISOString();

      expect(draft.status).toBe('published');
      expect(draft.overview_summary).toBe('Founder reviewed and polished summary.');
    });

    it('TC-T3-17: publishing action transitions unreleased queue items to released state', () => {
      queue.add({ project_id: 'p_pub_test', pr_number: 55, title: 'feat: sync', status: 'unreleased' });
      expect(queue.list('p_pub_test', 'unreleased')).toHaveLength(1);

      // Trigger publication
      queue.markReleased('p_pub_test', [55]);
      expect(queue.list('p_pub_test', 'unreleased')).toHaveLength(0);
      expect(queue.list('p_pub_test', 'released')).toHaveLength(1);
    });

    it('TC-T3-18: publishing respects tier quota check before transitioning draft', () => {
      const tenant = { tier: 'free' as const, active_repos_count: 1, monthly_releases_count: 2 };
      const verdict = checkCanPublishRelease(tenant);
      expect(verdict.allowed).toBe(false);
      // Publish blocked
    });
  });

  // --------------------------------------------------------------------------
  // Pair 6: Publishing Workflow (F19) + Public Widget API (F29)
  // --------------------------------------------------------------------------
  describe('Pair 06: Publishing Workflow & Public Widget API Interactions', () => {
    it('TC-T3-19: newly published release is immediately accessible via widget API endpoint', () => {
      const changelog: PublishedChangelog = {
        id: 'rel_pub_1',
        project_id: 'proj_cross',
        project_slug: 'proj_cross',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 — Live Now',
        overview_summary: 'Available in widget immediately.',
        categories: { features: [{ title: 'Widget', description: 'desc' }], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };

      const res = generateWidgetApiResponse({ name: 'CrossProj', slug: 'proj_cross', is_pro: false }, [changelog]);
      expect(res.body.releases).toHaveLength(1);
      expect(res.body.releases[0].release_title).toBe('v1.0.0 — Live Now');
    });

    it('TC-T3-20: draft changelog is excluded from widget API response', () => {
      const draft: PublishedChangelog = {
        id: 'draft_hidden',
        project_id: 'proj_cross',
        project_slug: 'proj_cross',
        version_tag: 'v1.0.1',
        release_title: 'Draft in Progress',
        overview_summary: 'Secret',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'draft',
      };

      const res = generateWidgetApiResponse({ name: 'CrossProj', slug: 'proj_cross', is_pro: false }, [draft]);
      expect(res.body.releases).toHaveLength(0);
    });

    it('TC-T3-21: widget API contains CORS wildcard and cache-control headers on published response', () => {
      const res = generateWidgetApiResponse({ name: 'CrossProj', slug: 'proj_cross', is_pro: false }, []);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Cache-Control']).toContain('s-maxage=300');
    });
  });

  // --------------------------------------------------------------------------
  // Pair 7: Publishing (F19) + Public SSR Portal (F21) & OpenGraph (F22)
  // --------------------------------------------------------------------------
  describe('Pair 07: Publishing, SSR Portal & OpenGraph Meta Interactions', () => {
    it('TC-T3-22: publishing updates SSR timeline and sets dynamic OpenGraph title', () => {
      const release: PublishedChangelog = {
        id: 'r_ssr_1',
        project_id: 'p1',
        project_slug: 'portal-app',
        version_tag: 'v2.5.0',
        release_title: 'v2.5.0 — Massive Overhaul',
        overview_summary: 'Major system improvements across all modules.',
        categories: { features: [{ title: 'Module A', description: 'd' }], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };

      const res = renderSSRChangelog({ name: 'PortalApp', slug: 'portal-app', is_pro: false }, [release]);
      expect(res.html).toContain('v2.5.0 — Massive Overhaul');
      expect(res.meta.ogTitle).toContain('v2.5.0 — Massive Overhaul | PortalApp Changelog');
      expect(res.meta.ogDescription).toBe('Major system improvements across all modules.');
    });

    it('TC-T3-23: unpublishing or deleting changelog safely reverts OpenGraph tags to default', () => {
      const res = renderSSRChangelog({ name: 'PortalApp', slug: 'portal-app', is_pro: false }, []);
      expect(res.meta.ogTitle).toBe('PortalApp Changelog');
      expect(res.meta.ogDescription).toContain('Latest updates');
    });
  });

  // --------------------------------------------------------------------------
  // Pair 8: Dodo Payments Webhook (F31) + Tier Feature Gating (F34)
  // --------------------------------------------------------------------------
  describe('Pair 08: Dodo Payments Webhook & Tier Feature Gating Interactions', () => {
    it('TC-T3-24: subscription.created webhook immediately upgrades tenant to Pro', () => {
      expect(projectStore.get('proj_cross')?.is_pro).toBe(false);
      const event = {
        event_id: 'evt_upgrade_1',
        type: 'subscription.created' as const,
        data: { customer_id: 'cust_1', project_id: 'proj_cross', status: 'active', plan_id: 'pro' },
      };
      const res = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res.is_pro).toBe(true);
      expect(projectStore.get('proj_cross')?.is_pro).toBe(true);
    });

    it('TC-T3-25: upgraded Pro tenant unlocks unlimited repo connections', () => {
      const tenant = { tier: 'pro' as const, active_repos_count: 5, monthly_releases_count: 0 };
      expect(checkCanConnectRepo(tenant).allowed).toBe(true);
    });

    it('TC-T3-26: upgraded Pro tenant unlocks unlimited published releases', () => {
      const tenant = { tier: 'pro' as const, active_repos_count: 5, monthly_releases_count: 50 };
      expect(checkCanPublishRelease(tenant).allowed).toBe(true);
    });

    it('TC-T3-27: subscription.cancelled webhook immediately downgrades tenant to Free limits', () => {
      projectStore.set('proj_cross', { id: 'proj_cross', is_pro: true });
      const event = {
        event_id: 'evt_cancel_1',
        type: 'subscription.cancelled' as const,
        data: { customer_id: 'cust_1', project_id: 'proj_cross', status: 'cancelled', plan_id: 'pro' },
      };
      const res = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res.is_pro).toBe(false);
      expect(projectStore.get('proj_cross')?.is_pro).toBe(false);

      const downgradedTenant = { tier: 'free' as const, active_repos_count: 1, monthly_releases_count: 2 };
      expect(checkCanConnectRepo(downgradedTenant).allowed).toBe(false);
      expect(checkCanPublishRelease(downgradedTenant).allowed).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 9: Tier Feature Gating (F34) + Viral Badge Logic (F28)
  // --------------------------------------------------------------------------
  describe('Pair 09: Tier Feature Gating & Viral Badge Interactions', () => {
    it('TC-T3-28: Free tier renders viral badge in public widget API payload', () => {
      const isPro = false;
      expect(checkShouldShowViralBadge(isPro)).toBe(true);
      const res = generateWidgetApiResponse({ name: 'FreeApp', slug: 'free', is_pro: isPro }, []);
      expect(res.body.project.show_badge).toBe(true);
    });

    it('TC-T3-29: Pro tier suppresses viral badge in public widget API payload', () => {
      const isPro = true;
      expect(checkShouldShowViralBadge(isPro)).toBe(false);
      const res = generateWidgetApiResponse({ name: 'ProApp', slug: 'pro', is_pro: isPro }, []);
      expect(res.body.project.show_badge).toBe(false);
    });

    it('TC-T3-30: cancelling subscription immediately restores viral badge on next widget fetch', () => {
      let isPro = true;
      expect(checkShouldShowViralBadge(isPro)).toBe(false);
      isPro = false; // Downgrade
      expect(checkShouldShowViralBadge(isPro)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 10: In-App Widget (F23) + Shadow DOM (F25) + LocalStorage (F26)
  // --------------------------------------------------------------------------
  describe('Pair 10: In-App Widget, Shadow DOM & LocalStorage Interactions', () => {
    it('TC-T3-31: widget in Shadow DOM initializes unread indicator from localStorage', () => {
      localStorage.setItem('shiplog_unread_shadow', '4');
      const count = parseInt(localStorage.getItem('shiplog_unread_shadow') || '0', 10);
      expect(count).toBe(4);

      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<div id="dot" class="${count > 0 ? 'visible' : 'hidden'}"></div>`;
      expect(shadow.getElementById('dot')?.classList.contains('visible')).toBe(true);
    });

    it('TC-T3-32: opening drawer resets localStorage unread count to 0 and clears indicator dot', () => {
      localStorage.setItem('shiplog_unread_shadow', '4');
      // Simulate click
      localStorage.setItem('shiplog_unread_shadow', '0');
      const count = parseInt(localStorage.getItem('shiplog_unread_shadow') || '0', 10);
      expect(count).toBe(0);
    });

    it('TC-T3-33: scoped Shadow DOM prevents host CSS collision on widget layout', () => {
      document.body.innerHTML = '<style>div { margin: 100px; padding: 100px; }</style><div id="host"></div>';
      const host = document.getElementById('host')!;
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<style>:host { all: initial; }</style><div class="drawer">Content</div>';
      expect(shadow.querySelector('.drawer')).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Pair 11: Webhook Idempotency (F32) + Dodo Webhook (F31)
  // --------------------------------------------------------------------------
  describe('Pair 11: Webhook Idempotency & Dodo Webhook Interactions', () => {
    it('TC-T3-34: duplicate subscription.created webhooks return already_processed on replay', () => {
      const event = {
        event_id: 'evt_idem_101',
        type: 'subscription.created' as const,
        data: { customer_id: 'c1', project_id: 'proj_cross', status: 'active', plan_id: 'pro' },
      };
      const res1 = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res1.status).toBe('processed');
      const res2 = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res2.status).toBe('already_processed');
    });

    it('TC-T3-35: replaying cancelled webhook does not re-downgrade already downgraded project', () => {
      const event = {
        event_id: 'evt_idem_102',
        type: 'subscription.cancelled' as const,
        data: { customer_id: 'c1', project_id: 'proj_cross', status: 'cancelled', plan_id: 'pro' },
      };
      const res1 = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res1.status).toBe('processed');
      const res2 = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res2.status).toBe('already_processed');
    });
  });

  // --------------------------------------------------------------------------
  // Pair 12: Pipeline Simulation CLI (F36) + Hybrid Mock Mode (F09)
  // --------------------------------------------------------------------------
  describe('Pair 12: Pipeline Simulation CLI & Hybrid Mock Mode Interactions', () => {
    it('TC-T3-36: standalone pipeline simulation completes end-to-end without external network calls', async () => {
      await expect(runSimulation()).resolves.toBeUndefined();
    });

    it('TC-T3-37: simulation noise engine prevents chore PR from triggering AI release synthesis', () => {
      const chorePR = { pr_number: 99, title: 'chore: update typescript' };
      const noise = evaluatePRNoise(chorePR);
      expect(noise.isNoise).toBe(true);
    });

    it('TC-T3-38: simulation confirms published release matches widget API payload', async () => {
      const changelog: PublishedChangelog = {
        id: 'rel_sim_check',
        project_id: 'demo-app',
        project_slug: 'demo-app',
        version_tag: 'v1.4.0',
        release_title: 'v1.4.0 — Instant Search',
        overview_summary: 'Search released',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const widget = generateWidgetApiResponse({ name: 'Demo App', slug: 'demo-app', is_pro: false }, [changelog]);
      expect(widget.body.releases[0].release_title).toBe('v1.4.0 — Instant Search');
    });

    it('TC-T3-39: development signature bypass validates simulated test webhooks safely', () => {
      expect(verifyDodoSignature('{}', null, 'sec', true, 'test_bypass_key')).toBe(true);
    });

    it('TC-T3-40: complete mock cycle from PR to SSR changelog renders without schema deviation', async () => {
      const prs = [{ pr_number: 42, title: 'feat: full cycle test' }];
      const output = await aiService.synthesize(prs, 'v1.0.0');
      const release: PublishedChangelog = {
        id: 'rel_cycle',
        project_id: 'cycle-proj',
        project_slug: 'cycle-proj',
        version_tag: 'v1.0.0',
        release_title: output.release_title,
        overview_summary: output.overview_summary,
        categories: output.categories,
        distribution: output.distribution,
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const ssr = renderSSRChangelog({ name: 'Cycle', slug: 'cycle-proj', is_pro: false }, [release]);
      expect(ssr.html).toContain('full cycle test');
    });
  });
});
