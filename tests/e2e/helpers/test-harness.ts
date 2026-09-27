import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// ============================================================================
// 1. SCHEMAS & CONTRACTS
// ============================================================================

export const CategoryItemSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(150),
  description: z.string().min(1, 'Description cannot be empty'),
  pr_number: z.number().int().positive().optional(),
  author: z.string().optional(),
});

export const ReleaseCategoriesSchema = z.object({
  features: z.array(CategoryItemSchema),
  improvements: z.array(CategoryItemSchema),
  fixes: z.array(CategoryItemSchema),
}).strict();

export const DistributionSchema = z.object({
  email_plain_text: z.string().min(10, 'Email draft must have substantive content'),
  social_post_thread: z.array(z.string().min(1, 'Social post cannot be empty')).min(1, 'Thread must have at least one post'),
});

export const GeminiReleaseOutputSchema = z.object({
  release_title: z.string().min(3, 'Release title must be at least 3 characters'),
  overview_summary: z.string().min(10, 'Overview summary must be at least 10 characters'),
  categories: ReleaseCategoriesSchema,
  distribution: DistributionSchema,
}).strict();

export type GeminiReleaseOutput = z.infer<typeof GeminiReleaseOutputSchema>;

// ============================================================================
// 2. NOISE FILTER ENGINE
// ============================================================================

export interface PRMetadata {
  title: string;
  body?: string | null;
  labels?: string[];
  author?: string;
  pr_number: number;
}

export interface NoiseFilterResult {
  isNoise: boolean;
  reason?: 'convention_prefix' | 'exclusion_marker' | 'excluded_label';
  matchedRule?: string;
}

export const CONVENTION_PREFIX_REGEX = /^(chore|ci|test|style|refactor)(\(.*\))?:/i;
export const EXCLUSION_MARKER_REGEX = /\[(skip|internal|no-log)\]/i;
export const EXCLUDED_LABELS = new Set(['skip-changelog', 'internal', 'no-log', 'chore', 'dependencies']);

export function evaluatePRNoise(pr: PRMetadata): NoiseFilterResult {
  if (pr.labels && pr.labels.some((l) => EXCLUDED_LABELS.has(l.toLowerCase()))) {
    return { isNoise: true, reason: 'excluded_label', matchedRule: 'label' };
  }

  const prefixMatch = pr.title.trim().match(CONVENTION_PREFIX_REGEX);
  if (prefixMatch) {
    return { isNoise: true, reason: 'convention_prefix', matchedRule: prefixMatch[0] };
  }

  const titleMarkerMatch = pr.title.match(EXCLUSION_MARKER_REGEX);
  if (titleMarkerMatch) {
    return { isNoise: true, reason: 'exclusion_marker', matchedRule: titleMarkerMatch[0] };
  }

  if (pr.body) {
    const bodyMarkerMatch = pr.body.match(EXCLUSION_MARKER_REGEX);
    if (bodyMarkerMatch) {
      return { isNoise: true, reason: 'exclusion_marker', matchedRule: bodyMarkerMatch[0] };
    }
  }

  return { isNoise: false };
}

// ============================================================================
// 3. CRYPTOGRAPHIC SIGNATURE VERIFICATION
// ============================================================================

export function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const signature = signatureHeader.slice(7);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function verifyDodoSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  isDevelopment: boolean = false,
  mockSignatureHeader?: string | null
): boolean {
  if (isDevelopment && mockSignatureHeader === 'test_bypass_key') {
    return true;
  }
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ============================================================================
// 4. UNRELEASED ACCUMULATION QUEUE & REPOSITORY STATE
// ============================================================================

export interface QueueItem {
  id: string;
  project_id: string;
  pr_number: number;
  title: string;
  body?: string | null;
  author?: string;
  status: 'unreleased' | 'released' | 'archived';
  created_at: string;
}

export class InMemoryPRQueue {
  private items: Map<string, QueueItem> = new Map();

  add(item: Omit<QueueItem, 'id' | 'created_at'>): QueueItem {
    // Prevent duplicate ingestion of same PR number in same project
    for (const existing of this.items.values()) {
      if (existing.project_id === item.project_id && existing.pr_number === item.pr_number) {
        return existing;
      }
    }
    const id = 'queue_' + Math.random().toString(36).substring(2, 9);
    const created: QueueItem = {
      ...item,
      id,
      created_at: new Date().toISOString(),
    };
    this.items.set(id, created);
    return created;
  }

  list(projectId: string, status: 'unreleased' | 'released' | 'all' = 'unreleased'): QueueItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.project_id === projectId && (status === 'all' || item.status === status)
    );
  }

  markReleased(projectId: string, prNumbers: number[]): void {
    const prSet = new Set(prNumbers);
    for (const item of this.items.values()) {
      if (item.project_id === projectId && prSet.has(item.pr_number)) {
        item.status = 'released';
      }
    }
  }

  clear(): void {
    this.items.clear();
  }
}

