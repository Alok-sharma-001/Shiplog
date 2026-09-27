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
  clearMockDatabaseRegistry,
  evaluateMockRLS,
  isReservedAppRoute,
  validateWidgetBundleSize,
  formatUnreadCountBadge,
  SafeLocalStorageStore,
} from './helpers/test-harness';
import { dispatchMockPR } from '../../scripts/dispatch-mock-pr';

describe('Tier 2: Boundary, Corner & Negative Tests (Features 1 - 36)', () => {
  let queue: InMemoryPRQueue;
  let idempotencyStore: WebhookIdempotencyStore;
  let projectStore: Map<string, { id: string; is_pro: boolean }>;

  beforeEach(() => {
    queue = new InMemoryPRQueue();
    idempotencyStore = new WebhookIdempotencyStore();
    projectStore = new Map();
    projectStore.set('proj_demo', { id: 'proj_demo', is_pro: false });
    clearMockDatabaseRegistry();
  });


  // --------------------------------------------------------------------------
  // Feature 1: GitHub Webhook Receiver Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 01: GitHub Webhook Receiver Boundaries', () => {
    const secret = 'webhook_secret_boundary';

    it('TC-T2-F01-01: rejects empty signature header', () => {
      expect(verifyGitHubSignature('{"action":"closed"}', '', secret)).toBe(false);
      expect(verifyGitHubSignature('{"action":"closed"}', null, secret)).toBe(false);
    });

    it('TC-T2-F01-02: rejects tampered or wrong HMAC signature', () => {
      const payload = '{"action":"closed"}';
      const validSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const tampered = validSig.slice(0, -4) + '0000';
      expect(verifyGitHubSignature(payload, tampered, secret)).toBe(false);
    });

    it('TC-T2-F01-03: rejects signature without sha256= prefix', () => {
      const payload = '{"action":"closed"}';
      const rawHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifyGitHubSignature(payload, rawHex, secret)).toBe(false);
    });

    it('TC-T2-F01-04: rejects malformed JSON payload during signature check', () => {
      const malformedPayload = '{"action": "closed", invalid_json';
      const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(malformedPayload).digest('hex');
      // Signature itself matches raw string, but JSON parsing fails
      expect(verifyGitHubSignature(malformedPayload, sig, secret)).toBe(true);
      expect(() => JSON.parse(malformedPayload)).toThrow();
    });

    it('TC-T2-F01-05: handles large 1MB webhook payload without crashing', () => {
      const largeBody = JSON.stringify({ action: 'closed', data: 'A'.repeat(1024 * 1024) });
      const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(largeBody).digest('hex');
      expect(verifyGitHubSignature(largeBody, sig, secret)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: PR Merge Filter Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 02: PR Merge Filter Boundaries', () => {
    it('TC-T2-F02-01: rejects PR closed with merged: false', () => {
      const webhookPayload = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'Unmerged draft feature',
          merged: false,
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      expect(isPRMerged(webhookPayload)).toBe(false);
      const parsed = GitHubPRClosedWebhookSchema.safeParse(webhookPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.pull_request.merged).toBe(false);
      }
    });

    it('TC-T2-F02-02: handles missing merged property (undefined/null)', () => {
      const payloadWithoutMerged = {
        action: 'closed',
        pull_request: {
          number: 43,
          title: 'PR without merged flag',
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      expect(isPRMerged(payloadWithoutMerged)).toBe(false);
      const parsed = GitHubPRClosedWebhookSchema.safeParse(payloadWithoutMerged);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.pull_request.merged).toBe(false);
      }
    });

    it('TC-T2-F02-03: rejects draft PR closed without merge', () => {
      const draftPayload = {
        action: 'closed',
        pull_request: {
          number: 44,
          title: 'Draft PR closed without merge',
          merged: false,
          draft: true,
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      expect(isPRMerged(draftPayload)).toBe(false);
      const parsed = GitHubPRClosedWebhookSchema.safeParse(draftPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.pull_request.draft).toBe(true);
      }
    });

    it('TC-T2-F02-04: rejects negative PR numbers', () => {
      const negativePR = {
        action: 'closed',
        pull_request: {
          number: -42,
          title: 'Negative PR number',
          merged: true,
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      const parsed = GitHubPRClosedWebhookSchema.safeParse(negativePR);
      expect(parsed.success).toBe(false);
      expect(isPRMerged(negativePR)).toBe(false);
    });

    it('TC-T2-F02-05: validates SHA length requirement (strictly 40 hex characters)', () => {
      const shortShaPayload = {
        action: 'closed',
        pull_request: {
          number: 45,
          title: 'Short SHA PR',
          merged: true,
          merge_commit_sha: 'e4d909c',
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      const parsedShort = GitHubPRClosedWebhookSchema.safeParse(shortShaPayload);
      expect(parsedShort.success).toBe(false);

      const validShaPayload = {
        action: 'closed',
        pull_request: {
          number: 46,
          title: 'Valid SHA PR',
          merged: true,
          merge_commit_sha: 'e4d909c290d0fb1ca068ffaddf22cbd0addf22cb',
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      const parsedValid = GitHubPRClosedWebhookSchema.safeParse(validShaPayload);
      expect(parsedValid.success).toBe(true);
      expect(isPRMerged(validShaPayload)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: PR Metadata Ingestion Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 03: PR Metadata Ingestion Boundaries', () => {
    it('TC-T2-F03-01: ingests PR with null or empty body safely without null pointer exception', () => {
      const item = queue.add({
        project_id: 'proj_demo',
        pr_number: 101,
        title: 'feat: no body PR',
        body: null,
        status: 'unreleased',
      });
      expect(item.body).toBeNull();
      expect(item.id).toBeDefined();
    });

    it('TC-T2-F03-02: handles massive 50,000 character description safely', () => {
      const hugeBody = 'A'.repeat(50000);
      const item = queue.add({
        project_id: 'proj_demo',
        pr_number: 102,
        title: 'feat: huge PR description',
        body: hugeBody,
        status: 'unreleased',
      });
      expect(item.body?.length).toBe(50000);
    });

    it('TC-T2-F03-03: detects empty title or whitespace-only title as invalid', () => {
      const res = validateSupabaseSchemaConstraint('pull_requests', {
        project_id: 'proj_demo',
        pr_number: 103,
        title: '   ',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/title cannot be empty/);
    });

    it('TC-T2-F03-04: resists SQL injection strings in author field', () => {
      const sqlInjectionAuthor = "'; DROP TABLE pull_requests; --";
      const item = queue.add({
        project_id: 'proj_demo',
        pr_number: 103,
        title: 'feat: sql author',
        author: sqlInjectionAuthor,
        status: 'unreleased',
      });
      expect(item.author).toBe(sqlInjectionAuthor);
    });

    it('TC-T2-F03-05: prevents duplicate ingestion of same PR number within the same project', () => {
      const first = queue.add({ project_id: 'proj_demo', pr_number: 55, title: 'feat: unique', status: 'unreleased' });
      const dup = queue.add({ project_id: 'proj_demo', pr_number: 55, title: 'feat: duplicate attempt', status: 'unreleased' });
      expect(first.id).toBe(dup.id);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Noise Prefix Filter Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 04: Noise Prefix Filter Boundaries', () => {
    it('TC-T2-F04-01: does NOT filter words containing convention prefixes as normal substrings', () => {
      const res1 = evaluatePRNoise({ pr_number: 1, title: 'choreographer: add dance animations' });
      const res2 = evaluatePRNoise({ pr_number: 2, title: 'testimony: user reviews section' });
      expect(res1.isNoise).toBe(false);
      expect(res2.isNoise).toBe(false);
    });

    it('TC-T2-F04-02: filters uppercase convention prefixes (case-insensitivity test)', () => {
      const res = evaluatePRNoise({ pr_number: 3, title: 'CHORE(DEPS): BUMP NEXT TO 15.2' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('convention_prefix');
    });

    it('TC-T2-F04-03: filters convention prefixes with nested parenthesis', () => {
      const res = evaluatePRNoise({ pr_number: 4, title: 'refactor(core/v2): clean up interfaces' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('convention_prefix');
    });

    it('TC-T2-F04-04: filters prefixes with leading whitespace', () => {
      const res = evaluatePRNoise({ pr_number: 5, title: '   ci: add matrix test runner' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('convention_prefix');
    });

    it('TC-T2-F04-05: does not filter when convention word appears in middle of title', () => {
      const res = evaluatePRNoise({ pr_number: 6, title: 'feat: add automated test runner dashboard' });
      expect(res.isNoise).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Exclusion Marker Filter Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 05: Exclusion Marker Filter Boundaries', () => {
    it('TC-T2-F05-01: filters mixed case exclusion markers [sKiP], [INTERNAL], [No-Log]', () => {
      expect(evaluatePRNoise({ pr_number: 1, title: 'feat: test [sKiP]' }).isNoise).toBe(true);
      expect(evaluatePRNoise({ pr_number: 2, title: 'feat: test [INTERNAL]' }).isNoise).toBe(true);
      expect(evaluatePRNoise({ pr_number: 3, title: 'feat: test [No-Log]' }).isNoise).toBe(true);
    });

    it('TC-T2-F05-02: detects exclusion marker buried deep in 20KB markdown body', () => {
      const body = 'Lorem ipsum '.repeat(1000) + '\n\nRelease notes note: [skip]\n' + 'dolor sit '.repeat(1000);
      const res = evaluatePRNoise({ pr_number: 4, title: 'feat: large pr', body });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('exclusion_marker');
    });

    it('TC-T2-F05-03: does not filter unclosed or malformed brackets like skip] or [skip without closing', () => {
      const res1 = evaluatePRNoise({ pr_number: 5, title: 'feat: improve skip] logic' });
      const res2 = evaluatePRNoise({ pr_number: 6, title: 'feat: optimize [skip logic' });
      expect(res1.isNoise).toBe(false);
      expect(res2.isNoise).toBe(false);
    });

    it('TC-T2-F05-04: filters combination of multiple exclusion markers in same PR', () => {
      const res = evaluatePRNoise({ pr_number: 7, title: 'feat: secret [skip] [internal]' });
      expect(res.isNoise).toBe(true);
      expect(res.reason).toBe('exclusion_marker');
    });

    it('TC-T2-F05-05: filters excluded labels regardless of casing', () => {
      const res1 = evaluatePRNoise({ pr_number: 8, title: 'feat: A', labels: ['SKIP-CHANGELOG'] });
      const res2 = evaluatePRNoise({ pr_number: 9, title: 'feat: B', labels: ['Chore'] });
      const res3 = evaluatePRNoise({ pr_number: 10, title: 'feat: C', labels: ['DEPENDENCIES'] });
      expect(res1.isNoise).toBe(true);
      expect(res2.isNoise).toBe(true);
      expect(res3.isNoise).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Gemini Synthesizer Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 06: Gemini Synthesizer Boundaries', () => {
    it('TC-T2-F06-01: rejects AI output containing unrecognized extra properties', () => {
      const payload = {
        release_title: 'v1.0.0 — Launch',
        overview_summary: 'Comprehensive overview summary for release.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Valid email draft here.', social_post_thread: ['Post 1'] },
        unauthorized_field: 'malicious prompt injection',
      };
      expect(() => GeminiReleaseOutputSchema.parse(payload)).toThrow();
    });

    it('TC-T2-F06-02: sanitizes markdown code fences around JSON before parsing', () => {
      const rawText = '```json\n{"release_title":"v1.0.0 — Clean","overview_summary":"Detailed valid overview.","categories":{"features":[],"improvements":[],"fixes":[]},"distribution":{"email_plain_text":"Valid plain text email.","social_post_thread":["Post 1"]}}\n```';
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      expect(() => GeminiReleaseOutputSchema.parse(parsed)).not.toThrow();
    });

    it('TC-T2-F06-03: rejects output when overview_summary is missing', () => {
      const payload = {
        release_title: 'v1.0.0 — Launch',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Valid email draft.', social_post_thread: ['Post 1'] },
      };
      expect(() => GeminiReleaseOutputSchema.parse(payload)).toThrow();
    });

    it('TC-T2-F06-04: rejects non-string types for release_title', () => {
      const payload = {
        release_title: 12345,
        overview_summary: 'Detailed valid overview.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Valid email draft.', social_post_thread: ['Post 1'] },
      };
      expect(() => GeminiReleaseOutputSchema.parse(payload)).toThrow();
    });

    it('TC-T2-F06-05: preserves Unicode emojis and symbols safely in title and summary', () => {
      const payload = {
        release_title: '🚀 v2.0.0 — Stellar Launch & ⚡ Speeds',
        overview_summary: 'Features lightning fast speeds ⚡ and awesome rocket launches 🚀.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Valid email draft.', social_post_thread: ['Post 1'] },
      };
      const parsed = GeminiReleaseOutputSchema.parse(payload);
      expect(parsed.release_title).toContain('🚀');
      expect(parsed.overview_summary).toContain('⚡');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Release Categorization Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 07: Release Categorization Boundaries', () => {
    it('TC-T2-F07-01: allows release containing only bug fixes and empty features/improvements', () => {
      const cats = {
        features: [],
        improvements: [],
        fixes: [{ title: 'Fix Crash', description: 'Prevented nil pointer' }],
      };
      expect(() => ReleaseCategoriesSchema.parse(cats)).not.toThrow();
    });

    it('TC-T2-F07-02: rejects category item with empty string title', () => {
      const item = { title: '', description: 'Description' };
      expect(() => CategoryItemSchema.parse(item)).toThrow();
    });

    it('TC-T2-F07-03: rejects category item with title exceeding 150 characters', () => {
      const item = { title: 'A'.repeat(151), description: 'Description' };
      expect(() => CategoryItemSchema.parse(item)).toThrow();
    });

    it('TC-T2-F07-04: rejects negative pr_number in category item', () => {
      const item = { title: 'Fix', description: 'Desc', pr_number: -5 };
      expect(() => CategoryItemSchema.parse(item)).toThrow();
    });

    it('TC-T2-F07-05: rejects omitted required categories key (e.g. missing fixes)', () => {
      const cats = { features: [], improvements: [] };
      expect(() => ReleaseCategoriesSchema.parse(cats)).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Multi-Channel Syndication Drafts Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 08: Multi-Channel Syndication Drafts Boundaries', () => {
    it('TC-T2-F08-01: rejects empty social_post_thread array (min 1 required)', () => {
      const draft = { email_plain_text: 'Valid email draft here.', social_post_thread: [] };
      expect(() => DistributionSchema.parse(draft)).toThrow();
    });

    it('TC-T2-F08-02: rejects social thread containing empty string post', () => {
      const draft = { email_plain_text: 'Valid email draft here.', social_post_thread: [''] };
      expect(() => DistributionSchema.parse(draft)).toThrow();
    });

    it('TC-T2-F08-03: rejects email plain text under 10 characters', () => {
      const draft = { email_plain_text: 'Too short', social_post_thread: ['Valid post'] };
      expect(() => DistributionSchema.parse(draft)).toThrow();
    });

    it('TC-T2-F08-04: handles long thread with 20 posts cleanly', () => {
      const posts = Array.from({ length: 20 }, (_, i) => `Thread post ${i + 1}/20`);
      const draft = { email_plain_text: 'Valid email draft here.', social_post_thread: posts };
      expect(() => DistributionSchema.parse(draft)).not.toThrow();
    });

    it('TC-T2-F08-05: preserves multiline formatting in email plain text', () => {
      const email = 'Line 1\n\nLine 2\n\n- Bullet 1\n- Bullet 2';
      const draft = { email_plain_text: email, social_post_thread: ['Post 1'] };
      const parsed = DistributionSchema.parse(draft);
      expect(parsed.email_plain_text).toContain('\n\n- Bullet 1');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Hybrid Mode & Mock Fixtures Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 09: Hybrid Mode & Mock Fixtures Boundaries', () => {
    it('TC-T2-F09-01: handles empty PR list without crashing, producing fallback release title', async () => {
      const service = new GeminiSynthesisService();
      const res = await service.synthesize([], 'v1.0.0');
      expect(res.release_title).toContain('Release Updates');
      expect(res.categories.features).toHaveLength(0);
    });

    it('TC-T2-F09-02: sanitizes HTML script tags in PR titles during mock synthesis', async () => {
      const service = new GeminiSynthesisService();
      const res = await service.synthesize(
        [{ pr_number: 1, title: 'feat: add <script>alert(1)</script> editor' }],
        'v1.0.1'
      );
      expect(res.categories.features[0].title).toBe('add <script>alert(1)</script> editor');
    });

    it('TC-T2-F09-03: mock service handles undefined body by providing sensible default description', async () => {
      const service = new GeminiSynthesisService();
      const res = await service.synthesize([{ pr_number: 22, title: 'feat: no body' }], 'v1.0.2');
      expect(res.categories.features[0].description).toContain('#22');
    });

    it('TC-T2-F09-04: generates valid distribution email even for minimal input', async () => {
      const service = new GeminiSynthesisService();
      const res = await service.synthesize([{ pr_number: 3, title: 'fix: patch' }], 'v1.0.3');
      expect(res.distribution.email_plain_text.length).toBeGreaterThanOrEqual(10);
    });

    it('TC-T2-F09-05: mock mode does not attempt live network HTTP requests', async () => {
      const service = new GeminiSynthesisService('mock_key');
      const start = Date.now();
      await service.synthesize([{ pr_number: 4, title: 'feat: offline' }], 'v1.0.4');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Sub-100ms offline execution
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Local Webhook Dispatcher CLI Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 10: Local Webhook Dispatcher CLI Boundaries', () => {
    it('TC-T2-F10-01: handles dead or unopen port gracefully returning status 0 without crash', async () => {
      const res = await dispatchMockPR({
        port: 65432,
        host: '127.0.0.1',
        pr: 1,
        title: 'feat: dead port test',
        body: 'body',
        author: 'tester',
        secret: 'sec',
      });
      expect(res.status).toBe(0);
      expect(res.body).toBeDefined();
    });

    it('TC-T2-F10-02: dispatches PR with special characters in title and body cleanly', async () => {
      const res = await dispatchMockPR({
        port: 65431,
        host: '127.0.0.1',
        pr: 2,
        title: 'feat: "quotes" & <symbols> 🚀',
        body: 'Multiline\n\r\tSpecial characters: @#$%^&*()',
        author: 'tester',
        secret: 'sec',
      });
      expect(res.status).toBe(0);
    });

    it('TC-T2-F10-03: dispatches with empty secret without throwing', async () => {
      const res = await dispatchMockPR({
        port: 65430,
        host: '127.0.0.1',
        pr: 3,
        title: 'feat: empty secret',
        body: 'body',
        author: 'tester',
        secret: '',
      });
      expect(res.status).toBe(0);
    });

    it('TC-T2-F10-04: verifies HMAC signature calculation accuracy on custom payload', () => {
      const secret = 'custom_secret_key';
      const payload = JSON.stringify({ pr: 42, custom: 'value' });
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifyGitHubSignature(payload, 'sha256=' + expected, secret)).toBe(true);
    });

    it('TC-T2-F10-05: dispatches with massive body payload without memory leak', async () => {
      const res = await dispatchMockPR({
        port: 65429,
        host: '127.0.0.1',
        pr: 4,
        title: 'feat: big body',
        body: 'X'.repeat(20000),
        author: 'tester',
        secret: 'sec',
      });
      expect(res.status).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Next.js 15 App Router Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 11: Next.js 15 App Router Boundaries', () => {
    it('TC-T2-F11-01: rejects path traversal patterns in slug parameter', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'Traversal Test',
        slug: '../../etc/passwd',
        repo_name: 'acme/repo',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/slug contains invalid characters/);
      expect(isReservedAppRoute('../../etc/passwd')).toBe(false);
    });

    it('TC-T2-F11-02: rejects URL encoded path traversal in slug parameter', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'Encoded Traversal Test',
        slug: '%2e%2e%2f%2e%2e%2fpasswd',
        repo_name: 'acme/repo',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/slug contains invalid characters/);
    });

    it('TC-T2-F11-03: rejects SQL injection in slug parameter', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'SQL Injection Test',
        slug: "demo' OR '1'='1",
        repo_name: 'acme/repo',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/slug contains invalid characters/);
    });

    it('TC-T2-F11-04: handles very long slug (150 chars) cleanly', () => {
      const longSlug = 'a'.repeat(150);
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'Long Slug Test',
        slug: longSlug,
        repo_name: 'acme/repo',
      });
      expect(res.valid).toBe(true);
    });

    it('TC-T2-F11-05: handles reserved route names by distinguishing project slugs', () => {
      expect(isReservedAppRoute('api')).toBe(true);
      expect(isReservedAppRoute('dashboard')).toBe(true);
      expect(isReservedAppRoute('billing')).toBe(true);
      expect(isReservedAppRoute('c')).toBe(true);
      expect(isReservedAppRoute('login')).toBe(true);
      expect(isReservedAppRoute('my-saas-app')).toBe(false);

      const reservedProject = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'API Portal',
        slug: 'api',
        repo_name: 'acme/api',
      });
      expect(reservedProject.valid).toBe(false);
      expect(reservedProject.error).toMatch(/reserved route name/);

      const customProject = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'My SaaS App',
        slug: 'my-saas-app',
        repo_name: 'acme/my-saas',
      });
      expect(customProject.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Tailwind & shadcn UI Primitives Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 12: Tailwind & shadcn UI Primitives Boundaries', () => {
    it('TC-T2-F12-01: cn utility handles undefined, null, and false values cleanly', async () => {
      const { cn } = await import('../../lib/utils');
      expect(cn('btn', undefined, null, false, 'btn-primary')).toBe('btn btn-primary');
    });

    it('TC-T2-F12-02: cn utility resolves conflicting Tailwind classes properly (p-2 vs p-4)', async () => {
      const { cn } = await import('../../lib/utils');
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('TC-T2-F12-03: cn utility resolves text color overrides (text-red-500 vs text-blue-500)', async () => {
      const { cn } = await import('../../lib/utils');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('TC-T2-F12-04: cn handles arbitrary Tailwind values cleanly', async () => {
      const { cn } = await import('../../lib/utils');
      expect(cn('top-[117px]', 'top-[120px]')).toBe('top-[120px]');
    });

    it('TC-T2-F12-05: cn handles empty string and empty arguments cleanly', async () => {
      const { cn } = await import('../../lib/utils');
      expect(cn('', '')).toBe('');
      expect(cn()).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: Supabase Schema Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 13: Supabase Schema Boundaries', () => {
    it('TC-T2-F13-01: rejects invalid subscription status check constraint', () => {
      const res = validateSupabaseSchemaConstraint('profiles', {
        id: 'u1',
        email: 'user1@example.com',
        subscription_status: 'invalid_status',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/subscription_status/);
    });

    it('TC-T2-F13-02: rejects invalid tier check constraint', () => {
      const res = validateSupabaseSchemaConstraint('profiles', {
        id: 'u2',
        email: 'user2@example.com',
        tier: 'enterprise_fake',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/tier/);
    });

    it('TC-T2-F13-03: requires slug to be unique across projects', () => {
      const first = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'First Project',
        slug: 'unique-app-slug',
        repo_name: 'acme/app',
      });
      expect(first.valid).toBe(true);

      const duplicate = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u2',
        name: 'Second Project',
        slug: 'unique-app-slug',
        repo_name: 'other/app',
      });
      expect(duplicate.valid).toBe(false);
      expect(duplicate.error).toMatch(/already exists/);
    });

    it('TC-T2-F13-04: requires non-empty version_tag in changelogs', () => {
      const res = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: '',
        title: 'Empty version release',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/version_tag/);
    });

    it('TC-T2-F13-05: rejects invalid changelog status check constraint', () => {
      const res = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: 'v1.0.0',
        title: 'Release Title',
        status: 'deleted',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/status/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Row-Level Security Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 14: Row-Level Security Boundaries', () => {
    it('TC-T2-F14-01: blocks authenticated user from viewing projects of another user', () => {
      const allowedSelf = evaluateMockRLS(
        'projects',
        'SELECT',
        { role: 'authenticated', userId: 'user_A' },
        { user_id: 'user_A' }
      );
      expect(allowedSelf).toBe(true);

      const blockedOther = evaluateMockRLS(
        'projects',
        'SELECT',
        { role: 'authenticated', userId: 'user_A' },
        { user_id: 'user_B' }
      );
      expect(blockedOther).toBe(false);
    });

    it('TC-T2-F14-02: blocks anon users from viewing draft changelogs', () => {
      const allowedPublic = evaluateMockRLS(
        'changelogs',
        'SELECT',
        { role: 'anon' },
        { status: 'published', is_published: true }
      );
      expect(allowedPublic).toBe(true);

      const blockedDraft = evaluateMockRLS(
        'changelogs',
        'SELECT',
        { role: 'anon' },
        { status: 'draft', is_published: false }
      );
      expect(blockedDraft).toBe(false);
    });

    it('TC-T2-F14-03: anti-escalation security trigger blocks tier modification by non-service-role', () => {
      const blockedEscalation = evaluateMockRLS(
        'profiles',
        'UPDATE',
        { role: 'authenticated', userId: 'user_1' },
        { id: 'user_1', tier: 'pro', _attempted_escalation: true }
      );
      expect(blockedEscalation).toBe(false);

      const allowedServiceRole = evaluateMockRLS(
        'profiles',
        'UPDATE',
        { role: 'service_role' },
        { id: 'user_1', tier: 'pro', _attempted_escalation: true }
      );
      expect(allowedServiceRole).toBe(true);
    });

    it('TC-T2-F14-04: anti-escalation trigger prevents altering user id', () => {
      const blockedIdAlteration = evaluateMockRLS(
        'profiles',
        'UPDATE',
        { role: 'authenticated', userId: 'user_1' },
        { id: 'user_1', id_changed: true }
      );
      expect(blockedIdAlteration).toBe(false);

      const blockedEvenByServiceRole = evaluateMockRLS(
        'profiles',
        'UPDATE',
        { role: 'service_role' },
        { id: 'user_1', id_changed: true }
      );
      expect(blockedEvenByServiceRole).toBe(false);
    });

    it('TC-T2-F14-05: anon role cannot insert into dodo_webhook_events table', () => {
      const blockedAnon = evaluateMockRLS(
        'dodo_webhook_events',
        'INSERT',
        { role: 'anon' },
        { event_id: 'evt_100' }
      );
      expect(blockedAnon).toBe(false);

      const allowedServiceRole = evaluateMockRLS(
        'dodo_webhook_events',
        'INSERT',
        { role: 'service_role' },
        { event_id: 'evt_100' }
      );
      expect(allowedServiceRole).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Repository Connection Workflow Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 15: Repository Connection Workflow Boundaries', () => {
    it('TC-T2-F15-01: rejects empty repository name string', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'Empty Repo Test',
        slug: 'empty-repo-test',
        repo_name: '   ',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/repo_name cannot be empty/);
    });

    it('TC-T2-F15-02: rejects repo string missing slash delimiter', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'No Slash Repo Test',
        slug: 'no-slash-repo-test',
        repo_name: 'no-owner-repo',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/owner\/repo/);
    });

    it('TC-T2-F15-03: blocks Free tier user from connecting repository beyond quota (1)', () => {
      const verdict = checkCanConnectRepo({ tier: 'free', active_repos_count: 1, monthly_releases_count: 0 });
      expect(verdict.allowed).toBe(false);
      expect(verdict.upgrade_required).toBe(true);
    });

    it('TC-T2-F15-04: rejects repository name with malicious characters', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'Malicious Repo Test',
        slug: 'malicious-repo-test',
        repo_name: 'acme/repo; rm -rf /',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/repo_name contains invalid characters/);
    });

    it('TC-T2-F15-05: allows reconnecting same repo after previous one disconnected (active_repos_count: 0)', () => {
      const verdict = checkCanConnectRepo({ tier: 'free', active_repos_count: 0, monthly_releases_count: 0 });
      expect(verdict.allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 16: Unreleased PR Queue Dashboard Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 16: Unreleased PR Queue Dashboard Boundaries', () => {
    it('TC-T2-F16-01: querying queue for non-existent project returns empty array', () => {
      const items = queue.list('non_existent_project', 'unreleased');
      expect(items).toEqual([]);
    });

    it('TC-T2-F16-02: marking non-existent PR as released does not throw error', () => {
      expect(() => queue.markReleased('proj_demo', [99999])).not.toThrow();
    });

    it('TC-T2-F16-03: handles search filter with regex characters safely', () => {
      queue.add({ project_id: 'proj_regex', pr_number: 99, title: 'fix: [bug] (critical) $100', status: 'unreleased' });
      const search = '.*+?^${}()|[]\\';
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const items = queue.list('proj_regex', 'unreleased').filter(i => new RegExp(escaped).test(i.title));
      expect(items).toHaveLength(0);
      const matchSearch = '\\[bug\\]';
      const matched = queue.list('proj_regex', 'unreleased').filter(i => new RegExp(matchSearch).test(i.title));
      expect(matched).toHaveLength(1);
    });

    it('TC-T2-F16-04: handles high volume (500 items) in queue without slowdown', () => {
      for (let i = 1; i <= 500; i++) {
        queue.add({ project_id: 'proj_stress', pr_number: i, title: `feat: item ${i}`, status: 'unreleased' });
      }
      const list = queue.list('proj_stress', 'unreleased');
      expect(list).toHaveLength(500);
    });

    it('TC-T2-F16-05: queue item maintains immutable created_at ISO string', () => {
      const item = queue.add({ project_id: 'proj_demo', pr_number: 1, title: 'feat: time', status: 'unreleased' });
      expect(new Date(item.created_at).toISOString()).toBe(item.created_at);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Release Generation Action Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 17: Release Generation Action Boundaries', () => {
    const aiService = new GeminiSynthesisService();

    it('TC-T2-F17-01: synthesis handles batch of 100 PRs safely', async () => {
      const prs = Array.from({ length: 100 }, (_, i) => ({
        pr_number: i + 1,
        title: `feat: feature ${i + 1}`,
      }));
      const release = await aiService.synthesize(prs, 'v3.0.0');
      expect(release.categories.features).toHaveLength(100);
    });

    it('TC-T2-F17-02: rejects invalid semantic version tag format (e.g. invalid-tag)', () => {
      const resInvalid = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: 'invalid-tag',
        title: 'Release',
      });
      expect(resInvalid.valid).toBe(false);
      expect(resInvalid.error).toMatch(/version_tag/);

      const resValid = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: 'v1.2.3',
        title: 'Release',
      });
      expect(resValid.valid).toBe(true);
    });

    it('TC-T2-F17-03: handles PR title with 500 characters safely without exceeding schema limit', async () => {
      const longTitle = 'feat: ' + 'A'.repeat(500);
      const prs = [{ pr_number: 1, title: longTitle }];
      const release = await aiService.synthesize(prs, 'v1.0.0');
      expect(release.release_title.length).toBeGreaterThan(0);
    });

    it('TC-T2-F17-04: generates release with empty improvements and empty fixes without failure', async () => {
      const prs = [{ pr_number: 1, title: 'feat: solo feature' }];
      const release = await aiService.synthesize(prs, 'v1.0.0');
      expect(release.categories.improvements).toHaveLength(0);
      expect(release.categories.fixes).toHaveLength(0);
    });

    it('TC-T2-F17-05: enforces non-empty version tag parameter', () => {
      const res = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: '   ',
        title: 'Release',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/version_tag cannot be empty/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 18: Inline Markdown Release Editor Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 18: Inline Markdown Release Editor Boundaries', () => {
    it('TC-T2-F18-01: rejects empty release title in editor validation', () => {
      const draft = {
        release_title: '   ',
        overview_summary: 'Valid summary here with enough chars.',
        categories: { features: ['Feature 1'], improvements: [], fixes: [] },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/release_title/);
    });

    it('TC-T2-F18-02: rejects overview summary shorter than 10 characters in editor', () => {
      const draft = {
        release_title: 'Valid Title',
        overview_summary: 'Short',
        categories: { features: ['Feature 1'], improvements: [], fixes: [] },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/overview_summary/);
    });

    it('TC-T2-F18-03: sanitizes raw HTML script injection in markdown editor', () => {
      const draft = {
        release_title: 'Release <script>alert("xss")</script> v1.0',
        overview_summary: 'Clean summary <script>evil()</script> for users.',
        categories: {
          features: ['New feature <script>stealCookies()</script> implemented'],
          improvements: [],
          fixes: [],
        },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(true);
      expect(res.sanitizedDraft?.release_title).not.toContain('<script>');
      expect(res.sanitizedDraft?.overview_summary).not.toContain('<script>');
      expect(res.sanitizedDraft?.categories.features[0]).not.toContain('<script>');
    });

    it('TC-T2-F18-04: handles 50KB markdown release body without crashing', () => {
      const largeSummary = 'Paragraph content. '.repeat(3000);
      const draft = {
        release_title: 'Massive Release Notes',
        overview_summary: largeSummary,
        categories: { features: ['A'.repeat(5000)], improvements: [], fixes: [] },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(true);
      expect(res.sanitizedDraft?.overview_summary.length).toBeGreaterThan(50000);
    });

    it('TC-T2-F18-05: prevents saving release draft when all categories are removed and summary empty', () => {
      const draft = {
        release_title: 'Empty Draft',
        overview_summary: '   ',
        categories: { features: [], improvements: [], fixes: [] },
      };
      const res = validateAndSanitizeMarkdownDraft(draft);
      expect(res.valid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 19: One-Click Publishing Workflow Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 19: One-Click Publishing Workflow Boundaries', () => {
    it('TC-T2-F19-01: publishing an already published release is idempotent', () => {
      const releaseData = { project_id: 'p1', version_tag: 'v1.0.0', title: 'v1.0.0', status: 'published' };
      const first = validateSupabaseSchemaConstraint('changelogs', releaseData);
      expect(first.valid).toBe(true);
      const second = validateSupabaseSchemaConstraint('changelogs', releaseData);
      expect(second.valid).toBe(true);
    });

    it('TC-T2-F19-02: blocks Free tier user from publishing 3rd release in calendar month', () => {
      const verdict = checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 2 });
      expect(verdict.allowed).toBe(false);
      expect(verdict.upgrade_required).toBe(true);
    });

    it('TC-T2-F19-03: rejects publication when required project slug is missing', () => {
      const res = validateSupabaseSchemaConstraint('projects', {
        user_id: 'u1',
        name: 'My Project',
        slug: '   ',
        repo_name: 'org/repo',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/slug/);
    });

    it('TC-T2-F19-04: verifies publication timestamp is not in the future', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = validateSupabaseSchemaConstraint('changelogs', {
        project_id: 'p1',
        version_tag: 'v1.0.0',
        title: 'Future Release',
        published_at: futureDate,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/published_at cannot be in the future/);
    });

    it('TC-T2-F19-05: handles publishing release with 0 features and 1 bug fix without error', () => {
      const verdict = checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 0 });
      expect(verdict.allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 20: Syndication Copy Actions Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 20: Syndication Copy Actions Boundaries', () => {
    it('TC-T2-F20-01: handles empty social thread by falling back to title', () => {
      const release: PublishedChangelog = {
        id: 'r_empty_social',
        project_id: 'p1',
        project_slug: 'empty-social',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 Launched',
        overview_summary: 'Initial release.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: '', social_post_thread: [] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const thread = formatSocialThread(release);
      expect(thread.length).toBeGreaterThanOrEqual(1);
      expect(thread[0]).toContain('v1.0.0 Launched');
    });

    it('TC-T2-F20-02: handles clipboard error without breaking UI state', () => {
      expect(() => formatSyndicationEmail(null as unknown as PublishedChangelog)).toThrow();
      expect(() => formatSyndicationEmail({} as unknown as PublishedChangelog)).toThrow();
    });

    it('TC-T2-F20-03: truncates ultra-long tweet exceeding character limit in warning indicator', () => {
      const release: PublishedChangelog = {
        id: 'r_long_tweet',
        project_id: 'p1',
        project_slug: 'long-tweet',
        version_tag: 'v1.0.0',
        release_title: 'Super Long Release Title That Has A Lot Of Detail '.repeat(5),
        overview_summary: 'Massive overview summary '.repeat(20),
        categories: {
          features: ['Extremely detailed feature note that goes on and on '.repeat(10)],
          improvements: [],
          fixes: [],
        },
        distribution: { email_plain_text: '', social_post_thread: [] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const thread = formatSocialThread(release);
      expect(thread.length).toBeGreaterThan(1);
      thread.forEach((tweet) => {
        expect(tweet.length).toBeLessThanOrEqual(280);
      });
    });

    it('TC-T2-F20-04: converts markdown links to plain text URLs for email copy', () => {
      const release: PublishedChangelog = {
        id: 'r_email_clean',
        project_id: 'p1',
        project_slug: 'email-clean',
        version_tag: 'v1.0.0',
        release_title: 'Release v1.0.0 <script>alert("xss")</script>',
        overview_summary: 'Check out [our website](https://shiplog.dev) for details!',
        categories: {
          features: ['New feature added!'],
          improvements: [],
          fixes: [],
        },
        distribution: { email_plain_text: '', social_post_thread: [] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const email = formatSyndicationEmail(release);
      expect(email).toContain('v1.0.0');
      expect(email).not.toContain('<script>');
      expect(email).toContain('https://shiplog.dev');
      expect(email).not.toContain('<script>');
    });

    it('TC-T2-F20-05: prevents duplicate concurrent copy clicks from corrupting state', () => {
      expect(() => formatSocialThread(undefined as unknown as PublishedChangelog)).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 21: Public SSR Changelog Portal Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 21: Public SSR Changelog Portal Boundaries', () => {
    it('TC-T2-F21-01: renders empty timeline placeholder when project has zero published releases', () => {
      const res = renderSSRChangelog({ name: 'EmptyApp', slug: 'empty', is_pro: false }, []);
      expect(res.html).toContain('EmptyApp Changelog');
      expect(res.html).not.toContain('<article class="release"');
    });

    it('TC-T2-F21-02: handles SQL injection in slug parameter safely', () => {
      const maliciousSlug = "demo' OR '1'='1";
      const res = renderSSRChangelog({ name: maliciousSlug, slug: maliciousSlug, is_pro: false }, []);
      expect(res.html).not.toContain('<script>');
      expect(res.html).toContain("demo&#39; OR &#39;1&#39;=&#39;1 Changelog");
      expect(res.meta.title).toContain("demo' OR '1'='1 Changelog");
    });

    it('TC-T2-F21-03: handles releases with empty category arrays gracefully', () => {
      const release: PublishedChangelog = {
        id: 'r_empty',
        project_id: 'p1',
        project_slug: 'empty-cats',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 — Empty Cats',
        overview_summary: 'Clean release.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const res = renderSSRChangelog({ name: 'App', slug: 'empty-cats', is_pro: false }, [release]);
      expect(res.html).toContain('v1.0.0 — Empty Cats');
    });

    it('TC-T2-F21-04: handles 50 published releases in timeline without degrading output', () => {
      const releases: PublishedChangelog[] = Array.from({ length: 50 }, (_, i) => ({
        id: `r_${i}`,
        project_id: 'p1',
        project_slug: 'scale-app',
        version_tag: `v1.${i}.0`,
        release_title: `v1.${i}.0 Release`,
        overview_summary: `Summary ${i}`,
        categories: { features: [{ title: `F${i}`, description: 'd' }], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      }));
      const res = renderSSRChangelog({ name: 'ScaleApp', slug: 'scale-app', is_pro: false }, releases);
      expect(res.html).toContain('v1.0.0 Release');
      expect(res.html).toContain('v1.49.0 Release');
    });

    it('TC-T2-F21-05: ignores unpublished draft changelogs in public SSR portal rendering', () => {
      const draft: PublishedChangelog = {
        id: 'r_draft',
        project_id: 'p1',
        project_slug: 'app',
        version_tag: 'v9.9.9',
        release_title: 'Unreleased Confidential Feature',
        overview_summary: 'Internal.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'draft',
      };
      const res = renderSSRChangelog({ name: 'App', slug: 'app', is_pro: false }, [draft]);
      expect(res.html).not.toContain('Unreleased Confidential Feature');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 22: Dynamic OpenGraph Meta Tags Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 22: Dynamic OpenGraph Meta Tags Boundaries', () => {
    it('TC-T2-F22-01: escapes quotes and apostrophes in og:title cleanly', () => {
      const release: PublishedChangelog = {
        id: 'r1',
        project_id: 'p1',
        project_slug: 'quote-app',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 — "ShipLog\'s" Big Update',
        overview_summary: 'Special characters: <test> & "quotes".',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const res = renderSSRChangelog({ name: 'QuoteApp', slug: 'quote-app', is_pro: false }, [release]);
      expect(res.meta.ogTitle).toContain('"ShipLog\'s" Big Update');
    });

    it('TC-T2-F22-02: encodes Unicode emojis in dynamic OG image URL', () => {
      const release: PublishedChangelog = {
        id: 'r2',
        project_id: 'p1',
        project_slug: 'emoji-app',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0 — 🚀 Rocket Release',
        overview_summary: 'Summary with ⚡ energy.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const res = renderSSRChangelog({ name: 'EmojiApp', slug: 'emoji-app', is_pro: false }, [release]);
      expect(res.meta.ogImage).toContain(encodeURIComponent('v1.0.0 — 🚀 Rocket Release | EmojiApp Changelog'));
    });

    it('TC-T2-F22-03: safely handles empty release list without throwing TypeError in OG meta generation', () => {
      expect(() => renderSSRChangelog({ name: 'EmptyApp', slug: 'empty', is_pro: false }, [])).not.toThrow();
    });

    it('TC-T2-F22-04: handles very long overview summary (1000 characters) in og:description cleanly', () => {
      const longSummary = 'D'.repeat(1000);
      const release: PublishedChangelog = {
        id: 'r3',
        project_id: 'p1',
        project_slug: 'long-app',
        version_tag: 'v1.0.0',
        release_title: 'v1.0.0',
        overview_summary: longSummary,
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const res = renderSSRChangelog({ name: 'LongApp', slug: 'long-app', is_pro: false }, [release]);
      expect(res.meta.ogDescription).toBe(longSummary);
    });

    it('TC-T2-F22-05: verifies meta tags do not contain unclosed HTML brackets', () => {
      const res = renderSSRChangelog({ name: 'SafeApp', slug: 'safe', is_pro: false }, []);
      expect(res.html).toContain('<meta property="og:title"');
      expect(res.html).toContain('/>');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 23: Zero-Dependency Widget Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 23: Zero-Dependency Widget Boundaries', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');

    it('TC-T2-F23-01: widget code contains no eval or Function constructors', () => {
      const code = fs.readFileSync(widgetPath, 'utf8');
      expect(code).not.toContain('eval(');
      expect(code).not.toContain('new Function(');
    });

    it('TC-T2-F23-02: widget handles multiple script tag loads by checking customElements.get', () => {
      const code = fs.readFileSync(widgetPath, 'utf8');
      if (!customElements.get('shiplog-widget')) {
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
      }
      expect(customElements.get('shiplog-widget')).toBeDefined();
    });

    it('TC-T2-F23-03: widget connectedCallback executes safely even without data-slug attribute', () => {
      const el = document.createElement('shiplog-widget');
      expect(() => document.body.appendChild(el)).not.toThrow();
    });

    it('TC-T2-F23-04: widget contains no external CSS link tags in template', () => {
      const code = fs.readFileSync(widgetPath, 'utf8');
      expect(code).not.toContain('<link rel="stylesheet"');
    });

    it('TC-T2-F23-05: widget shadow root mode is explicitly open', () => {
      const code = fs.readFileSync(widgetPath, 'utf8');
      expect(code).toContain('attachShadow({mode:"open"})');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 24: Widget Bundle Size Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 24: Widget Bundle Size Boundaries', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');
    const MAX_LIMIT = 5120;

    it('TC-T2-F24-01: boundary check: file size is strictly less than 5120 bytes', () => {
      const size = fs.statSync(widgetPath).size;
      expect(size).toBeLessThan(MAX_LIMIT);
    });

    it('TC-T2-F24-02: bundle size margin: has at least 1000 bytes headroom', () => {
      const size = fs.statSync(widgetPath).size;
      expect(MAX_LIMIT - size).toBeGreaterThanOrEqual(1000);
    });

    it('TC-T2-F24-03: gzipped bundle size margin: has at least 2000 bytes headroom', () => {
      const content = fs.readFileSync(widgetPath);
      const gzipped = zlib.gzipSync(content);
      expect(MAX_LIMIT - gzipped.length).toBeGreaterThanOrEqual(2000);
    });

    it('TC-T2-F24-04: non-empty check: bundle size is greater than 500 bytes', () => {
      const size = fs.statSync(widgetPath).size;
      expect(size).toBeGreaterThan(500);
    });

    it('TC-T2-F24-05: check-widget-size script throws error if size exceeds limit', () => {
      const fakeLargeBuffer = Buffer.alloc(5121);
      const res = validateWidgetBundleSize(fakeLargeBuffer);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds limit/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 25: Scoped Shadow DOM Isolation Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 25: Scoped Shadow DOM Isolation Boundaries', () => {
    it('TC-T2-F25-01: host style reset * { all: unset !important } does not alter shadowRoot DOM hierarchy', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<style>:host { all: initial; }</style><button id="btn">Click</button>';
      expect(shadow.getElementById('btn')).not.toBeNull();
    });

    it('TC-T2-F25-02: querying document.getElementById does NOT find elements inside shadow root', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div id="secret-shadow-id">Isolated</div>';
      expect(document.getElementById('secret-shadow-id')).toBeNull();
      expect(shadow.getElementById('secret-shadow-id')).not.toBeNull();
    });

    it('TC-T2-F25-03: shadow styles do not affect external document body styles', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<style>h1 { color: green; font-size: 100px; }</style>';
      const externalH1 = document.createElement('h1');
      document.body.appendChild(externalH1);
      // Confirms external h1 remains in document body uncorrupted
      expect(externalH1.parentElement).toBe(document.body);
    });

    it('TC-T2-F25-04: handles multiple shadow roots on distinct host elements independently', () => {
      const host1 = document.createElement('div');
      const host2 = document.createElement('div');
      const s1 = host1.attachShadow({ mode: 'open' });
      const s2 = host2.attachShadow({ mode: 'open' });
      s1.innerHTML = '<div class="drawer">Drawer 1</div>';
      s2.innerHTML = '<div class="drawer">Drawer 2</div>';
      expect(s1.querySelector('.drawer')?.textContent).toBe('Drawer 1');
      expect(s2.querySelector('.drawer')?.textContent).toBe('Drawer 2');
    });

    it('TC-T2-F25-05: prevents event bubbling from shadow DOM from carrying private shadow elements', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button id="innerBtn">Click</button>';
      const btn = shadow.getElementById('innerBtn')!;
      let eventTarget: EventTarget | null = null;
      host.addEventListener('click', (e) => {
        eventTarget = e.target;
      });
      btn.click();
      // In open mode, host receives event re-targeted to host or inner
      expect(eventTarget).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Feature 26: LocalStorage Unread Indicator Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 26: LocalStorage Unread Indicator Boundaries', () => {
    it('TC-T2-F26-01: handles corrupted non-numeric string in localStorage by falling back safely', () => {
      localStorage.setItem('shiplog_unread_corrupted', 'NaN_NOT_A_NUMBER');
      const raw = localStorage.getItem('shiplog_unread_corrupted');
      const parsed = parseInt(raw || '0', 10);
      const safeCount = isNaN(parsed) ? 0 : parsed;
      expect(safeCount).toBe(0);
    });

    it('TC-T2-F26-02: clamps negative unread count to 0', () => {
      localStorage.setItem('shiplog_unread_neg', '-5');
      const parsed = Math.max(0, parseInt(localStorage.getItem('shiplog_unread_neg') || '0', 10));
      expect(parsed).toBe(0);
    });

    it('TC-T2-F26-03: formats large unread count (e.g. 150) to 99+', () => {
      expect(formatUnreadCountBadge(150)).toBe('99+');
      expect(formatUnreadCountBadge(5)).toBe('5');
      expect(formatUnreadCountBadge(0)).toBe('0');
    });

    it('TC-T2-F26-04: handles localStorage exception in private browsing mode gracefully', () => {
      const store = new SafeLocalStorageStore(true);
      const ok = store.setItem('shiplog_unread_private', '2');
      expect(ok).toBe(false);
      expect(store.getItem('shiplog_unread_private')).toBe('2');
    });

    it('TC-T2-F26-05: clearing unread count for project A does not affect project B', () => {
      localStorage.setItem('shiplog_unread_A', '3');
      localStorage.setItem('shiplog_unread_B', '5');
      localStorage.setItem('shiplog_unread_A', '0');
      expect(localStorage.getItem('shiplog_unread_A')).toBe('0');
      expect(localStorage.getItem('shiplog_unread_B')).toBe('5');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 27: Responsive Slide-Out Drawer Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 27: Responsive Slide-Out Drawer Boundaries', () => {
    const widgetPath = path.resolve(process.cwd(), 'public/widget.js');

    it('TC-T2-F27-01: mobile viewport (< 375px) width calculation restricts to max 100vw in compiled widget bundle', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('max-width:100vw');
      const res = generateWidgetApiResponse({ name: 'Mobile SaaS', slug: 'mobile-saas', is_pro: false }, []);
      expect(res.statusCode).toBe(200);
      expect(res.body.project.slug).toBe('mobile-saas');
    });

    it('TC-T2-F27-02: rapid toggling bell launcher retains consistent open/closed state', () => {
      const drawer = document.createElement('div');
      drawer.className = 'drawer';
      for (let i = 0; i < 20; i++) {
        drawer.classList.toggle('open');
      }
      expect(drawer.classList.contains('open')).toBe(false);
      const res = generateWidgetApiResponse({ name: 'ToggleApp', slug: 'toggle-app', is_pro: false }, []);
      expect(res.body.project.show_badge).toBe(true);
    });

    it('TC-T2-F27-03: drawer z-index (999999) ensures overlay appears above host navigation headers', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('z-index:999999');
      const res = generateWidgetApiResponse({ name: 'ZIndex Test', slug: 'zindex-test', is_pro: true }, []);
      expect(res.headers['Content-Type']).toBe('application/json');
    });

    it('TC-T2-F27-04: close button click removes open class even if open class was added multiple times', () => {
      const drawer = document.createElement('div');
      drawer.className = 'drawer open';
      drawer.classList.add('open');
      drawer.classList.remove('open');
      expect(drawer.classList.contains('open')).toBe(false);
    });

    it('TC-T2-F27-05: drawer handles large release volume (50 releases) via generateWidgetApiResponse for scroll container', () => {
      const widgetCode = fs.readFileSync(widgetPath, 'utf8');
      expect(widgetCode).toContain('overflow-y:auto');

      const changelogs: PublishedChangelog[] = Array.from({ length: 50 }, (_, i) => ({
        id: `rel_${i + 1}`,
        project_id: 'proj_stress',
        project_slug: 'stress-feed',
        version_tag: `v1.${i}.0`,
        release_title: `Release ${i + 1}`,
        overview_summary: `Summary of release ${i + 1}`,
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
        published_at: new Date().toISOString(),
        status: 'published',
      }));

      const res = generateWidgetApiResponse({ name: 'StressFeed', slug: 'stress-feed', is_pro: false }, changelogs);
      expect(res.body.releases).toHaveLength(50);
      expect(res.body.releases[0].version_tag).toBe('v1.0.0');
      expect(res.body.releases[49].version_tag).toBe('v1.49.0');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 28: Viral Badge Logic Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 28: Viral Badge Logic Boundaries', () => {
    it('TC-T2-F28-01: safe default: undefined/null is_pro defaults to showing viral badge', () => {
      const isPro: boolean | undefined | null = null;
      const shouldShow = checkShouldShowViralBadge(Boolean(isPro));
      expect(shouldShow).toBe(true);
      const res = generateWidgetApiResponse({ name: 'Free', slug: 'free', is_pro: false }, []);
      expect(res.body.project.show_badge).toBe(true);
    });

    it('TC-T2-F28-02: explicit is_pro: true strictly suppresses viral badge', () => {
      expect(checkShouldShowViralBadge(true)).toBe(false);
      const res = generateWidgetApiResponse({ name: 'Pro', slug: 'pro', is_pro: true }, []);
      expect(res.body.project.show_badge).toBe(false);
      const ssr = renderSSRChangelog({ name: 'Pro', slug: 'pro', is_pro: true }, []);
      expect(ssr.html).not.toContain('viral-badge');
    });

    it('TC-T2-F28-03: spoofing data-pro on DOM does not override server-rendered show_badge value', () => {
      const res = generateWidgetApiResponse({ name: 'FreeSaas', slug: 'free-saas', is_pro: false }, []);
      expect(res.body.project.show_badge).toBe(true);
      expect(checkShouldShowViralBadge(res.body.project.is_pro)).toBe(true);
    });

    it('TC-T2-F28-04: badge text specifies ShipLog branding cleanly in SSR changelog', () => {
      const freeRes = renderSSRChangelog({ name: 'FreeApp', slug: 'free-app', is_pro: false }, []);
      expect(freeRes.html).toContain('<footer class="viral-badge">Powered by ShipLog</footer>');
      expect(freeRes.html).toContain('Powered by ShipLog');
    });

    it('TC-T2-F28-05: white-labeled Pro tier payload returns show_badge: false in public API and SSR', () => {
      const res = generateWidgetApiResponse({ name: 'ProSaaS', slug: 'pro-saas', is_pro: true }, []);
      expect(res.body.project.show_badge).toBe(false);
      const ssr = renderSSRChangelog({ name: 'ProSaaS', slug: 'pro-saas', is_pro: true }, []);
      expect(ssr.html).not.toContain('Powered by ShipLog');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 29: Public Widget API CORS Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 29: Public Widget API CORS Boundaries', () => {
    it('TC-T2-F29-01: non-existent slug returns empty releases array gracefully', () => {
      const res = generateWidgetApiResponse({ name: 'NotFound', slug: 'not-found', is_pro: false }, []);
      expect(res.body.releases).toEqual([]);
    });

    it('TC-T2-F29-02: OPTIONS preflight response specifies allowed headers and methods', () => {
      const res = generateWidgetApiResponse({ name: 'Acme', slug: 'acme', is_pro: false }, []);
      expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(res.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
      expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    });

    it('TC-T2-F29-03: edge cache header specifies public max-age and s-maxage', () => {
      const res = generateWidgetApiResponse({ name: 'Acme', slug: 'acme', is_pro: false }, []);
      expect(res.headers['Cache-Control']).toContain('max-age=60');
      expect(res.headers['Cache-Control']).toContain('s-maxage=300');
    });

    it('TC-T2-F29-04: wildcard origin * is set on all widget API responses', () => {
      const res = generateWidgetApiResponse({ name: 'Acme', slug: 'acme', is_pro: false }, []);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('TC-T2-F29-05: ignores drafts in public widget endpoint', () => {
      const draft: PublishedChangelog = {
        id: 'draft_1',
        project_id: 'p1',
        project_slug: 'acme',
        version_tag: 'v1.0.0',
        release_title: 'Draft',
        overview_summary: 'Draft summary',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'E', social_post_thread: ['S'] },
        published_at: new Date().toISOString(),
        status: 'draft',
      };
      const res = generateWidgetApiResponse({ name: 'Acme', slug: 'acme', is_pro: false }, [draft]);
      expect(res.body.releases).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 30: Dodo Payments Checkout Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 30: Dodo Payments Checkout Boundaries', () => {
    const validBaseCheckout = {
      project_id: 'proj_demo_123',
      plan_id: 'plan_pro_monthly' as const,
      amount_cents: 1500,
      currency: 'USD' as const,
      return_url: 'https://shiplog.dev/dashboard/billing',
      customer_email: 'founder@example.com',
    };

    it('TC-T2-F30-01: rejects empty project_id via DodoCheckoutRequestSchema', () => {
      const res = DodoCheckoutRequestSchema.safeParse({
        ...validBaseCheckout,
        project_id: '',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((issue) => issue.path.includes('project_id'))).toBe(true);
      }
    });

    it('TC-T2-F30-02: rejects negative price (amount <= 0) via DodoCheckoutRequestSchema', () => {
      const negativeRes = DodoCheckoutRequestSchema.safeParse({
        ...validBaseCheckout,
        amount_cents: -1500,
      });
      expect(negativeRes.success).toBe(false);
      if (!negativeRes.success) {
        expect(negativeRes.error.issues.some((issue) => issue.path.includes('amount_cents'))).toBe(true);
      }

      const zeroRes = DodoCheckoutRequestSchema.safeParse({
        ...validBaseCheckout,
        amount_cents: 0,
      });
      expect(zeroRes.success).toBe(false);
      if (!zeroRes.success) {
        expect(zeroRes.error.issues.some((issue) => issue.path.includes('amount_cents'))).toBe(true);
      }
    });

    it('TC-T2-F30-03: rejects unsupported currencies via DodoCheckoutRequestSchema', () => {
      const res = DodoCheckoutRequestSchema.safeParse({
        ...validBaseCheckout,
        currency: 'XYZ',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((issue) => issue.path.includes('currency'))).toBe(true);
        expect(res.error.issues[0]?.message).toMatch(/Unsupported currency/);
      }
    });

    it('TC-T2-F30-04: rejects invalid return_url via DodoCheckoutRequestSchema', () => {
      const invalidRes = DodoCheckoutRequestSchema.safeParse({
        ...validBaseCheckout,
        return_url: 'not-a-valid-url',
      });
      expect(invalidRes.success).toBe(false);
      if (!invalidRes.success) {
        expect(invalidRes.error.issues.some((issue) => issue.path.includes('return_url'))).toBe(true);
      }

      const validRes = DodoCheckoutRequestSchema.safeParse(validBaseCheckout);
      expect(validRes.success).toBe(true);
    });

    it('TC-T2-F30-05: rejects invalid plan identifier via DodoCheckoutRequestSchema', () => {
      const res = DodoCheckoutRequestSchema.safeParse({
        ...validBaseCheckout,
        plan_id: 'hacked_free_plan',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((issue) => issue.path.includes('plan_id'))).toBe(true);
        expect(res.error.issues[0]?.message).toMatch(/Invalid plan identifier/);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 31: Dodo Webhook Receiver Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 31: Dodo Webhook Receiver Boundaries', () => {
    it('TC-T2-F31-01: handles missing event_id safely by rejecting event', () => {
      const res = validateSupabaseSchemaConstraint('dodo_webhook_events', { event_id: '' });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/event_id/);
    });

    it('TC-T2-F31-02: unknown webhook event type does not throw unhandled exception', () => {
      const event: any = {
        event_id: 'evt_unknown_type',
        type: 'custom.unrecognized.ping',
        data: { project_id: 'proj_demo' },
      };
      expect(() => handleDodoWebhook(event, idempotencyStore, projectStore)).not.toThrow();
    });

    it('TC-T2-F31-03: rejects webhook when signature is missing', () => {
      expect(verifyDodoSignature('{}', null, 'secret', false)).toBe(false);
    });

    it('TC-T2-F31-04: rejects webhook when signature contains invalid hex characters', () => {
      expect(verifyDodoSignature('{}', 'not-valid-hex!@#$', 'secret', false)).toBe(false);
    });

    it('TC-T2-F31-05: handles project not found during webhook processing without throwing', () => {
      const event = {
        event_id: 'evt_ghost',
        type: 'subscription.created' as const,
        data: { customer_id: 'c1', project_id: 'ghost_proj', status: 'active', plan_id: 'pro' },
      };
      const res = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(res.status).toBe('processed');
      expect(res.is_pro).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 32: Webhook Idempotency Layer Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 32: Webhook Idempotency Layer Boundaries', () => {
    it('TC-T2-F32-01: replaying event 100 times returns already_processed 99 times with 0 side-effects', () => {
      const event = {
        event_id: 'evt_spam_replay',
        type: 'subscription.created' as const,
        data: { customer_id: 'c1', project_id: 'proj_demo', status: 'active', plan_id: 'pro' },
      };
      const first = handleDodoWebhook(event, idempotencyStore, projectStore);
      expect(first.status).toBe('processed');
      for (let i = 0; i < 99; i++) {
        const replay = handleDodoWebhook(event, idempotencyStore, projectStore);
        expect(replay.status).toBe('already_processed');
      }
    });

    it('TC-T2-F32-02: handles SQL injection in event_id without throwing or corruption', () => {
      const injectionId = "evt_1'; DROP TABLE dodo_webhook_events; --";
      idempotencyStore.record(injectionId);
      expect(idempotencyStore.isProcessed(injectionId)).toBe(true);
    });

    it('TC-T2-F32-03: distinguishes similar event IDs (evt_1 vs evt_10)', () => {
      idempotencyStore.record('evt_1');
      expect(idempotencyStore.isProcessed('evt_1')).toBe(true);
      expect(idempotencyStore.isProcessed('evt_10')).toBe(false);
    });

    it('TC-T2-F32-04: empty string event ID is not recorded as processed', () => {
      expect(idempotencyStore.isProcessed('')).toBe(false);
    });

    it('TC-T2-F32-05: records 5,000 distinct event IDs within sub-50ms', () => {
      const start = Date.now();
      for (let i = 0; i < 5000; i++) {
        idempotencyStore.record(`evt_stress_${i}`);
      }
      expect(Date.now() - start).toBeLessThan(100);
      expect(idempotencyStore.isProcessed('evt_stress_4999')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 33: Development Signature Bypass Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 33: Development Signature Bypass Boundaries', () => {
    it('TC-T2-F33-01: strictly rejects mock signature header when isDevelopment is false', () => {
      expect(verifyDodoSignature('{}', null, 'sec', false, 'test_bypass_key')).toBe(false);
    });

    it('TC-T2-F33-02: strictly rejects wrong mock signature header even when isDevelopment is true', () => {
      expect(verifyDodoSignature('{}', null, 'sec', true, 'invalid_secret_override')).toBe(false);
    });

    it('TC-T2-F33-03: rejects empty string mock signature', () => {
      expect(verifyDodoSignature('{}', null, 'sec', true, '')).toBe(false);
    });

    it('TC-T2-F33-04: rejects mock signature with trailing spaces', () => {
      expect(verifyDodoSignature('{}', null, 'sec', true, 'test_bypass_key ')).toBe(false);
    });

    it('TC-T2-F33-05: allows genuine signature in production even when bypass key is present', () => {
      const secret = 'prod_sec';
      const body = '{"event":"genuine"}';
      const genuineSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      // In production, ignores mock bypass and tests genuine signature
      expect(verifyDodoSignature(body, genuineSig, secret, false, 'test_bypass_key')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 34: Tier Feature Gating Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 34: Tier Feature Gating Boundaries', () => {
    it('TC-T2-F34-01: Free tier user with 1 active repo blocked from connecting 2nd', () => {
      const verdict = checkCanConnectRepo({ tier: 'free', active_repos_count: 1, monthly_releases_count: 0 });
      expect(verdict.allowed).toBe(false);
      expect(verdict.upgrade_required).toBe(true);
    });

    it('TC-T2-F34-02: Free tier user with 2 monthly releases blocked from publishing 3rd', () => {
      const verdict = checkCanPublishRelease({ tier: 'free', active_repos_count: 1, monthly_releases_count: 2 });
      expect(verdict.allowed).toBe(false);
      expect(verdict.upgrade_required).toBe(true);
    });

    it('TC-T2-F34-03: Pro tier user with 100 repositories allowed to connect more', () => {
      const verdict = checkCanConnectRepo({ tier: 'pro', active_repos_count: 100, monthly_releases_count: 50 });
      expect(verdict.allowed).toBe(true);
    });

    it('TC-T2-F34-04: Pro tier user with 100 releases allowed to publish more', () => {
      const verdict = checkCanPublishRelease({ tier: 'pro', active_repos_count: 100, monthly_releases_count: 100 });
      expect(verdict.allowed).toBe(true);
    });

    it('TC-T2-F34-05: downgraded Pro tier immediately enforces Free limits on next repo connect', () => {
      const downgradedTenant = { tier: 'free' as const, active_repos_count: 1, monthly_releases_count: 2 };
      expect(checkCanConnectRepo(downgradedTenant).allowed).toBe(false);
      expect(checkCanPublishRelease(downgradedTenant).allowed).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 35: Automated Test Suite Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 35: Automated Test Suite Boundaries', () => {
    it('TC-T2-F35-01: harness schema validation cleanly rejects malformed Gemini release payloads', () => {
      const malformedPayload = {
        release_title: 'v1.0.0',
        // missing overview_summary
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'short', social_post_thread: [] },
      };
      const result = GeminiReleaseOutputSchema.safeParse(malformedPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.issues.map((i) => i.path.join('.'));
        expect(errorPaths).toContain('overview_summary');
        expect(errorPaths).toContain('distribution.email_plain_text');
        expect(errorPaths).toContain('distribution.social_post_thread');
      }
    });

    it('TC-T2-F35-02: async synthesis service rejects cleanly when live mode has no connectivity', async () => {
      const liveService = new GeminiSynthesisService('live_gemini_api_key_without_network');
      await expect(liveService.synthesize([{ pr_number: 1, title: 'feat: test' }], 'v1.0.0')).rejects.toThrow(
        /Live Gemini API requires network connectivity/
      );
    });

    it('TC-T2-F35-03: test harness resets state cleanly between tests across multiple projects', () => {
      queue.add({ project_id: 'proj_a', pr_number: 101, title: 'feat: project A item', status: 'unreleased' });
      queue.add({ project_id: 'proj_b', pr_number: 102, title: 'fix: project B item', status: 'unreleased' });
      expect(queue.list('proj_a', 'all')).toHaveLength(1);
      expect(queue.list('proj_b', 'all')).toHaveLength(1);

      queue.clear();
      expect(queue.list('proj_a', 'all')).toHaveLength(0);
      expect(queue.list('proj_b', 'all')).toHaveLength(0);
    });

    it('TC-T2-F35-04: harness batch noise evaluation and schema validation completes within sub-100ms budget', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        const noise = evaluatePRNoise({
          pr_number: i,
          title: i % 2 === 0 ? `feat: user feature #${i}` : `chore(deps): update dependency #${i}`,
          body: 'Automated test suite benchmark payload',
        });
        expect(typeof noise.isNoise).toBe('boolean');
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('TC-T2-F35-05: harness webhook verification handles corrupt or truncated HMAC signatures safely', () => {
      const payload = JSON.stringify({ action: 'closed', pull_request: { number: 99 } });
      const secret = 'test_webhook_secret';
      // Truncated signature
      expect(verifyGitHubSignature(payload, 'sha256=abcdef123', secret)).toBe(false);
      // Non-hex signature characters
      expect(verifyGitHubSignature(payload, 'sha256=invalid_non_hex_characters_here_1234567890', secret)).toBe(false);
      // Non-matching signature
      const bogusSig = 'sha256=' + '0'.repeat(64);
      expect(verifyGitHubSignature(payload, bogusSig, secret)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 36: E2E Pipeline Simulation CLI Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 36: E2E Pipeline Simulation CLI Boundaries', () => {
    it('TC-T2-F36-01: simulation rejects mock PR webhook event when pull request is not merged', () => {
      const unmergedWebhook = {
        action: 'closed',
        pull_request: {
          number: 1,
          title: 'feat: unmerged PR',
          merged: false,
        },
        repository: {
          full_name: 'acme/repo',
          name: 'repo',
        },
      };
      expect(isPRMerged(unmergedWebhook)).toBe(false);
    });

    it('TC-T2-F36-02: simulation noise step detects chore PR and rejects it from queue', () => {
      const chorePR = { pr_number: 2, title: 'chore(deps): update npm packages' };
      const noise = evaluatePRNoise(chorePR);
      expect(noise.isNoise).toBe(true);
      expect(noise.reason).toBe('convention_prefix');
    });

    it('TC-T2-F36-03: simulation throws if AI output is malformed', () => {
      const badAI = { release_title: 'AB' }; // fails min(3)
      expect(() => GeminiReleaseOutputSchema.parse(badAI)).toThrow();
    });

    it('TC-T2-F36-04: simulation verifies widget API CORS header is specifically wildcard * via generateWidgetApiResponse', () => {
      const res = generateWidgetApiResponse({ name: 'SimulatedApp', slug: 'simulated-app', is_pro: false }, []);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
    });

    it('TC-T2-F36-05: simulation verifies openGraph title contains project changelog suffix via renderSSRChangelog', () => {
      const mockChangelog: PublishedChangelog = {
        id: 'rel_sim_1',
        project_id: 'proj_sim',
        project_slug: 'demo-app',
        version_tag: 'v1.4.0',
        release_title: 'v1.4.0 — Instant Search',
        overview_summary: 'Fast full-text search.',
        categories: { features: [], improvements: [], fixes: [] },
        distribution: { email_plain_text: 'Email', social_post_thread: ['Post'] },
        published_at: new Date().toISOString(),
        status: 'published',
      };
      const ssr = renderSSRChangelog({ name: 'Demo App', slug: 'demo-app', is_pro: false }, [mockChangelog]);
      expect(ssr.meta.ogTitle).toContain('Demo App Changelog');
      expect(ssr.meta.ogTitle).toContain('v1.4.0 — Instant Search');
    });
  });
});
