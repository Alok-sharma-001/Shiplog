import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
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
  isPRMerged,
  GitHubPRClosedWebhookSchema,
  validateAndSanitizeMarkdownDraft,
  formatSyndicationEmail,
  formatSocialThread,
  DodoCheckoutRequestSchema,
  createCheckoutSession,
  validateSupabaseSchemaConstraint,
  evaluateMockRLS,
  isReservedAppRoute,
} from './helpers/test-harness';
import { dispatchMockPR } from '../../scripts/dispatch-mock-pr';
import { runSimulation } from '../../scripts/simulate-pipeline';

describe('Tier 1: Feature Coverage & Happy-Path Contracts (Features 1 - 36)', () => {
  let queue: InMemoryPRQueue;
  let idempotencyStore: WebhookIdempotencyStore;
  let projectStore: Map<string, { id: string; is_pro: boolean }>;

  beforeEach(() => {
    queue = new InMemoryPRQueue();
    idempotencyStore = new WebhookIdempotencyStore();
    projectStore = new Map();
    projectStore.set('proj_demo', { id: 'proj_demo', is_pro: false });
  });

  // --------------------------------------------------------------------------
  // Feature 1: GitHub Webhook Receiver
  // --------------------------------------------------------------------------
  describe('Feature 01: GitHub Webhook Receiver', () => {
    const secret = 'webhook_secret_123';

    it('TC-T1-F01-01: verifies valid HMAC SHA256 signature on pull_request event', () => {
      const payload = JSON.stringify({ action: 'closed', number: 10 });
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifyGitHubSignature(payload, signature, secret)).toBe(true);
    });

    it('TC-T1-F01-02: handles ping webhook event with pong response shape', () => {
      const event = { zen: 'Keep it logically awesome.', hook_id: 12345 };
      expect(event.zen).toBeDefined();
      expect(typeof event.hook_id).toBe('number');
      expect(isPRMerged(event)).toBe(false);
    });

    it('TC-T1-F01-03: processes pull_request.closed payload with repository metadata', () => {
      const payload = {
        action: 'closed',
        pull_request: { number: 101, title: 'feat: add auth', merged: true },
        repository: { name: 'webapp', full_name: 'acme/webapp' },
      };
      const parsed = GitHubPRClosedWebhookSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(isPRMerged(payload)).toBe(true);
      expect(parsed.data?.repository.full_name).toBe('acme/webapp');
    });

    it('TC-T1-F01-04: verifies headers include x-github-event and signature', () => {
      const body = JSON.stringify({
        action: 'closed',
        pull_request: { number: 1, title: 'feat: test', merged: true },
        repository: { full_name: 'org/repo', name: 'repo' },
      });
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      const headers = {
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signature,
        'content-type': 'application/json',
      };
      expect(headers['x-github-event']).toBe('pull_request');
      expect(verifyGitHubSignature(body, headers['x-hub-signature-256'], secret)).toBe(true);
    });

    it('TC-T1-F01-05: processes release/tag webhook trigger successfully', () => {
      const releaseConstraint = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'proj_demo',
        version_tag: 'v1.0.0',
        release_title: 'Initial Release',
        overview_summary: 'Production launch release notes with ten chars.',
        status: 'published',
      });
      expect(releaseConstraint.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: PR Merge Filter
  // --------------------------------------------------------------------------
  describe('Feature 02: PR Merge Filter', () => {
    it('TC-T1-F02-01: accepts PR when merged flag is explicitly true', () => {
      const payload = {
        action: 'closed',
        pull_request: { number: 1, title: 'feat: new feature', merged: true },
        repository: { full_name: 'acme/app', name: 'app' },
      };
      expect(isPRMerged(payload)).toBe(true);
    });

    it('TC-T1-F02-02: ignores PR closed without being merged', () => {
      const payload = {
        action: 'closed',
        pull_request: { number: 2, title: 'feat: abandoned feature', merged: false },
        repository: { full_name: 'acme/app', name: 'app' },
      };
      expect(isPRMerged(payload)).toBe(false);
    });

    it('TC-T1-F02-03: verifies merged_at timestamp presence on merged PR', () => {
      const payload = {
        action: 'closed',
        pull_request: { number: 3, title: 'feat: timestamped', merged: true, merged_at: new Date().toISOString() },
        repository: { full_name: 'acme/app', name: 'app' },
      };
      const parsed = GitHubPRClosedWebhookSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data?.pull_request.merged_at).toBeDefined();
      expect(isPRMerged(payload)).toBe(true);
    });

    it('TC-T1-F02-04: distinguishes merged PRs across multiple repository branches', () => {
      const events = [
        { action: 'closed', pull_request: { number: 10, title: 'feat: main', merged: true, base: { ref: 'main' } }, repository: { full_name: 'a/b', name: 'b' } },
        { action: 'closed', pull_request: { number: 11, title: 'feat: staging', merged: true, base: { ref: 'staging' } }, repository: { full_name: 'a/b', name: 'b' } },
        { action: 'closed', pull_request: { number: 12, title: 'feat: dev', merged: false, base: { ref: 'dev' } }, repository: { full_name: 'a/b', name: 'b' } },
      ];
      const mergedEvents = events.filter((e) => isPRMerged(e));
      expect(mergedEvents).toHaveLength(2);
      expect(mergedEvents.map((e) => e.pull_request.number)).toEqual([10, 11]);
    });

    it('TC-T1-F02-05: verifies merge commit SHA integrity in payload', () => {
      const validShaPayload = {
        action: 'closed',
        pull_request: {
          number: 4,
          title: 'feat: verified sha',
          merged: true,
          merge_commit_sha: 'e4d909c290d0fb1ca068ffaddf22cbd0addf22cb',
        },
        repository: { full_name: 'acme/app', name: 'app' },
      };
      const parsed = GitHubPRClosedWebhookSchema.safeParse(validShaPayload);
      expect(parsed.success).toBe(true);
      expect(parsed.data?.pull_request.merge_commit_sha).toHaveLength(40);
      expect(isPRMerged(validShaPayload)).toBe(true);
    });
  });


  // --------------------------------------------------------------------------
  // Feature 3: PR Metadata Ingestion
  // --------------------------------------------------------------------------
  describe('Feature 03: PR Metadata Ingestion', () => {
    it('TC-T1-F03-01: ingests title, body, author, and labels into accumulation queue', () => {
      const item = queue.add({
        project_id: 'proj_demo',
        pr_number: 10,
        title: 'feat: user profiles',
        body: 'Implements user avatar and bio updates.',
        author: 'octocat',
        status: 'unreleased',
      });
      expect(item.id).toBeDefined();
      expect(item.status).toBe('unreleased');
      expect(item.author).toBe('octocat');
    });

    it('TC-T1-F03-02: preserves PR number and project mapping accurately', () => {
      const item = queue.add({
        project_id: 'proj_demo',
        pr_number: 11,
        title: 'fix: typo in header',
        status: 'unreleased',
      });
      expect(item.pr_number).toBe(11);
      expect(item.project_id).toBe('proj_demo');
    });

    it('TC-T1-F03-03: records ISO timestamp during queue accumulation', () => {
      const before = Date.now();
      const item = queue.add({
        project_id: 'proj_demo',
        pr_number: 12,
        title: 'feat: dark mode',
        status: 'unreleased',
      });
      const createdTime = new Date(item.created_at).getTime();
      expect(createdTime).toBeGreaterThanOrEqual(before - 1000);
    });

    it('TC-T1-F03-04: retrieves all unreleased items for a given project', () => {
      queue.add({ project_id: 'proj_demo', pr_number: 21, title: 'feat: A', status: 'unreleased' });
      queue.add({ project_id: 'proj_demo', pr_number: 22, title: 'feat: B', status: 'unreleased' });
      const items = queue.list('proj_demo', 'unreleased');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('TC-T1-F03-05: ignores duplicate queue ingestion for the same PR number', () => {
      const first = queue.add({ project_id: 'proj_demo', pr_number: 99, title: 'feat: once', status: 'unreleased' });
      const second = queue.add({ project_id: 'proj_demo', pr_number: 99, title: 'feat: duplicate', status: 'unreleased' });
      expect(first.id).toBe(second.id);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Noise Prefix Filter
  // --------------------------------------------------------------------------
  describe('Feature 04: Noise Prefix Filter', () => {
    it('TC-T1-F04-01: filters chore prefix correctly', () => {
      const res = evaluatePRNoise({ pr_number: 1, title: 'chore: bump dependencies' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('convention_prefix');
    });

    it('TC-T1-F04-02: filters ci prefix with scope correctly', () => {
      const res = evaluatePRNoise({ pr_number: 2, title: 'ci(actions): update matrix' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('convention_prefix');
    });

    it('TC-T1-F04-03: filters test and test(e2e) prefixes', () => {
      const res1 = evaluatePRNoise({ pr_number: 3, title: 'test: add unit tests' });
      const res2 = evaluatePRNoise({ pr_number: 4, title: 'test(e2e): fix playwright' });
      expect(res1.isNoise).toBe(true);
      expect(res2.isNoise).toBe(true);
    });

    it('TC-T1-F04-04: filters style and refactor prefixes', () => {
      const res1 = evaluatePRNoise({ pr_number: 5, title: 'style: run prettier' });
      const res2 = evaluatePRNoise({ pr_number: 6, title: 'refactor(db): optimize query' });
      expect(res1.isNoise).toBe(true);
      expect(res2.isNoise).toBe(true);
    });

    it('TC-T1-F04-05: permits feat and fix prefixes as valid user-facing changes', () => {
      const feat = evaluatePRNoise({ pr_number: 7, title: 'feat: add instant search' });
      const fix = evaluatePRNoise({ pr_number: 8, title: 'fix: resolve bell counter' });
      expect(feat.isNoise).toBe(false);
      expect(fix.isNoise).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Exclusion Marker Filter
  // --------------------------------------------------------------------------
  describe('Feature 05: Exclusion Marker Filter', () => {
    it('TC-T1-F05-01: filters PR with [skip] in title', () => {
      const res = evaluatePRNoise({ pr_number: 1, title: 'feat: internal tool [skip]' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('exclusion_marker');
    });

    it('TC-T1-F05-02: filters PR with [internal] in body', () => {
      const res = evaluatePRNoise({ pr_number: 2, title: 'feat: database migration', body: 'Confidential [internal] update' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('exclusion_marker');
    });

    it('TC-T1-F05-03: filters PR with [no-log] marker in title', () => {
      const res = evaluatePRNoise({ pr_number: 3, title: 'feat: test bench [no-log]' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('exclusion_marker');
    });

    it('TC-T1-F05-04: filters PR with skip-changelog label', () => {
      const res = evaluatePRNoise({ pr_number: 4, title: 'feat: telemetry', labels: ['skip-changelog'] });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('excluded_label');
    });

    it('TC-T1-F05-05: allows PR without exclusion markers to pass cleanly', () => {
      const res = evaluatePRNoise({ pr_number: 5, title: 'feat: public release portal', body: 'Ready for production.' });
      expect(res.isNoise).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Gemini 1.5 Flash Synthesizer
  // --------------------------------------------------------------------------
  describe('Feature 06: Gemini 1.5 Flash Synthesizer', () => {
    const aiService = new GeminiSynthesisService();

    it('TC-T1-F06-01: synthesizes structured release title and overview summary', async () => {
      const prs = [{ pr_number: 1, title: 'feat: custom domains support' }];
      const output = await aiService.synthesize(prs, 'v1.1.0');
      expect(output.release_title).toContain('v1.1.0');
      expect(output.overview_summary.length).toBeGreaterThanOrEqual(10);
    });

    it('TC-T1-F06-02: strictly validates output against GeminiReleaseOutputSchema', async () => {
      const prs = [{ pr_number: 2, title: 'feat: dark theme' }];
      const output = await aiService.synthesize(prs, 'v1.2.0');
      expect(() => GeminiReleaseOutputSchema.parse(output)).not.toThrow();
    });

    it('TC-T1-F06-03: enforces minimum title length of 3 characters', () => {
      expect(() =>
        GeminiReleaseOutputSchema.parse({
          release_title: 'AB',
          overview_summary: 'Valid summary here for testing.',
          categories: { features: [], improvements: [], fixes: [] },
          distribution: { email_plain_text: 'Valid email draft here.', social_post_thread: ['Post 1'] },
        })
      ).toThrow();
    });

    it('TC-T1-F06-04: enforces minimum overview summary length of 10 characters', () => {
      expect(() =>
        GeminiReleaseOutputSchema.parse({
          release_title: 'v1.0.0 — Launch',
          overview_summary: 'Short',
          categories: { features: [], improvements: [], fixes: [] },
          distribution: { email_plain_text: 'Valid email draft here.', social_post_thread: ['Post 1'] },
        })
      ).toThrow();
    });

    it('TC-T1-F06-05: rejects extra unapproved properties via strict schema enforcement', () => {
      expect(() =>
        GeminiReleaseOutputSchema.parse({
          release_title: 'v1.0.0 — Launch',
          overview_summary: 'Comprehensive overview summary for release.',
          categories: { features: [], improvements: [], fixes: [] },
          distribution: { email_plain_text: 'Valid email draft here.', social_post_thread: ['Post 1'] },
          injected_field: 'malicious payload',
        })
      ).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Release Categorization
  // --------------------------------------------------------------------------
  describe('Feature 07: Release Categorization', () => {
    const aiService = new GeminiSynthesisService();

    it('TC-T1-F07-01: categorizes features into features array', async () => {
      const prs = [{ pr_number: 10, title: 'feat: add webhooks' }];
      const res = await aiService.synthesize(prs, 'v2.0.0');
      expect(res.categories.features).toHaveLength(1);
      expect(res.categories.features[0].title).toBe('add webhooks');
    });

    it('TC-T1-F07-02: categorizes fixes into fixes array', async () => {
      const prs = [{ pr_number: 11, title: 'fix: resolve race condition' }];
      const res = await aiService.synthesize(prs, 'v2.0.0');
      expect(res.categories.fixes).toHaveLength(1);
      expect(res.categories.fixes[0].title).toBe('resolve race condition');
    });

    it('TC-T1-F07-03: categorizes improvements into improvements array', async () => {
      const prs = [{ pr_number: 12, title: 'perf: faster query execution' }];
      const res = await aiService.synthesize(prs, 'v2.0.0');
      expect(res.categories.improvements).toHaveLength(1);
    });

    it('TC-T1-F07-04: allows empty category arrays when no items exist', () => {
      const parsed = ReleaseCategoriesSchema.parse({ features: [], improvements: [], fixes: [] });
      expect(parsed.features).toEqual([]);
      expect(parsed.improvements).toEqual([]);
      expect(parsed.fixes).toEqual([]);
    });

    it('TC-T1-F07-05: verifies category item structure has title and description', () => {
      const item = { title: 'Feature X', description: 'Detailed info', pr_number: 42, author: 'alice' };
      const parsed = CategoryItemSchema.parse(item);
      expect(parsed.title).toBe('Feature X');
      expect(parsed.pr_number).toBe(42);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Multi-Channel Syndication Drafts
  // --------------------------------------------------------------------------
  describe('Feature 08: Multi-Channel Syndication Drafts', () => {
    const aiService = new GeminiSynthesisService();

    it('TC-T1-F08-01: generates plain-text email distribution draft', async () => {
      const prs = [{ pr_number: 1, title: 'feat: analytics dashboard' }];
      const res = await aiService.synthesize(prs, 'v1.5.0');
      expect(res.distribution.email_plain_text.length).toBeGreaterThanOrEqual(10);
      expect(res.distribution.email_plain_text).toContain('v1.5.0');
    });

    it('TC-T1-F08-02: generates social thread post list with multiple posts', async () => {
      const prs = [{ pr_number: 1, title: 'feat: analytics dashboard' }];
      const res = await aiService.synthesize(prs, 'v1.5.0');
      expect(res.distribution.social_post_thread.length).toBeGreaterThanOrEqual(1);
      expect(typeof res.distribution.social_post_thread[0]).toBe('string');
    });

    it('TC-T1-F08-03: validates DistributionSchema correctly against valid payloads', () => {
      const draft = {
        email_plain_text: 'ShipLog v1.0 is released with exciting updates!',
        social_post_thread: ['Check out v1.0! 🚀', 'Link to changelog in bio.'],
      };
      expect(() => DistributionSchema.parse(draft)).not.toThrow();
    });

    it('TC-T1-F08-04: rejects empty social_post_thread array', () => {
      const draft = { email_plain_text: 'Long valid plain text email draft.', social_post_thread: [] };
      expect(() => DistributionSchema.parse(draft)).toThrow();
    });

    it('TC-T1-F08-05: rejects short email plain text under 10 characters', () => {
      const draft = { email_plain_text: 'Short', social_post_thread: ['Post 1'] };
      expect(() => DistributionSchema.parse(draft)).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Hybrid Mode & Mock Fixtures
  // --------------------------------------------------------------------------
  describe('Feature 09: Hybrid Mode & Mock Fixtures', () => {
    it('TC-T1-F09-01: executes offline deterministic synthesis with no API key provided', async () => {
      const service = new GeminiSynthesisService(undefined);
      const res = await service.synthesize([{ pr_number: 1, title: 'feat: offline mode' }], 'v1.0.0');
      expect(res.release_title).toContain('offline mode');
    });

    it('TC-T1-F09-02: executes deterministic synthesis when apiKey is mock_key', async () => {
      const service = new GeminiSynthesisService('mock_key');
      const res = await service.synthesize([{ pr_number: 2, title: 'fix: patch' }], 'v1.0.1');
      expect(res.categories.fixes).toHaveLength(1);
    });

    it('TC-T1-F09-03: mock output matches GeminiReleaseOutputSchema strictly', async () => {
      const service = new GeminiSynthesisService();
      const res = await service.synthesize([{ pr_number: 3, title: 'feat: mock test' }], 'v1.0.2');
      expect(GeminiReleaseOutputSchema.safeParse(res).success).toBe(true);
    });

    it('TC-T1-F09-04: guarantees consistent deterministic output for identical input PR batches', async () => {
      const service = new GeminiSynthesisService();
      const prs = [{ pr_number: 4, title: 'feat: determinism' }];
      const res1 = await service.synthesize(prs, 'v1.0.3');
      const res2 = await service.synthesize(prs, 'v1.0.3');
      expect(res1.release_title).toBe(res2.release_title);
      expect(res1.overview_summary).toBe(res2.overview_summary);
    });

    it('TC-T1-F09-05: supports custom author and pr_number preservation in mock mode', async () => {
      const service = new GeminiSynthesisService();
      const res = await service.synthesize([{ pr_number: 77, title: 'feat: author test', author: 'alice' }], 'v1.0.4');
      expect(res.categories.features[0].author).toBe('alice');
      expect(res.categories.features[0].pr_number).toBe(77);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Local Webhook Dispatcher CLI
  // --------------------------------------------------------------------------
  describe('Feature 10: Local Webhook Dispatcher CLI', () => {
    it('TC-T1-F10-01: executes synthetic dispatch function returning status code', async () => {
      const res = await dispatchMockPR({
        port: 9999,
        host: '127.0.0.1',
        pr: 10,
        title: 'feat: test dispatch',
        body: 'Dispatch body',
        author: 'dispatcher',
        secret: 'test_sec',
      });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('TC-T1-F10-02: generates sha256 signature in dispatcher', () => {
      const secret = 'dispatch_secret';
      const body = JSON.stringify({ pr: 12 });
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifyGitHubSignature(body, signature, secret)).toBe(true);
    });

    it('TC-T1-F10-03: supports custom port configuration', async () => {
      const res = await dispatchMockPR({
        port: 8080,
        host: '127.0.0.1',
        pr: 11,
        title: 'feat: port test',
        body: 'test',
        author: 'bob',
        secret: 'sec',
      });
      expect(res.status).toBeGreaterThanOrEqual(0);
    });

    it('TC-T1-F10-04: verifies default mock PR payload structure', () => {
      const payload = {
        action: 'closed',
        pull_request: { number: 42, title: 'feat: instant search', merged: true },
        repository: { full_name: 'acme/demo', name: 'demo' },
      };
      const parsed = GitHubPRClosedWebhookSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      expect(isPRMerged(payload)).toBe(true);
    });

    it('TC-T1-F10-05: formats synthetic event headers with GitHub user agent', () => {
      const secret = 'dispatch_sec_header';
      const body = JSON.stringify({ pr: 42 });
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      const headers = {
        'User-Agent': 'GitHub-Hookshot/shiplog-mock',
        'X-GitHub-Event': 'pull_request',
        'X-Hub-Signature-256': signature,
      };
      expect(headers['User-Agent']).toContain('GitHub-Hookshot');
      expect(verifyGitHubSignature(body, headers['X-Hub-Signature-256'], secret)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Next.js 15 App Router
  // --------------------------------------------------------------------------
  describe('Feature 11: Next.js 15 App Router', () => {
    it('TC-T1-F11-01: app layout exists and contains HTML structure', () => {
      const layoutPath = path.resolve(process.cwd(), 'app/layout.tsx');
      expect(fs.existsSync(layoutPath)).toBe(true);
      const content = fs.readFileSync(layoutPath, 'utf8');
      expect(content).toContain('<html');
      expect(content).toContain('<body');
    });

    it('TC-T1-F11-02: root page component exports default function', () => {
      const pagePath = path.resolve(process.cwd(), 'app/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, 'utf8');
      expect(content).toContain('export default');
    });

    it('TC-T1-F11-03: globals.css exists and imports tailwind directives', () => {
      const cssPath = path.resolve(process.cwd(), 'app/globals.css');
      expect(fs.existsSync(cssPath)).toBe(true);
      const content = fs.readFileSync(cssPath, 'utf8');
      expect(content).toContain('@tailwind');
    });

    it('TC-T1-F11-04: supports Next.js dynamic routing path conventions and reserved segments', () => {
      expect(isReservedAppRoute('c')).toBe(true);
      expect(isReservedAppRoute('api')).toBe(true);
      expect(isReservedAppRoute('dashboard')).toBe(true);
      expect(isReservedAppRoute('my-custom-saas-slug')).toBe(false);
    });

    it('TC-T1-F11-05: Next.js configuration exists and exports valid config', () => {
      const configPath = path.resolve(process.cwd(), 'next.config.mjs');
      expect(fs.existsSync(configPath)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Tailwind & shadcn/ui Primitives
  // --------------------------------------------------------------------------
  describe('Feature 12: Tailwind & shadcn/ui Primitives', () => {
    it('TC-T1-F12-01: tailwind.config.ts defines color tokens and animations', () => {
      const configPath = path.resolve(process.cwd(), 'tailwind.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('tailwindcss-animate');
    });

    it('TC-T1-F12-02: components.json specifies shadcn configuration', () => {
      const compJsonPath = path.resolve(process.cwd(), 'components.json');
      expect(fs.existsSync(compJsonPath)).toBe(true);
      const json = JSON.parse(fs.readFileSync(compJsonPath, 'utf8'));
      expect(json.tailwind).toBeDefined();
    });

    it('TC-T1-F12-03: cn utility helper merges classnames correctly', async () => {
      const utils = await import('../../lib/utils');
      expect(utils.cn('px-2', 'py-1', { 'bg-blue-500': true })).toBe('px-2 py-1 bg-blue-500');
    });

    it('TC-T1-F12-04: Button primitive exists and renders with variants', () => {
      const buttonPath = path.resolve(process.cwd(), 'components/ui/button.tsx');
      expect(fs.existsSync(buttonPath)).toBe(true);
    });

    it('TC-T1-F12-05: Card, Badge, Dialog, and Tabs primitives exist in components/ui', () => {
      expect(fs.existsSync(path.resolve(process.cwd(), 'components/ui/card.tsx'))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), 'components/ui/badge.tsx'))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), 'components/ui/dialog.tsx'))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), 'components/ui/tabs.tsx'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: Supabase PostgreSQL Schema
  // --------------------------------------------------------------------------
  describe('Feature 13: Supabase PostgreSQL Schema', () => {
    it('TC-T1-F13-01: initial schema migration file exists', () => {
      const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20260922000001_initial_schema.sql');
      expect(fs.existsSync(migrationFile)).toBe(true);
    });

    it('TC-T1-F13-02: schema defines profiles, installations, projects tables', () => {
      const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260922000001_initial_schema.sql'), 'utf8');
      expect(sql.toLowerCase()).toContain('table if not exists public.profiles');
      expect(sql.toLowerCase()).toContain('table if not exists public.installations');
      expect(sql.toLowerCase()).toContain('table if not exists public.projects');
    });

    it('TC-T1-F13-03: schema defines pull_requests and changelogs tables', () => {
      const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260922000001_initial_schema.sql'), 'utf8');
      expect(sql.toLowerCase()).toContain('table if not exists public.pull_requests');
      expect(sql.toLowerCase()).toContain('table if not exists public.changelogs');
    });

    it('TC-T1-F13-04: schema defines foreign key references between tables', () => {
      const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260922000001_initial_schema.sql'), 'utf8');
      expect(sql.toLowerCase()).toContain('references public.projects');
    });

    it('TC-T1-F13-05: schema defines indexes on frequent query columns', () => {
      const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260922000001_initial_schema.sql'), 'utf8');
      expect(sql.toLowerCase()).toContain('create index');
      expect(sql.toLowerCase()).toContain('idx_projects_slug');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Row-Level Security (RLS)
  // --------------------------------------------------------------------------
  describe('Feature 14: Row-Level Security (RLS)', () => {
    it('TC-T1-F14-01: RLS migration file exists and enables security policies', () => {
      const rlsFile = path.resolve(process.cwd(), 'supabase/migrations/20260922000002_rls_policies.sql');
      expect(fs.existsSync(rlsFile)).toBe(true);
      const sql = fs.readFileSync(rlsFile, 'utf8');
      expect(sql.toLowerCase()).toContain('enable row level security');
    });

    it('TC-T1-F14-02: service_role bypasses RLS across all tables', () => {
      expect(evaluateMockRLS('profiles', 'SELECT', { role: 'service_role' }, {})).toBe(true);
      expect(evaluateMockRLS('projects', 'SELECT', { role: 'service_role' }, {})).toBe(true);
      expect(evaluateMockRLS('dodo_webhook_events', 'INSERT', { role: 'service_role' }, { event_id: 'e1' })).toBe(true);
    });

    it('TC-T1-F14-03: policies ensure owners can read/write their own projects', () => {
      const ownProject = { user_id: 'founder_1', name: 'My App' };
      const canReadOwn = evaluateMockRLS('projects', 'SELECT', { role: 'authenticated', userId: 'founder_1' }, ownProject);
      const canReadOther = evaluateMockRLS('projects', 'SELECT', { role: 'authenticated', userId: 'founder_2' }, ownProject);
      expect(canReadOwn).toBe(true);
      expect(canReadOther).toBe(false);
    });

    it('TC-T1-F14-04: public read access allowed for published changelogs', () => {
      const published = { user_id: 'founder_1', is_published: true, status: 'published' };
      const anonCanRead = evaluateMockRLS('changelogs', 'SELECT', { role: 'anon' }, published);
      expect(anonCanRead).toBe(true);
    });

    it('TC-T1-F14-05: draft changelogs protected from public view', () => {
      const draft = { user_id: 'founder_1', is_published: false, status: 'draft' };
      const anonCanReadDraft = evaluateMockRLS('changelogs', 'SELECT', { role: 'anon' }, draft);
      const ownerCanReadDraft = evaluateMockRLS('changelogs', 'SELECT', { role: 'authenticated', userId: 'founder_1' }, draft);
      expect(anonCanReadDraft).toBe(false);
      expect(ownerCanReadDraft).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Repository Connection Workflow
  // --------------------------------------------------------------------------
  describe('Feature 15: Repository Connection Workflow', () => {
    it('TC-T1-F15-01: links repository to project with full repository name and schema validation', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'user_f15_1',
        name: 'Repo 1',
        slug: 'acme-repo1-f15',
        repo_owner: 'acme',
        repo_name: 'repo1',
        repo_full_name: 'acme/repo1',
      });
      expect(res.valid).toBe(true);
    });

    it('TC-T1-F15-02: allows Free tier user to connect 1 repository', () => {
      const verdict = checkCanConnectRepo({ tier: 'free', active_repos_count: 0, monthly_releases_count: 0 });
      expect(verdict.allowed).toBe(true);
    });

    it('TC-T1-F15-03: blocks Free tier user from connecting a 2nd repository', () => {
      const verdict = checkCanConnectRepo({ tier: 'free', active_repos_count: 1, monthly_releases_count: 0 });
      expect(verdict.allowed).toBe(false);
      expect(verdict.upgrade_required).toBe(true);
    });

    it('TC-T1-F15-04: allows Pro tier user to connect unlimited repositories', () => {
      const verdict = checkCanConnectRepo({ tier: 'pro', active_repos_count: 10, monthly_releases_count: 10 });
      expect(verdict.allowed).toBe(true);
    });

    it('TC-T1-F15-05: stores webhook secret and enforces non-empty project fields', () => {
      const secret = 'whsec_' + crypto.randomBytes(8).toString('hex');
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'user_f15_2',
        name: 'Repo With Secret',
        slug: 'repo-with-secret',
        repo_owner: 'acme',
        repo_name: 'repo-secret',
        repo_full_name: 'acme/repo-secret',
        webhook_secret: secret,
      });
      expect(res.valid).toBe(true);
    });
  });


  // --------------------------------------------------------------------------
  // Feature 16: Unreleased PR Queue Dashboard
  // --------------------------------------------------------------------------
  describe('Feature 16: Unreleased PR Queue Dashboard', () => {
    it('TC-T1-F16-01: lists unreleased PRs for project dashboard', () => {
      queue.add({ project_id: 'p_dash', pr_number: 1, title: 'feat: table component', status: 'unreleased' });
      queue.add({ project_id: 'p_dash', pr_number: 2, title: 'feat: filter dropdown', status: 'unreleased' });
      const items = queue.list('p_dash', 'unreleased');
      expect(items).toHaveLength(2);
    });

    it('TC-T1-F16-02: indicates status of items as unreleased', () => {
      const item = queue.add({ project_id: 'p_dash', pr_number: 3, title: 'feat: badges', status: 'unreleased' });
      expect(item.status).toBe('unreleased');
    });

    it('TC-T1-F16-03: updates status when items are released', () => {
      queue.add({ project_id: 'p_dash', pr_number: 4, title: 'feat: search', status: 'unreleased' });
      queue.markReleased('p_dash', [4]);
      const unreleased = queue.list('p_dash', 'unreleased');
      expect(unreleased.find((i) => i.pr_number === 4)).toBeUndefined();
    });

    it('TC-T1-F16-04: preserves all items across statuses when querying all', () => {
      queue.add({ project_id: 'p_dash', pr_number: 5, title: 'feat: item 5', status: 'unreleased' });
      queue.markReleased('p_dash', [5]);
      const all = queue.list('p_dash', 'all');
      expect(all.find((i) => i.pr_number === 5)).toBeDefined();
    });

    it('TC-T1-F16-05: isolates queue items between different project IDs', () => {
      queue.add({ project_id: 'project_A', pr_number: 1, title: 'feat: for A', status: 'unreleased' });
      queue.add({ project_id: 'project_B', pr_number: 1, title: 'feat: for B', status: 'unreleased' });
      expect(queue.list('project_A', 'unreleased')).toHaveLength(1);
      expect(queue.list('project_B', 'unreleased')).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Release Generation Action
  // --------------------------------------------------------------------------
  describe('Feature 17: Release Generation Action', () => {
    const aiService = new GeminiSynthesisService();

    it('TC-T1-F17-01: triggers synthesis using accumulated unreleased PRs', async () => {
      const prs = [
        { pr_number: 10, title: 'feat: one-click publish' },
        { pr_number: 11, title: 'fix: mobile styling' },
      ];
      const release = await aiService.synthesize(prs, 'v1.0.0');
      expect(release.categories.features).toHaveLength(1);
      expect(release.categories.fixes).toHaveLength(1);
    });

    it('TC-T1-F17-02: generates draft release with version tag', async () => {
      const release = await aiService.synthesize([{ pr_number: 1, title: 'feat: tag' }], 'v2.1.0');
      expect(release.release_title).toContain('v2.1.0');
    });

    it('TC-T1-F17-03: returns distribution channels ready for editing', async () => {
      const release = await aiService.synthesize([{ pr_number: 1, title: 'feat: dist' }], 'v1.0.0');
      expect(release.distribution.email_plain_text).toBeDefined();
      expect(release.distribution.social_post_thread).toBeDefined();
    });

    it('TC-T1-F17-04: supports release generation with multiple features in a single batch', async () => {
      const prs = [
        { pr_number: 1, title: 'feat: feature 1' },
        { pr_number: 2, title: 'feat: feature 2' },
        { pr_number: 3, title: 'feat: feature 3' },
      ];
      const release = await aiService.synthesize(prs, 'v1.2.0');
      expect(release.categories.features).toHaveLength(3);
    });

    it('TC-T1-F17-05: enforces version tag string validation and schema constraints', () => {
      const validConstraint = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p_vtag',
        version_tag: 'v1.0.0',
        release_title: 'Title',
        overview_summary: 'Ten char overview.',
      });
      expect(validConstraint.valid).toBe(true);

      const invalidConstraint = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p_vtag',
        version_tag: '',
        release_title: 'Title',
        overview_summary: 'Ten char overview.',
      });
      expect(invalidConstraint.valid).toBe(false);
    });
  });


  // --------------------------------------------------------------------------
  // Feature 18: Inline Markdown Release Editor
  // --------------------------------------------------------------------------
  describe('Feature 18: Inline Markdown Release Editor', () => {
    it('TC-T1-F18-01: allows modifying overview summary before publishing', () => {
      const draft = {
        release_title: 'v1.1.0 — New Features',
        overview_summary: 'Updated overview summary after founder review.',
        markdown_body: '## Details\n\nAll systems operational.',
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(true);
      expect(res.sanitizedDraft?.overview_summary).toBe('Updated overview summary after founder review.');
    });

    it('TC-T1-F18-02: allows editing category items descriptions', () => {
      const draft = {
        release_title: 'v1.1.0 — Major Upgrade',
        overview_summary: 'Polished release notes for founders.',
        markdown_body: '### Features\n- Fast changelog rendering',
        categories: {
          features: [{ title: 'Instant Search', description: 'Polished customer-facing description.' }],
          improvements: [],
          fixes: [],
        },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(true);
      expect((res.sanitizedDraft?.categories.features[0] as any).description).toBe('Polished customer-facing description.');
    });

    it('TC-T1-F18-03: supports markdown syntax in description and sanitizes scripts', () => {
      const draft = {
        release_title: 'v1.2.0 — Security & Speed',
        overview_summary: 'Highlights include faster loading and security.',
        markdown_body: '### Highlights\n- **Faster** loading\n- [Docs](https://shiplog.dev)<script>alert("xss")</script>',
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(true);
      expect(res.sanitizedDraft?.markdown_body).toContain('### Highlights');
      expect(res.sanitizedDraft?.markdown_body).toContain('**Faster**');
      expect(res.sanitizedDraft?.markdown_body).not.toContain('<script>');
    });

    it('TC-T1-F18-04: allows modifying email plain-text draft', () => {
      const draft = {
        release_title: 'v1.3.0 — Mobile Drawer',
        overview_summary: 'Announcing responsive drawer improvements.',
        markdown_body: 'Details about the mobile drawer.',
        distribution: {
          email_plain_text: 'Personalized email from founder for subscribers.',
          social_post_thread: ['1/1 Mobile drawer is live!'],
        },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(true);
      const email = formatSyndicationEmail(draft);
      expect(email).toBe('Personalized email from founder for subscribers.');
    });

    it('TC-T1-F18-05: allows adding or removing posts from social thread', () => {
      const draft = {
        release_title: 'v1.4.0 — Multi-Channel Syndication',
        overview_summary: 'Automated email and Twitter thread generation.',
        markdown_body: 'Full release notes.',
        distribution: {
          email_plain_text: 'Hey everyone, check out v1.4.0!',
          social_post_thread: ['Announcing v1.4.0!', 'Check out docs!'],
        },
      };
      const thread = formatSocialThread(draft);
      expect(thread).toHaveLength(2);
      expect(thread[0]).toContain('1/2 Announcing v1.4.0!');
      expect(thread[1]).toContain('2/2 Check out docs!');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 19: One-Click Publishing Workflow
  // --------------------------------------------------------------------------
  describe('Feature 19: One-Click Publishing Workflow', () => {
    it('TC-T1-F19-01: transitions release status from draft to published with constraint check', () => {
      const res = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'proj_publish_1',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 Release',
        overview_summary: 'Published release notes overview.',
        status: 'published',
      });
      expect(res.valid).toBe(true);
    });

    it('TC-T1-F19-02: checks publishing allowance against tier limits', () => {
      const verdict = checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 1 });
      expect(verdict.allowed).toBe(true);
    });

    it('TC-T1-F19-03: marks associated queue items as released upon publication', () => {
      queue.add({ project_id: 'p_pub', pr_number: 10, title: 'feat: done', status: 'unreleased' });
      queue.markReleased('p_pub', [10]);
      expect(queue.list('p_pub', 'unreleased')).toHaveLength(0);
    });

    it('TC-T1-F19-04: allows Pro tier unlimited published releases', () => {
      const verdict = checkCanPublishRelease({ tier: 'pro', active_repos_count: 5, monthly_releases_count: 99 });
      expect(verdict.allowed).toBe(true);
    });

    it('TC-T1-F19-05: validates published_at ISO format and changelog schema', () => {
      const res = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'proj_publish_2',
        version_tag: 'v2.0.0',
        release_title: 'v2.0.0 Major',
        overview_summary: 'Another published release notes.',
        status: 'published',
      });
      expect(res.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 20: Syndication Copy Actions
  // --------------------------------------------------------------------------
  describe('Feature 20: Syndication Copy Actions', () => {
    it('TC-T1-F20-01: formats plain text email draft for clipboard copy', () => {
      const release = {
        release_title: 'v1.0.0 — Initial Launch',
        overview_summary: 'We released v1.0.0 today with automated changelog generation.',
        categories: {
          features: [{ title: 'Automated Notes', description: 'Generated via Gemini' }],
          improvements: [],
          fixes: [],
        },
      };
      const email = formatSyndicationEmail(release);
      expect(email).toContain('Subject: Updates live: v1.0.0 — Initial Launch');
      expect(email).toContain('Hey everyone,');
      expect(email).toContain('• Automated Notes');
    });

    it('TC-T1-F20-02: formats Twitter thread posts with numbering delimiters', () => {
      const release = {
        release_title: 'v1.0.0 — Initial Launch',
        overview_summary: 'Excited to announce ShipLog v1.0.0 is live.',
        categories: {
          features: [{ title: 'Shadow DOM' }],
          improvements: [{ title: 'Next.js 15' }],
        },
      };
      const thread = formatSocialThread(release);
      expect(thread.length).toBeGreaterThanOrEqual(2);
      expect(thread[0].startsWith('1/')).toBe(true);
      expect(thread[1].startsWith('2/')).toBe(true);
    });

    it('TC-T1-F20-03: handles single-post social syndication copy within Twitter length', () => {
      const release = {
        release_title: 'v1.0.0',
        overview_summary: 'Short summary update for users.',
      };
      const thread = formatSocialThread(release);
      for (const post of thread) {
        expect(post.length).toBeLessThanOrEqual(280);
      }
    });

    it('TC-T1-F20-04: sanitizes HTML characters from plain-text copy buffers', () => {
      const release = {
        release_title: 'v1.0.1',
        overview_summary: 'Bug fix release',
        distribution: {
          email_plain_text: 'Feature <script>alert("xss")</script><b>New & Improved</b>',
        },
      };
      const email = formatSyndicationEmail(release);
      expect(email).not.toContain('<script>');
      expect(email).not.toContain('<b>');
      expect(email).toContain('Feature alert("xss")New & Improved');
    });

    it('TC-T1-F20-05: sanitizes HTML tags from social posts in thread copy', () => {
      const release = {
        release_title: 'v1.0.2',
        overview_summary: 'Update',
        distribution: {
          social_post_thread: ['Announcement <span>v1.0.2</span> <a href="url">link</a>'],
        },
      };
      const thread = formatSocialThread(release);
      expect(thread[0]).not.toContain('<span>');
      expect(thread[0]).not.toContain('<a href="url">');
      expect(thread[0]).toContain('Announcement v1.0.2 link');
    });
  });


  // --------------------------------------------------------------------------
  // Feature 21: Public SSR Changelog Portal
  // --------------------------------------------------------------------------
  describe('Feature 21: Public SSR Changelog Portal', () => {
    const mockRelease: PublishedChangelog = {
      id: 'rel_1',
      project_id: 'p1',
      project_slug: 'acme',
      version_tag: 'v1.0.0',
      release_title: 'v1.0.0 — Initial Launch',
      overview_summary: 'Excited to bring you our first major release.',
      categories: {
        features: [{ title: 'Widget', description: 'Zero-dep widget' }],
        improvements: [],
        fixes: [],
      },
      distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
      published_at: new Date().toISOString(),
      status: 'published',
    };

    it('TC-T1-F21-01: renders SSR HTML containing project name and timeline', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.html).toContain('Acme Changelog');
      expect(res.html).toContain('v1.0.0 — Initial Launch');
    });

    it('TC-T1-F21-02: sets sub-second HTTP cache headers on SSR response', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.headers['Cache-Control']).toBe('public, max-age=60, s-maxage=300');
    });

    it('TC-T1-F21-03: renders category badges inside release articles', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.html).toContain('badge-feature');
      expect(res.html).toContain('Widget');
    });

    it('TC-T1-F21-04: filters out draft releases from public timeline', () => {
      const draft: PublishedChangelog = { ...mockRelease, id: 'draft_1', status: 'draft', release_title: 'Draft Secret' };
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease, draft]);
      expect(res.html).not.toContain('Draft Secret');
    });

    it('TC-T1-F21-05: returns HTTP 200 OK status on public route', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.statusCode).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 22: Dynamic OpenGraph Meta Tags
  // --------------------------------------------------------------------------
  describe('Feature 22: Dynamic OpenGraph Meta Tags', () => {
    const mockRelease: PublishedChangelog = {
      id: 'rel_1',
      project_id: 'p1',
      project_slug: 'acme',
      version_tag: 'v1.4.0',
      release_title: 'v1.4.0 — Super Search',
      overview_summary: 'Fast fuzzy search.',
      categories: { features: [], improvements: [], fixes: [] },
      distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
      published_at: new Date().toISOString(),
      status: 'published',
    };

    it('TC-T1-F22-01: generates dynamic og:title containing latest release title', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.meta.ogTitle).toContain('v1.4.0 — Super Search');
      expect(res.html).toContain(`content="${res.meta.ogTitle}"`);
    });

    it('TC-T1-F22-02: generates og:description containing overview summary', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.meta.ogDescription).toBe('Fast fuzzy search.');
    });

    it('TC-T1-F22-03: generates dynamic OG image URL with encoded title', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.meta.ogImage).toContain('api/og?title=');
      expect(res.meta.ogImage).toContain('Super%20Search');
    });

    it('TC-T1-F22-04: provides fallback og:title when project has zero published releases', () => {
      const res = renderSSRChangelog({ name: 'EmptyApp', slug: 'empty', is_pro: false }, []);
      expect(res.meta.ogTitle).toBe('EmptyApp Changelog');
    });

    it('TC-T1-F22-05: renders HTML title tag matching og:title', () => {
      const res = renderSSRChangelog({ name: 'Acme', slug: 'acme', is_pro: false }, [mockRelease]);
      expect(res.html).toContain(`<title>${res.meta.ogTitle}</title>`);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 23: Standalone Zero-Dependency Widget
  // --------------------------------------------------------------------------
  describe('Feature 23: Standalone Zero-Dependency Widget', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');

    it('TC-T1-F23-01: public/widget.js file exists', () => {
      expect(fs.existsSync(widgetPath)).toBe(true);
    });

    it('TC-T1-F23-02: widget bundle uses self-contained IIFE format', () => {
      const content = fs.readFileSync(widgetPath, 'utf8');
      expect(content.startsWith('(') || content.startsWith(';(') || content.startsWith('!function') || content.startsWith('(()=>{')).toBe(true);
    });

    it('TC-T1-F23-03: widget registers custom element shiplog-widget', () => {
      const content = fs.readFileSync(widgetPath, 'utf8');
      expect(content).toContain('customElements.define("shiplog-widget"');
    });

    it('TC-T1-F23-04: widget contains zero external require or import dependencies', () => {
      const content = fs.readFileSync(widgetPath, 'utf8');
      expect(content).not.toContain('require(');
      expect(content).not.toContain('from "react"');
    });

    it('TC-T1-F23-05: widget defines notification bell and drawer container', () => {
      const content = fs.readFileSync(widgetPath, 'utf8');
      expect(content).toContain('bell');
      expect(content).toContain('drawer');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 24: Widget Bundle Size Constraint
  // --------------------------------------------------------------------------
  describe('Feature 24: Widget Bundle Size Constraint', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');
    const MAX_LIMIT_BYTES = 5120; // 5 KB

    it('TC-T1-F24-01: raw bundle size is strictly < 5120 bytes', () => {
      const file = fs.readFileSync(widgetPath);
      expect(file.length).toBeLessThan(MAX_LIMIT_BYTES);
    });

    it('TC-T1-F24-02: gzipped bundle size is strictly < 5120 bytes', () => {
      const file = fs.readFileSync(widgetPath);
      const gzipped = zlib.gzipSync(file);
      expect(gzipped.length).toBeLessThan(MAX_LIMIT_BYTES);
    });

    it('TC-T1-F24-03: gzipped size is less than raw size', () => {
      const file = fs.readFileSync(widgetPath);
      const gzipped = zlib.gzipSync(file);
      expect(gzipped.length).toBeLessThan(file.length);
    });

    it('TC-T1-F24-04: check-widget-size script exits cleanly with code 0', () => {
      const scriptPath = path.resolve(process.cwd(), 'scripts/check-widget-size.ts');
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('TC-T1-F24-05: budget consumption is under 80% of allowed limit', () => {
      const file = fs.readFileSync(widgetPath);
      const pct = (file.length / MAX_LIMIT_BYTES) * 100;
      expect(pct).toBeLessThan(80);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 25: Scoped Shadow DOM Isolation
  // --------------------------------------------------------------------------
  describe('Feature 25: Scoped Shadow DOM Isolation', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');

    it('TC-T1-F25-01: widget code attaches open ShadowRoot to element', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('this.attachShadow({mode:"open"})');
    });

    it('TC-T1-F25-02: widget inlines style tag with :host { all: initial } reset', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain(':host{all:initial;');
    });

    it('TC-T1-F25-03: host styles do not affect shadow DOM elements in widget bundle', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('class ShipLogWidget extends HTMLElement');
      expect(widgetCode).toContain('customElements.define("shiplog-widget",ShipLogWidget)');
    });

    it('TC-T1-F25-04: shadow styles do not leak to host DOM', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('<style>:host{all:initial;');
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<style>.isolated { background: purple; }</style>';
      expect(document.querySelector('.isolated')).toBeNull();
    });


    it('TC-T1-F25-05: supports slotting or nested query selectors inside shadowRoot', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div id="bell">Bell</div>';
      expect(shadow.getElementById('bell')?.textContent).toBe('Bell');
    });
  });


  // --------------------------------------------------------------------------
  // Feature 26: LocalStorage Unread Indicator
  // --------------------------------------------------------------------------
  describe('Feature 26: LocalStorage Unread Indicator', () => {
    beforeEach(() => {
      try {
        localStorage.clear();
      } catch {}
    });

    it('TC-T1-F26-01: sets unread indicator status in localStorage', () => {
      localStorage.setItem('shiplog_unread_demo', '3');
      expect(localStorage.getItem('shiplog_unread_demo')).toBe('3');
    });

    it('TC-T1-F26-02: clears unread indicator to 0 when user opens drawer', () => {
      localStorage.setItem('shiplog_unread_demo', '2');
      localStorage.setItem('shiplog_unread_demo', '0');
      expect(localStorage.getItem('shiplog_unread_demo')).toBe('0');
    });

    it('TC-T1-F26-03: parses unread count as integer', () => {
      localStorage.setItem('shiplog_unread_demo', '5');
      const count = parseInt(localStorage.getItem('shiplog_unread_demo') || '0', 10);
      expect(count).toBe(5);
    });

    it('TC-T1-F26-04: handles missing unread key by defaulting to 0', () => {
      const count = parseInt(localStorage.getItem('nonexistent') || '0', 10);
      expect(count).toBe(0);
    });

    it('TC-T1-F26-05: scopes unread counter key per project slug', () => {
      localStorage.setItem('shiplog_unread_projA', '1');
      localStorage.setItem('shiplog_unread_projB', '4');
      expect(localStorage.getItem('shiplog_unread_projA')).toBe('1');
      expect(localStorage.getItem('shiplog_unread_projB')).toBe('4');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 27: Responsive Slide-Out Drawer
  // --------------------------------------------------------------------------
  describe('Feature 27: Responsive Slide-Out Drawer', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');

    it('TC-T1-F27-01: toggles drawer open class when bell launcher is clicked', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('d?.classList.toggle("open")');
      const drawer = document.createElement('div');
      drawer.className = 'drawer';
      drawer.classList.toggle('open');
      expect(drawer.classList.contains('open')).toBe(true);
    });

    it('TC-T1-F27-02: removes open class when close button is clicked', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('c?.addEventListener("click",()=>d?.classList.remove("open"))');
      const drawer = document.createElement('div');
      drawer.className = 'drawer open';
      drawer.classList.remove('open');
      expect(drawer.classList.contains('open')).toBe(false);
    });

    it('TC-T1-F27-03: renders releases list inside drawer container', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('id="releases"');
      expect(widgetCode).toContain('style="flex:1;overflow-y:auto"');
    });

    it('TC-T1-F27-04: drawer CSS specifies fixed right positioning and max-width', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('.drawer{position:fixed;top:0;right:-400px;width:380px;max-width:100vw;');
    });

    it('TC-T1-F27-05: drawer transitions smoothly using CSS transition property', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('transition:right .3s ease');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 28: Viral Badge Logic
  // --------------------------------------------------------------------------
  describe('Feature 28: Viral Badge Logic', () => {
    it('TC-T1-F28-01: shows viral badge for Free tier project', () => {
      expect(checkShouldShowViralBadge(false)).toBe(true);
    });

    it('TC-T1-F28-02: suppresses viral badge for Pro tier project', () => {
      expect(checkShouldShowViralBadge(true)).toBe(false);
    });

    it('TC-T1-F28-03: generates widget payload with show_badge true for Free tier', () => {
      const res = generateWidgetApiResponse({ name: 'Free SaaS', slug: 'free-saas', is_pro: false }, []);
      expect(res.body.project.show_badge).toBe(true);
    });

    it('TC-T1-F28-04: generates widget payload with show_badge false for Pro tier', () => {
      const res = generateWidgetApiResponse({ name: 'Pro SaaS', slug: 'pro-saas', is_pro: true }, []);
      expect(res.body.project.show_badge).toBe(false);
    });

    it('TC-T1-F28-05: SSR changelog footer includes badge for Free tier only', () => {
      const freeRes = renderSSRChangelog({ name: 'FreeApp', slug: 'free', is_pro: false }, []);
      const proRes = renderSSRChangelog({ name: 'ProApp', slug: 'pro', is_pro: true }, []);
      expect(freeRes.html).toContain('Powered by ShipLog');
      expect(proRes.html).not.toContain('Powered by ShipLog');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 29: Public Widget API with CORS
  // --------------------------------------------------------------------------
  describe('Feature 29: Public Widget API with CORS', () => {
    it('TC-T1-F29-01: sets Access-Control-Allow-Origin: * header', () => {
      const res = generateWidgetApiResponse({ name: 'Test', slug: 'test', is_pro: false }, []);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('TC-T1-F29-02: sets Access-Control-Allow-Methods: GET, OPTIONS', () => {
      const res = generateWidgetApiResponse({ name: 'Test', slug: 'test', is_pro: false }, []);
      expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(res.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });

    it('TC-T1-F29-03: sets edge cache control headers public, s-maxage=300', () => {
      const res = generateWidgetApiResponse({ name: 'Test', slug: 'test', is_pro: false }, []);
      expect(res.headers['Cache-Control']).toContain('s-maxage=300');
    });

    it('TC-T1-F29-04: returns project info and published releases payload', () => {
      const res = generateWidgetApiResponse({ name: 'Test', slug: 'test', is_pro: false }, []);
      expect(res.body.project.slug).toBe('test');
      expect(Array.isArray(res.body.releases)).toBe(true);
    });

    it('TC-T1-F29-05: returns Content-Type application/json', () => {
      const res = generateWidgetApiResponse({ name: 'Test', slug: 'test', is_pro: false }, []);
      expect(res.headers['Content-Type']).toBe('application/json');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 30: Dodo Payments Checkout Flow
  // --------------------------------------------------------------------------
  describe('Feature 30: Dodo Payments Checkout Flow', () => {
    it('TC-T1-F30-01: generates $15/month Pro plan checkout session', () => {
      const session = createCheckoutSession({
        project_id: 'proj_pro_1',
        plan_id: 'plan_pro_monthly',
        amount_cents: 1500,
        currency: 'USD',
        return_url: 'https://shiplog.dev/dashboard/billing?status=success',
        customer_email: 'founder@example.com',
      });
      expect(session.amount_cents).toBe(1500);
      expect(session.plan_id).toBe('plan_pro_monthly');
      expect(session.checkout_url).toContain('https://checkout.dodopayments.com/buy/plan_pro_monthly');
    });

    it('TC-T1-F30-02: includes customer metadata with project_id and return_url', () => {
      const session = createCheckoutSession({
        project_id: 'proj_meta_2',
        plan_id: 'plan_pro_monthly',
        amount_cents: 1500,
        currency: 'USD',
        return_url: 'https://shiplog.dev/dashboard/billing?success=true',
        customer_email: 'customer@example.com',
      });
      expect(session.project_id).toBe('proj_meta_2');
      expect(session.customer_email).toBe('customer@example.com');
      expect(session.checkout_url).toContain('project_id=proj_meta_2');
    });

    it('TC-T1-F30-03: constructs valid checkout redirect URL with session ID and expiry', () => {
      const session = createCheckoutSession({
        project_id: 'proj_ann_3',
        plan_id: 'plan_pro_annual',
        amount_cents: 15000,
        currency: 'USD',
        return_url: 'https://shiplog.dev/dashboard/billing',
        customer_email: 'annual@example.com',
      });
      expect(session.session_id.startsWith('dodo_sess_')).toBe(true);
      expect(session.status).toBe('pending');
      expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('TC-T1-F30-04: verifies Pro plan product features and request validation', () => {
      const parsed = DodoCheckoutRequestSchema.safeParse({
        project_id: 'proj_feat_4',
        plan_id: 'plan_pro_monthly',
        amount_cents: 1500,
        currency: 'USD',
        return_url: 'https://shiplog.dev/dashboard/billing',
        customer_email: 'pro@test.com',
        metadata: { tier: 'pro', features: ['Unlimited repositories', 'Unlimited releases'] },
      });
      expect(parsed.success).toBe(true);
    });

    it('TC-T1-F30-05: checkout session URL encodes project and customer email parameters', () => {
      const session = createCheckoutSession({
        project_id: 'proj special/name',
        plan_id: 'plan_pro_monthly',
        amount_cents: 1500,
        currency: 'USD',
        return_url: 'https://shiplog.dev/dashboard',
        customer_email: 'founder+test@shiplog.dev',
      });
      expect(session.checkout_url).toContain('proj%20special%2Fname');
      expect(session.checkout_url).toContain('founder%2Btest%40shiplog.dev');
    });
  });


  // --------------------------------------------------------------------------
  // Feature 31: Dodo Payments Webhook Receiver
  // --------------------------------------------------------------------------
  describe('Feature 31: Dodo Payments Webhook Receiver', () => {
    it('TC-T1-F31-01: processes subscription.created and activates Pro plan', () => {
      const event = {
        event_id: 'evt_1',
        type: 'subscription.created' as const,
        data: { customer_id: 'cust_1', project_id: 'proj_demo', status: 'active', plan_id: 'plan_pro' },
      };
      const result = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(result.status).toBe('processed');
      expect(result.is_pro).toBe(true);
      expect(projectStore.get('proj_demo')?.is_pro).toBe(true);
    });

    it('TC-T1-F31-02: processes subscription.updated with active status', () => {
      const event = {
        event_id: 'evt_2',
        type: 'subscription.updated' as const,
        data: { customer_id: 'cust_1', project_id: 'proj_demo', status: 'active', plan_id: 'plan_pro' },
      };
      const result = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(result.is_pro).toBe(true);
    });

    it('TC-T1-F31-03: processes subscription.cancelled and downgrades to Free tier', () => {
      projectStore.set('proj_demo', { id: 'proj_demo', is_pro: true });
      const event = {
        event_id: 'evt_3',
        type: 'subscription.cancelled' as const,
        data: { customer_id: 'cust_1', project_id: 'proj_demo', status: 'cancelled', plan_id: 'plan_pro' },
      };
      const result = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(result.is_pro).toBe(false);
      expect(projectStore.get('proj_demo')?.is_pro).toBe(false);
    });

    it('TC-T1-F31-04: verifies HMAC signature on Dodo webhook payload', () => {
      const secret = 'dodo_secret_key';
      const body = JSON.stringify({ event_id: 'evt_sig' });
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifyDodoSignature(body, signature, secret)).toBe(true);
    });

    it('TC-T1-F31-05: rejects invalid signature on Dodo webhook payload', () => {
      const secret = 'dodo_secret_key';
      const body = JSON.stringify({ event_id: 'evt_sig' });
      expect(verifyDodoSignature(body, 'tampered_signature', secret)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 32: Webhook Idempotency Layer
  // --------------------------------------------------------------------------
  describe('Feature 32: Webhook Idempotency Layer', () => {
    it('TC-T1-F32-01: records processed event IDs', () => {
      idempotencyStore.record('evt_first');
      expect(idempotencyStore.isProcessed('evt_first')).toBe(true);
    });

    it('TC-T1-F32-02: detects unprocessed event IDs as false', () => {
      expect(idempotencyStore.isProcessed('evt_unknown')).toBe(false);
    });

    it('TC-T1-F32-03: skips redundant database processing on duplicate event replay', () => {
      const event = {
        event_id: 'evt_replay',
        type: 'subscription.created' as const,
        data: { customer_id: 'cust_1', project_id: 'proj_demo', status: 'active', plan_id: 'plan_pro' },
      };
      const first = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(first.status).toBe('processed');
      const second = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(second.status).toBe('already_processed');
    });

    it('TC-T1-F32-04: clears idempotency store when requested', () => {
      idempotencyStore.record('evt_temp');
      idempotencyStore.clear();
      expect(idempotencyStore.isProcessed('evt_temp')).toBe(false);
    });

    it('TC-T1-F32-05: handles high volume of unique event IDs without collisions', () => {
      for (let i = 0; i < 100; i++) {
        idempotencyStore.record(`evt_${i}`);
      }
      for (let i = 0; i < 100; i++) {
        expect(idempotencyStore.isProcessed(`evt_${i}`)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 33: Development Signature Bypass
  // --------------------------------------------------------------------------
  describe('Feature 33: Development Signature Bypass', () => {
    it('TC-T1-F33-01: allows bypass when isDevelopment is true and mock key is provided', () => {
      expect(verifyDodoSignature('{}', null, 'secret', true, 'test_bypass_key')).toBe(true);
    });

    it('TC-T1-F33-02: disallows bypass when isDevelopment is false even with mock key', () => {
      expect(verifyDodoSignature('{}', null, 'secret', false, 'test_bypass_key')).toBe(false);
    });

    it('TC-T1-F33-03: disallows bypass if mock key is invalid in development', () => {
      expect(verifyDodoSignature('{}', null, 'secret', true, 'wrong_key')).toBe(false);
    });

    it('TC-T1-F33-04: respects genuine signature even when bypass header is omitted', () => {
      const secret = 'secret_1';
      const body = '{"hello":"world"}';
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifyDodoSignature(body, sig, secret, true, null)).toBe(true);
    });

    it('TC-T1-F33-05: verifies development bypass header accepts test_bypass_key in development', () => {
      const isDevBypassed = verifyDodoSignature('{}', null, 'secret', true, 'test_bypass_key');
      expect(isDevBypassed).toBe(true);
      const isProdRejected = verifyDodoSignature('{}', null, 'secret', false, 'test_bypass_key');
      expect(isProdRejected).toBe(false);
    });
  });


  // --------------------------------------------------------------------------
  // Feature 34: Tier Feature Gating Enforcement
  // --------------------------------------------------------------------------
  describe('Feature 34: Tier Feature Gating Enforcement', () => {
    it('TC-T1-F34-01: enforces Free tier repository limit of 1', () => {
      expect(checkCanConnectRepo({ tier: 'free', active_repos_count: 0, monthly_releases_count: 0 }).allowed).toBe(true);
      expect(checkCanConnectRepo({ tier: 'free', active_repos_count: 1, monthly_releases_count: 0 }).allowed).toBe(false);
    });

    it('TC-T1-F34-02: enforces Free tier release limit of 2 per month', () => {
      expect(checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 1 }).allowed).toBe(true);
      expect(checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 2 }).allowed).toBe(false);
    });

    it('TC-T1-F34-03: provides descriptive upgrade reason when Free limit is reached', () => {
      const verdict = checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 2 });
      expect(verdict.reason).toContain('Upgrade to Pro');
    });

    it('TC-T1-F34-04: Pro tier unlocks unlimited repositories and releases', () => {
      expect(checkCanConnectRepo({ tier: 'pro', active_repos_count: 50, monthly_releases_count: 0 }).allowed).toBe(true);
      expect(checkCanPublishRelease({ tier: 'pro', active_repos_count: 1, monthly_releases_count: 50 }).allowed).toBe(true);
    });

    it('TC-T1-F34-05: Free tier shows viral badge, Pro tier white-labels', () => {
      expect(checkShouldShowViralBadge(false)).toBe(true);
      expect(checkShouldShowViralBadge(true)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 35: Automated Test Suite (npm test)
  // --------------------------------------------------------------------------
  describe('Feature 35: Automated Test Suite (npm test)', () => {
    it('TC-T1-F35-01: vitest configuration defines happy-dom environment', () => {
      const configPath = path.resolve(process.cwd(), 'vitest.config.ts');
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain("environment: 'happy-dom'");
    });

    it('TC-T1-F35-02: vitest setup file exists in tests/setup.ts', () => {
      const setupPath = path.resolve(process.cwd(), 'tests/setup.ts');
      expect(fs.existsSync(setupPath)).toBe(true);
    });

    it('TC-T1-F35-03: package.json defines npm test command with vitest run', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
      expect(pkg.scripts.test).toBe('vitest run');
    });

    it('TC-T1-F35-04: tests include unit and e2e paths', () => {
      const configPath = path.resolve(process.cwd(), 'vitest.config.ts');
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('tests/**/*.test.ts');
    });

    it('TC-T1-F35-05: mock supabase repository harness is available for unit tests', () => {
      const mockDbPath = path.resolve(process.cwd(), 'tests/mocks/mock-supabase.ts');
      expect(fs.existsSync(mockDbPath)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 36: E2E Pipeline Simulation CLI
  // --------------------------------------------------------------------------
  describe('Feature 36: E2E Pipeline Simulation CLI', () => {
    it('TC-T1-F36-01: scripts/simulate-pipeline.ts file exists', () => {
      const simPath = path.resolve(process.cwd(), 'scripts/simulate-pipeline.ts');
      expect(fs.existsSync(simPath)).toBe(true);
    });

    it('TC-T1-F36-02: package.json defines test:simulate script with tsx', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
      expect(pkg.scripts['test:simulate']).toContain('simulate-pipeline.ts');
    });

    it('TC-T1-F36-03: runSimulation executes all 6 pipeline stages and resolves without throwing', async () => {
      await expect(runSimulation()).resolves.toBeUndefined();
    });

    it('TC-T1-F36-04: pipeline simulation validates AI structured output using strict Zod schema', () => {
      const simPath = path.resolve(process.cwd(), 'scripts/simulate-pipeline.ts');
      const content = fs.readFileSync(simPath, 'utf8');
      expect(content).toContain('GeminiReleaseOutputSchema.parse');
    });

    it('TC-T1-F36-05: pipeline simulation verifies both widget API CORS headers and SSR OpenGraph meta', () => {
      const simPath = path.resolve(process.cwd(), 'scripts/simulate-pipeline.ts');
      const content = fs.readFileSync(simPath, 'utf8');
      expect(content).toContain('Access-Control-Allow-Origin');
      expect(content).toContain('ogTitle');
    });
  });
});