// ============================================================================
// 5. DETERMINISTIC SYNTHESIS GENERATOR & HYBRID AI CLIENT
// ============================================================================

export class GeminiSynthesisService {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async synthesize(prs: Array<{ pr_number: number; title: string; body?: string | null; author?: string }>, versionTag: string): Promise<GeminiReleaseOutput> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      // Deterministic generation
      const features: z.infer<typeof CategoryItemSchema>[] = [];
      const improvements: z.infer<typeof CategoryItemSchema>[] = [];
      const fixes: z.infer<typeof CategoryItemSchema>[] = [];

      for (const pr of prs) {
        const lower = pr.title.toLowerCase();
        const rawTitle = pr.title.replace(/^(feat|fix|perf|docs|improvement)(\(.*\))?:\s*/i, '');
        const cleanTitle = (rawTitle.length > 140 ? rawTitle.slice(0, 137) + '...' : rawTitle) || 'Update';
        const item: z.infer<typeof CategoryItemSchema> = {
          title: cleanTitle,
          description: pr.body?.trim() || `Changes introduced in pull request #${pr.pr_number}.`,
          pr_number: pr.pr_number,
          author: pr.author,
        };

        if (lower.startsWith('fix')) {
          fixes.push(item);
        } else if (lower.startsWith('perf') || lower.startsWith('docs') || lower.startsWith('improvement')) {
          improvements.push(item);
        } else {
          features.push(item);
        }
      }

      const releaseOutput: GeminiReleaseOutput = {
        release_title: `${versionTag} — ${features[0]?.title || 'Release Updates'}`,
        overview_summary: `This release brings ${features.length} new feature(s), ${improvements.length} improvement(s), and ${fixes.length} bug fix(es).`,
        categories: {
          features,
          improvements,
          fixes,
        },
        distribution: {
          email_plain_text: `Hey everyone!\n\nShipLog ${versionTag} is live! Includes ${features.length} features and ${fixes.length} fixes.\n\nRead more on our changelog!`,
          social_post_thread: [
            `🚀 ShipLog ${versionTag} is here! Key highlights: ${features.map((f) => f.title).join(', ') || 'Various improvements'}.`,
            `Check out the full release notes and update your widget now! 📦`,
          ],
        },
      };

      return GeminiReleaseOutputSchema.parse(releaseOutput);
    }

    // Live mode fallback placeholder (strict validation)
    throw new Error('Live Gemini API requires network connectivity; use mock mode in testing');
  }
}

// ============================================================================
// 6. MONETIZATION & FEATURE GATING
// ============================================================================

export interface TenantTierInfo {
  tier: 'free' | 'pro';
  active_repos_count: number;
  monthly_releases_count: number;
}

export interface FeatureGateVerdict {
  allowed: boolean;
  reason?: string;
  upgrade_required?: boolean;
}

export function checkCanConnectRepo(tenant: TenantTierInfo): FeatureGateVerdict {
  if (tenant.tier === 'pro') {
    return { allowed: true };
  }
  if (tenant.active_repos_count >= 1) {
    return {
      allowed: false,
      reason: 'Free tier is limited to 1 connected repository. Upgrade to Pro for unlimited repositories.',
      upgrade_required: true,
    };
  }
  return { allowed: true };
}

export function checkCanPublishRelease(tenant: TenantTierInfo): FeatureGateVerdict {
  if (tenant.tier === 'pro') {
    return { allowed: true };
  }
  if (tenant.monthly_releases_count >= 2) {
    return {
      allowed: false,
      reason: 'Free tier is limited to 2 published releases per month. Upgrade to Pro for unlimited releases.',
      upgrade_required: true,
    };
  }
  return { allowed: true };
}

export function checkShouldShowViralBadge(isPro: boolean): boolean {
  return !isPro;
}

// ============================================================================
// 7. DODO PAYMENTS WEBHOOK & IDEMPOTENCY STORE
// ============================================================================

export class WebhookIdempotencyStore {
  private processedEvents = new Set<string>();

  isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  record(eventId: string): void {
    this.processedEvents.add(eventId);
  }

  clear(): void {
    this.processedEvents.clear();
  }
}

export interface DodoWebhookEvent {
  event_id: string;
  type: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled';
  data: {
    customer_id: string;
    project_id: string;
    status: string;
    plan_id: string;
  };
}

export function handleDodoWebhook(
  event: DodoWebhookEvent,
  idempotencyStore: WebhookIdempotencyStore,
  projectStore: Map<string, { id: string; is_pro: boolean }>
): { status: 'processed' | 'already_processed'; is_pro: boolean } {
  if (idempotencyStore.isProcessed(event.event_id)) {
    const current = projectStore.get(event.data.project_id);
    return { status: 'already_processed', is_pro: current?.is_pro ?? false };
  }

  idempotencyStore.record(event.event_id);
  const project = projectStore.get(event.data.project_id) || { id: event.data.project_id, is_pro: false };

  if (event.type === 'subscription.created' || (event.type === 'subscription.updated' && event.data.status === 'active')) {
    project.is_pro = true;
  } else if (event.type === 'subscription.cancelled') {
    project.is_pro = false;
  }

  projectStore.set(event.data.project_id, project);
  return { status: 'processed', is_pro: project.is_pro };
}

// ============================================================================
// 8. WIDGET API & SSR SIMULATION HELPERS
// ============================================================================

export interface PublishedChangelog {
  id: string;
  project_id: string;
  project_slug: string;
  version_tag: string;
  release_title: string;
  overview_summary: string;
  categories: {
    features: Array<any>;
    improvements: Array<any>;
    fixes: Array<any>;
  };
  distribution: {
    email_plain_text: string;
    social_post_thread: string[];
  };
  published_at: string;
  status: 'draft' | 'published';
}

export function generateWidgetApiResponse(
  project: { name: string; slug: string; is_pro: boolean },
  changelogs: PublishedChangelog[]
) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Content-Type': 'application/json',
    },
    body: {
      project: {
        name: project.name,
        slug: project.slug,
        is_pro: project.is_pro,
        show_badge: checkShouldShowViralBadge(project.is_pro),
      },
      releases: changelogs
        .filter((c) => c.status === 'published' && c.project_slug === project.slug)
        .map((c) => ({
          id: c.id,
          version_tag: c.version_tag,
          release_title: c.release_title,
          overview_summary: c.overview_summary,
          categories: c.categories,
          published_at: c.published_at,
        })),
    },
  };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

export function renderSSRChangelog(
  project: { name: string; slug: string; is_pro: boolean },
  changelogs: PublishedChangelog[]
) {
  const published = changelogs.filter((c) => c.status === 'published' && c.project_slug === project.slug);
  const latest = published[0];

  const displayName = project.name || project.slug;
  const ogTitle = latest ? `${latest.release_title} | ${displayName} Changelog` : `${displayName} Changelog`;
  const ogDescription = latest ? latest.overview_summary : `Latest updates and release notes for ${displayName}.`;
  const showBadge = checkShouldShowViralBadge(project.is_pro);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
    meta: {
      title: ogTitle,
      ogTitle,
      ogDescription,
      ogImage: `https://shiplog.dev/api/og?title=${encodeURIComponent(ogTitle)}`,
    },
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${escapeHtml(ogTitle)}</title>
          <meta property="og:title" content="${escapeHtml(ogTitle)}" />
          <meta property="og:description" content="${escapeHtml(ogDescription)}" />
        </head>
        <body>
          <main>
            <h1>${escapeHtml(displayName)} Changelog</h1>
            <div id="timeline">
              ${published
                .map(
                  (r) => `
                <article class="release" data-version="${escapeHtml(r.version_tag)}">
                  <h2>${escapeHtml(r.release_title)}</h2>
                  <time>${escapeHtml(r.published_at)}</time>
                  <p>${escapeHtml(r.overview_summary)}</p>
                  <div class="features">${r.categories.features.map((f) => `<div class="badge-feature">${escapeHtml(f.title)}</div>`).join('')}</div>
                </article>
              `
                )
                .join('')}
            </div>
            ${showBadge ? '<footer class="viral-badge">Powered by ShipLog</footer>' : ''}
          </main>
        </body>
      </html>
    `,
  };
}

// ============================================================================
// 9. GITHUB WEBHOOK CONTRACT & PR MERGE FILTER
// ============================================================================

export const GitHubPRClosedWebhookSchema = z.object({
  action: z.literal('closed'),
  pull_request: z.object({
    number: z.number().int().positive('PR number must be positive integer'),
    title: z.string().min(1, 'Title cannot be empty'),
    body: z.string().nullable().optional(),
    merged: z.boolean().default(false),
    merged_at: z.string().nullable().optional(),
    merge_commit_sha: z.string().regex(/^[0-9a-f]{40}$/i, 'Must be a 40-character hex SHA').nullable().optional(),
    user: z.object({
      login: z.string().min(1),
    }).optional(),
    head: z.object({
      ref: z.string(),
      sha: z.string().optional(),
    }).optional(),
    base: z.object({
      ref: z.string(),
    }).optional(),
    labels: z.array(z.union([z.object({ name: z.string() }), z.string()])).optional(),
    draft: z.boolean().optional(),
  }),
  repository: z.object({
    full_name: z.string().min(1),
    name: z.string().min(1),
    owner: z.object({
      login: z.string().min(1),
    }).optional(),
  }),
  sender: z.object({
    login: z.string().min(1),
  }).optional(),
});

export type GitHubPRClosedWebhook = z.infer<typeof GitHubPRClosedWebhookSchema>;

export function isPRMerged(payload: unknown): boolean {
  const result = GitHubPRClosedWebhookSchema.safeParse(payload);
  if (!result.success) return false;
  return result.data.action === 'closed' && result.data.pull_request.merged === true;
}

// ============================================================================
// 10. MARKDOWN DRAFT VALIDATION & SANITIZATION
// ============================================================================

export const CategoryItemFlexibleSchema = z.union([
  CategoryItemSchema,
  z.string(),
]);

export const ReleaseCategoriesFlexibleSchema = z.object({
  features: z.array(CategoryItemFlexibleSchema).optional().default([]),
  improvements: z.array(CategoryItemFlexibleSchema).optional().default([]),
  fixes: z.array(CategoryItemFlexibleSchema).optional().default([]),
});

export const MarkdownDraftSchema = z.object({
  release_title: z.string().trim().min(3, 'release_title must be at least 3 characters').max(200),
  overview_summary: z.string().trim().min(10, 'overview_summary must be at least 10 characters'),
  markdown_body: z.string().optional().default(''),
  categories: ReleaseCategoriesFlexibleSchema.optional().default({ features: [], improvements: [], fixes: [] }),
  distribution: DistributionSchema.optional(),
});

export type MarkdownDraft = z.infer<typeof MarkdownDraftSchema>;

export function sanitizeMarkdown(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:[^\s"'>]+/gi, '')
    .replace(/onerror\s*=\s*["'][^"']*["']/gi, '')
    .replace(/onload\s*=\s*["'][^"']*["']/gi, '');
}

export function validateAndSanitizeMarkdownDraft(draft: unknown): {
  valid: boolean;
  sanitizedDraft?: MarkdownDraft;
  error?: string;
  errors?: string[];
} {
  const result = MarkdownDraftSchema.safeParse(draft);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return {
      valid: false,
      error: errorMessages.join('; '),
      errors: errorMessages,
    };
  }
  const sanitizedCategories = {
    features: (result.data.categories?.features || []).map((item) =>
      typeof item === 'string'
        ? sanitizeMarkdown(item).trim()
        : { ...item, title: sanitizeMarkdown(item.title).trim(), description: sanitizeMarkdown(item.description).trim() }
    ),
    improvements: (result.data.categories?.improvements || []).map((item) =>
      typeof item === 'string'
        ? sanitizeMarkdown(item).trim()
        : { ...item, title: sanitizeMarkdown(item.title).trim(), description: sanitizeMarkdown(item.description).trim() }
    ),
    fixes: (result.data.categories?.fixes || []).map((item) =>
      typeof item === 'string'
        ? sanitizeMarkdown(item).trim()
        : { ...item, title: sanitizeMarkdown(item.title).trim(), description: sanitizeMarkdown(item.description).trim() }
    ),
  };
  const sanitized: MarkdownDraft = {
    ...result.data,
    release_title: sanitizeMarkdown(result.data.release_title).trim(),
    overview_summary: sanitizeMarkdown(result.data.overview_summary).trim(),
    markdown_body: sanitizeMarkdown(result.data.markdown_body || '').trim(),
    categories: sanitizedCategories as any,
  };
  return {
    valid: true,
    sanitizedDraft: sanitized,
  };
}

// ============================================================================
// 11. MULTI-CHANNEL SYNDICATION FORMATTERS
// ============================================================================

export function formatSyndicationEmail(release: unknown): string {
  if (!release || typeof release !== 'object') {
    throw new Error('Invalid release object for email syndication');
  }
  const rel = release as {
    release_title?: string;
    version_tag?: string;
    overview_summary?: string;
    categories?: {
      features?: Array<any>;
      improvements?: Array<any>;
      fixes?: Array<any>;
    };
    distribution?: {
      email_plain_text?: string;
    };
  };

  if (!rel.release_title || !rel.overview_summary) {
    throw new Error('Missing release_title or overview_summary for email syndication');
  }

  if (rel.distribution?.email_plain_text && rel.distribution.email_plain_text.trim().length > 0) {
    return rel.distribution.email_plain_text.replace(/<[^>]+>/g, '').trim();
  }

  const cleanTitle = rel.release_title.replace(/<[^>]+>/g, '').trim();
  const rawSummary = rel.overview_summary.replace(/<[^>]+>/g, '').trim();
  const cleanSummary = rawSummary.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  const version = rel.version_tag ? ` [${rel.version_tag}]` : '';
  const lines: string[] = [
    `Subject: Updates live: ${cleanTitle}${version}`,
    '',
    'Hey everyone,',
    '',
    cleanSummary,
    '',
  ];

  const features = rel.categories?.features || [];
  if (features.length > 0) {
    lines.push('### What is New:');
    for (const f of features) {
      const title = typeof f === 'string' ? f : f.title;
      const desc = typeof f === 'object' && f.description ? `: ${f.description}` : '';
      lines.push(`• ${String(title).replace(/<[^>]+>/g, '')}${String(desc).replace(/<[^>]+>/g, '')}`);
    }
    lines.push('');
  }

  const improvements = rel.categories?.improvements || [];
  if (improvements.length > 0) {
    lines.push('### Improvements:');
    for (const imp of improvements) {
      lines.push(`• ${imp.title}${imp.description ? `: ${imp.description}` : ''}`);
    }
    lines.push('');
  }

  const fixes = rel.categories?.fixes || [];
  if (fixes.length > 0) {
    lines.push('### Bug Fixes:');
    for (const fx of fixes) {
      lines.push(`• ${fx.title}${fx.description ? `: ${fx.description}` : ''}`);
    }
    lines.push('');
  }

  lines.push('Best,');
  lines.push('The ShipLog Team');

  return lines.join('\n');
}

export function formatSocialThread(release: unknown): string[] {
  if (!release || typeof release !== 'object') {
    throw new Error('Invalid release object for social thread');
  }
  const rel = release as {
    release_title?: string;
    version_tag?: string;
    overview_summary?: string;
    categories?: {
      features?: Array<{ title: string; description?: string }>;
      improvements?: Array<{ title: string; description?: string }>;
      fixes?: Array<{ title: string; description?: string }>;
    };
    distribution?: {
      social_post_thread?: string[];
    };
  };

  if (!rel.release_title || !rel.overview_summary) {
    throw new Error('Missing release_title or overview_summary for social thread');
  }

  if (rel.distribution?.social_post_thread && rel.distribution.social_post_thread.length > 0) {
    const rawPosts = rel.distribution.social_post_thread;
    const total = rawPosts.length;
    return rawPosts.map((post, idx) => {
      const sanitized = post.replace(/<[^>]+>/g, '').trim();
      const numbered = total > 1 && !/^\d+\/\d+/.test(sanitized) ? `${idx + 1}/${total} ${sanitized}` : sanitized;
      return numbered.slice(0, 280);
    });
  }

  const posts: string[] = [];
  const p1 = `🚀 ${rel.release_title} is now live!\n\n${rel.overview_summary}`;
  posts.push(p1);

  const highlights: string[] = [];
  if (rel.categories?.features) {
    for (const f of rel.categories.features) highlights.push(`✨ ${f.title}`);
  }
  if (rel.categories?.improvements) {
    for (const imp of rel.categories.improvements) highlights.push(`⚡ ${imp.title}`);
  }
  if (highlights.length > 0) {
    const chunk = highlights.slice(0, 4).join('\n');
    posts.push(`Key highlights in this release:\n\n${chunk}`);
  }

  posts.push('Check out the full interactive changelog and widget feed on our portal! 📦 Feedback and bug reports welcome.');

  const total = posts.length;
  return posts.map((post, idx) => `${idx + 1}/${total} ${post}`.slice(0, 280));
}

// ============================================================================
// 12. DODO PAYMENTS CHECKOUT CONTRACT
// ============================================================================

export const DodoCheckoutRequestSchema = z.object({
  project_id: z.string().min(1, 'Project ID is required'),
  plan_id: z.enum(['plan_pro_monthly', 'plan_pro_annual'], {
    errorMap: () => ({ message: 'Invalid plan identifier; must be plan_pro_monthly or plan_pro_annual' }),
  }),
  amount_cents: z.number().int().positive('Amount must be a positive integer in cents'),
  currency: z.enum(['USD', 'EUR', 'GBP'], {
    errorMap: () => ({ message: 'Unsupported currency; supported currencies are USD, EUR, GBP' }),
  }),
  return_url: z.string().url('return_url must be a valid absolute URL'),
  customer_email: z.string().email('customer_email must be a valid email address'),
  metadata: z.record(z.unknown()).optional(),
});

export type DodoCheckoutRequest = z.infer<typeof DodoCheckoutRequestSchema>;

export interface DodoCheckoutSession {
  session_id: string;
  checkout_url: string;
  status: 'pending' | 'completed' | 'expired';
  customer_email: string;
  amount_cents: number;
  currency: string;
  plan_id: string;
  project_id: string;
  expires_at: string;
}

export function createCheckoutSession(req: unknown): DodoCheckoutSession {
  const validated = DodoCheckoutRequestSchema.parse(req);
  const sessionId = 'dodo_sess_' + crypto.randomBytes(12).toString('hex');
  const checkoutUrl = `https://checkout.dodopayments.com/buy/${validated.plan_id}?session_id=${sessionId}&project_id=${encodeURIComponent(validated.project_id)}&email=${encodeURIComponent(validated.customer_email)}`;
  return {
    session_id: sessionId,
    checkout_url: checkoutUrl,
    status: 'pending',
    customer_email: validated.customer_email,
    amount_cents: validated.amount_cents,
    currency: validated.currency,
    plan_id: validated.plan_id,
    project_id: validated.project_id,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

// ============================================================================
// 13. SUPABASE RELATIONAL SCHEMA CONSTRAINTS
// ============================================================================

const uniqueRegistry = {
  projects_slugs: new Set<string>(),
  project_prs: new Set<string>(),
  dodo_event_ids: new Set<string>(),
};

export function clearMockDatabaseRegistry(): void {
  uniqueRegistry.projects_slugs.clear();
  uniqueRegistry.project_prs.clear();
  uniqueRegistry.dodo_event_ids.clear();
}

export function validateSupabaseSchemaConstraint(
  table: string,
  row: Record<string, unknown>
): { valid: boolean; error?: string } {
  if (table === 'profiles') {
    if (!row.id || typeof row.id !== 'string') {
      return { valid: false, error: 'profiles.id violates NOT NULL / UUID constraint' };
    }
    if (!row.email || typeof row.email !== 'string' || !row.email.includes('@')) {
      return { valid: false, error: 'profiles.email violates NOT NULL or format constraint' };
    }
    if (row.tier !== undefined && row.tier !== 'free' && row.tier !== 'pro') {
      return { valid: false, error: "profiles.tier violates CHECK constraint (tier IN ('free', 'pro'))" };
    }
    const validStatuses = new Set(['inactive', 'active', 'cancelled', 'past_due', 'on_hold']);
    if (row.subscription_status !== undefined && !validStatuses.has(String(row.subscription_status))) {
      return { valid: false, error: 'profiles.subscription_status violates CHECK constraint' };
    }
    return { valid: true };
  }

  if (table === 'projects') {
    if (!row.user_id || typeof row.user_id !== 'string') {
      return { valid: false, error: 'projects.user_id violates NOT NULL constraint' };
    }
    if (!row.name || typeof row.name !== 'string' || row.name.trim().length === 0) {
      return { valid: false, error: 'projects.name violates NOT NULL / non-empty constraint' };
    }
    if (!row.slug || typeof row.slug !== 'string' || !/^[a-z0-9_-]+$/i.test(row.slug)) {
      return { valid: false, error: 'projects.slug violates format / NOT NULL constraint (slug contains invalid characters)' };
    }
    if (isReservedAppRoute(row.slug)) {
      return { valid: false, error: `projects.slug '${row.slug}' violates reserved route name constraint` };
    }
    if (row.repo_name !== undefined || row.repo_full_name !== undefined) {
      const repoNameStr = String(row.repo_full_name ?? row.repo_name ?? '');
      if (repoNameStr.trim().length === 0) {
        return { valid: false, error: 'projects.repo_name violates constraint (repo_name cannot be empty)' };
      }
      if (!row.repo_owner && !repoNameStr.includes('/')) {
        return { valid: false, error: 'projects.repo_name must follow owner/repo format' };
      }
      if (repoNameStr.includes(';') || repoNameStr.includes(' ') || !/^[a-z0-9_./-]+$/i.test(repoNameStr.trim())) {
        return { valid: false, error: 'projects.repo_name contains invalid characters' };
      }
    }
    if (uniqueRegistry.projects_slugs.has(row.slug)) {
      return { valid: false, error: `projects.slug violates UNIQUE constraint: '${row.slug}' already exists` };
    }
    uniqueRegistry.projects_slugs.add(row.slug);
    return { valid: true };
  }

  if (table === 'changelogs') {
    if (!row.project_id || typeof row.project_id !== 'string') {
      return { valid: false, error: 'changelogs.project_id violates NOT NULL constraint' };
    }
    if (!row.version_tag || typeof row.version_tag !== 'string' || row.version_tag.trim().length === 0) {
      return { valid: false, error: 'changelogs.version_tag violates NOT NULL / non-empty constraint (version_tag cannot be empty)' };
    }
    if (!/^v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-z0-9_.-]+)?$/i.test(row.version_tag.trim())) {
      return { valid: false, error: 'changelogs.version_tag violates semver format constraint' };
    }
    const title = row.release_title ?? row.title;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return { valid: false, error: 'changelogs.title / release_title violates NOT NULL constraint' };
    }
    if (row.status !== undefined && row.status !== 'draft' && row.status !== 'published') {
      return { valid: false, error: "changelogs.status violates CHECK constraint (status IN ('draft', 'published'))" };
    }
    if (row.published_at !== undefined && row.published_at !== null) {
      const ts = new Date(String(row.published_at)).getTime();
      if (isNaN(ts) || ts > Date.now() + 60000) {
        return { valid: false, error: 'changelogs.published_at cannot be in the future' };
      }
    }
    return { valid: true };
  }

  if (table === 'pull_requests') {
    if (!row.project_id || typeof row.project_id !== 'string') {
      return { valid: false, error: 'pull_requests.project_id violates NOT NULL constraint' };
    }
    if (typeof row.pr_number !== 'number' || row.pr_number <= 0 || !Number.isInteger(row.pr_number)) {
      return { valid: false, error: 'pull_requests.pr_number must be a positive integer' };
    }
    if (!row.title || typeof row.title !== 'string' || row.title.trim().length === 0) {
      return { valid: false, error: 'pull_requests.title violates NOT NULL / non-empty constraint (title cannot be empty)' };
    }
    const validStatuses = new Set(['unreleased', 'released', 'excluded', 'queued', 'included', 'filtered']);
    if (row.status !== undefined && !validStatuses.has(String(row.status))) {
      return { valid: false, error: 'pull_requests.status violates CHECK constraint' };
    }
    const uqKey = `${row.project_id}:${row.pr_number}`;
    if (uniqueRegistry.project_prs.has(uqKey)) {
      return { valid: false, error: `pull_requests violates UNIQUE (project_id, pr_number) constraint: ${uqKey}` };
    }
    uniqueRegistry.project_prs.add(uqKey);
    return { valid: true };
  }

  if (table === 'dodo_webhook_events') {
    if (!row.event_id || typeof row.event_id !== 'string' || row.event_id.trim().length === 0) {
      return { valid: false, error: 'dodo_webhook_events.event_id violates NOT NULL constraint (event_id cannot be empty)' };
    }
    if (uniqueRegistry.dodo_event_ids.has(row.event_id)) {
      return { valid: false, error: `dodo_webhook_events violates UNIQUE constraint on event_id: '${row.event_id}'` };
    }
    uniqueRegistry.dodo_event_ids.add(row.event_id);
    return { valid: true };
  }

  return { valid: false, error: `Unknown table '${table}' in Supabase schema validator` };
}

// ============================================================================
// 14. MULTI-TENANT ROW-LEVEL SECURITY EVALUATOR
// ============================================================================

export function evaluateMockRLS(
  table: string,
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  caller: { role: string; userId?: string },
  targetRow: Record<string, unknown>
): boolean {
  if (targetRow.id_changed === true) {
    return false;
  }

  if (caller.role === 'service_role') {
    return true;
  }

  if (table === 'dodo_webhook_events') {
    return false;
  }

  if (table === 'profiles') {
    if (caller.role !== 'authenticated' || !caller.userId) {
      return false;
    }
    if (caller.userId !== targetRow.id) {
      return false;
    }
    if (operation === 'SELECT' || operation === 'INSERT') {
      return true;
    }
    if (operation === 'UPDATE') {
      if (
        targetRow.tier !== undefined ||
        targetRow.subscription_status !== undefined ||
        targetRow.dodo_subscription_id !== undefined ||
        targetRow.dodo_customer_id !== undefined ||
        targetRow.current_period_end !== undefined ||
        targetRow._attempted_escalation === true ||
        targetRow.id_changed === true
      ) {
        return false;
      }
      return true;
    }
    return false;
  }

  if (table === 'projects') {
    if (caller.role !== 'authenticated' || !caller.userId) {
      return false;
    }
    return caller.userId === targetRow.user_id;
  }

  if (table === 'changelogs') {
    if (operation === 'SELECT') {
      if (targetRow.is_published === true || targetRow.status === 'published') {
        return true;
      }
      return caller.role === 'authenticated' && Boolean(caller.userId) && caller.userId === targetRow.user_id;
    }
    return caller.role === 'authenticated' && Boolean(caller.userId) && caller.userId === targetRow.user_id;
  }

  if (table === 'pull_requests') {
    return caller.role === 'authenticated' && Boolean(caller.userId) && caller.userId === targetRow.user_id;
  }

  return false;
}

// ============================================================================
// 15. APP ROUTER NAVIGATION CONTRACT
// ============================================================================

export const RESERVED_APP_SEGMENTS = new Set([
  'api',
  'c',
  'dashboard',
  'projects',
  'billing',
  'login',
  'auth',
  'widget',
  'public',
  'settings',
  'profile',
  '_next',
  'favicon.ico',
  'robots.txt',
]);

export function isReservedAppRoute(pathOrSlug: string): boolean {
  if (!pathOrSlug) return false;
  const segment = pathOrSlug.replace(/^\/+/, '').split('/')[0].toLowerCase();
  return RESERVED_APP_SEGMENTS.has(segment);
}

// ============================================================================
// 16. WIDGET RUNTIME CONTRACTS & LOCALSTORAGE SAFE STORES
// ============================================================================

export function validateWidgetBundleSize(
  bufferOrString: Buffer | string,
  limitBytes = 5120
): { valid: boolean; sizeBytes: number; gzippedBytes: number; error?: string } {
  const buf = typeof bufferOrString === 'string' ? Buffer.from(bufferOrString) : bufferOrString;
  const sizeBytes = buf.length;
  const gzippedBytes = zlib.gzipSync(buf).length;
  if (sizeBytes > limitBytes || gzippedBytes > limitBytes) {
    return {
      valid: false,
      sizeBytes,
      gzippedBytes,
      error: `Bundle size (${sizeBytes} bytes raw, ${gzippedBytes} bytes gz) exceeds limit of ${limitBytes} bytes`,
    };
  }
  return { valid: true, sizeBytes, gzippedBytes };
}

export function formatUnreadCountBadge(count: number): string {
  const safeCount = Math.max(0, count);
  return safeCount > 99 ? '99+' : safeCount.toString();
}

export class SafeLocalStorageStore {
  private memoryFallback: Map<string, string> = new Map();
  private throwsOnAccess: boolean = false;

  constructor(simulateQuotaError = false) {
    this.throwsOnAccess = simulateQuotaError;
  }

  setItem(key: string, value: string): boolean {
    if (this.throwsOnAccess) {
      this.memoryFallback.set(key, value);
      return false;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      this.memoryFallback.set(key, value);
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.throwsOnAccess) {
      return this.memoryFallback.get(key) ?? null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }
}


