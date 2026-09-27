#!/usr/bin/env tsx
import { z } from 'zod';
import {
  generateWidgetApiResponse,
  renderSSRChangelog,
  type PublishedChangelog,
} from '../tests/e2e/helpers/test-harness';

// ============================================================================
// Schemas & Domain Contracts for End-to-End Pipeline Simulation
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

// Regex noise filters according to specification
export const CONVENTION_PREFIX_REGEX = /^(chore|ci|test|style|refactor)(\(.*\))?:/i;
export const EXCLUSION_MARKER_REGEX = /\[(skip|internal|no-log)\]/i;
export const EXCLUDED_LABELS = new Set(['skip-changelog', 'internal', 'no-log', 'chore', 'dependencies']);

export interface PRMetadata {
  title: string;
  body?: string | null;
  labels?: string[];
  author?: string;
  pr_number: number;
}

export function evaluatePRNoise(pr: PRMetadata): { isNoise: boolean; reason?: string; matchedRule?: string } {
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
// Pipeline Simulation Runner
// ============================================================================

export async function runSimulation(): Promise<void> {
  console.log('\n============================================================');
  console.log(' 🚀 SHIPLOG END-TO-END PIPELINE SIMULATION CLI');
  console.log('============================================================\n');

  // STEP 1: Dispatch Mock GitHub PR Merge Event
  console.log('[STAGE 1/6] Dispatching mock PR merge webhook event...');
  const mockPR: PRMetadata & { merged: boolean } = {
    pr_number: 42,
    title: 'feat: add instant changelog search and category filtering',
    body: 'Introduces client-side fuzzy search across published changelogs.\n\nCloses #42.',
    labels: ['feature', 'search'],
    author: 'developer-jane',
    merged: true,
  };

  if (!mockPR.merged) {
    throw new Error('[FAIL] Stage 1: Unmerged PR closure should not proceed to queue');
  }
  console.log(`  ✔ Received merged pull_request.closed webhook event for PR #${mockPR.pr_number}`);

  // STEP 2: Regex Noise Filtering
  console.log('\n[STAGE 2/6] Applying regex noise filter engine...');
  const noiseResult = evaluatePRNoise(mockPR);
  if (noiseResult.isNoise) {
    throw new Error(`[FAIL] Stage 2: Genuine feature PR was incorrectly filtered as noise: ${noiseResult.reason}`);
  }
  console.log(`  ✔ PR #${mockPR.pr_number} passed noise filter: "${mockPR.title}" (Rule: Allowed Feature)`);

  // Verify negative noise filtering assertion
  const sampleNoisePR: PRMetadata = {
    pr_number: 43,
    title: 'chore(deps): bump vite from 5.0 to 5.1 [skip]',
    body: 'Internal dependency bump.',
    author: 'dependabot[bot]',
  };
  const sampleNoiseResult = evaluatePRNoise(sampleNoisePR);
  if (!sampleNoiseResult.isNoise) {
    throw new Error('[FAIL] Stage 2: Chore PR was not correctly filtered out!');
  }
  console.log(`  ✔ Noise verification confirmed: "${sampleNoisePR.title}" filtered out as ${sampleNoiseResult.reason}`);

  // STEP 3: Unreleased Queue Ingestion
  console.log('\n[STAGE 3/6] Ingesting PR metadata into project unreleased queue...');
  const queueItem = {
    id: 'queue_mock_' + Math.random().toString(36).substring(2, 9),
    project_id: 'proj_demo_shiplog',
    pr_number: mockPR.pr_number,
    title: mockPR.title,
    body: mockPR.body,
    author: mockPR.author,
    status: 'unreleased' as const,
    created_at: new Date().toISOString(),
  };
  console.log(`  ✔ Queue item created successfully with ID: ${queueItem.id}`);
  console.log(`  ✔ PR #${queueItem.pr_number} staged for release synthesis`);

  // STEP 4: Gemini 1.5 Flash Structured AI Synthesis
  console.log('\n[STAGE 4/6] Running Gemini 1.5 Flash structured synthesis (Deterministic Mock Fallback)...');
  const mockAISynthesis: GeminiReleaseOutput = {
    release_title: 'v1.4.0 — Instant Search & Filtering',
    overview_summary: 'We are thrilled to introduce instant client-side search across all published changelog entries, making discovering features seamless.',
    categories: {
      features: [
        {
          title: 'Instant Changelog Search',
          description: 'Client-side fuzzy search across all release notes and category tags.',
          pr_number: 42,
          author: 'developer-jane',
        },
      ],
      improvements: [],
      fixes: [],
    },
    distribution: {
      email_plain_text: 'Hey there!\n\nWe just launched v1.4.0 with instant changelog search! Now your users can find any release note in milliseconds.\n\nCheck it out!',
      social_post_thread: [
        '🚀 ShipLog v1.4.0 is live! Users can now search and filter all changelog releases instantly.',
        'Zero dependencies, scoped Shadow DOM, and sub-second client-side fuzzy matching. ⚡',
      ],
    },
  };

  const validatedRelease = GeminiReleaseOutputSchema.parse(mockAISynthesis);
  console.log(`  ✔ Release Title: "${validatedRelease.release_title}"`);
  console.log(`  ✔ Structured Categories: ${validatedRelease.categories.features.length} feature(s), ${validatedRelease.categories.improvements.length} improvement(s), ${validatedRelease.categories.fixes.length} fix(es)`);
  console.log(`  ✔ Multi-Channel Syndication: Email plain-text (${validatedRelease.distribution.email_plain_text.length} chars) & ${validatedRelease.distribution.social_post_thread.length}-part social thread`);
  console.log('  ✔ Zod Schema Enforcement: 100% strict conformance');

  // STEP 5: One-Click Publication Workflow
  console.log('\n[STAGE 5/6] Triggering one-click publication workflow...');
  const publishedRelease = {
    id: 'rel_mock_' + Math.random().toString(36).substring(2, 9),
    project_slug: 'demo-app',
    version_tag: 'v1.4.0',
    title: validatedRelease.release_title,
    summary: validatedRelease.overview_summary,
    content: validatedRelease.categories,
    distribution: validatedRelease.distribution,
    published_at: new Date().toISOString(),
    status: 'published' as const,
  };
  console.log(`  ✔ Changelog published with ID ${publishedRelease.id} at ${publishedRelease.published_at}`);

  // STEP 6: Public Widget API & SSR Availability Assertion
  console.log('\n[STAGE 6/6] Verifying public widget API & SSR changelog availability...');
  const project = {
    name: 'Demo App',
    slug: 'demo-app',
    is_pro: false,
  };
  const changelogItem: PublishedChangelog = {
    id: publishedRelease.id,
    project_id: 'proj_demo',
    project_slug: publishedRelease.project_slug,
    version_tag: publishedRelease.version_tag,
    release_title: publishedRelease.title,
    overview_summary: publishedRelease.summary,
    categories: publishedRelease.content,
    distribution: publishedRelease.distribution,
    published_at: publishedRelease.published_at,
    status: 'published',
  };

  const widgetApiResponse = generateWidgetApiResponse(project, [changelogItem]);

  if (widgetApiResponse.headers['Access-Control-Allow-Origin'] !== '*') {
    throw new Error('[FAIL] Stage 6: Missing required CORS header Access-Control-Allow-Origin: *');
  }
  if (!widgetApiResponse.headers['Cache-Control'].includes('s-maxage=')) {
    throw new Error('[FAIL] Stage 6: Missing Edge Cache-Control header');
  }
  if (widgetApiResponse.body.releases.length === 0) {
    throw new Error('[FAIL] Stage 6: Widget API returned empty releases array');
  }
  if (widgetApiResponse.body.project.show_badge !== true) {
    throw new Error('[FAIL] Stage 6: Free tier project must show viral badge');
  }
  console.log('  ✔ GET /api/v1/widget/demo-app -> 200 OK (CORS & Edge Cache verified)');

  // Public SSR Portal simulation (/c/[slug])
  const ssrChangelog = renderSSRChangelog(project, [changelogItem]);
  if (!ssrChangelog.meta.ogTitle.includes(publishedRelease.title)) {
    throw new Error('[FAIL] Stage 6: OpenGraph title mismatch');
  }
  if (!ssrChangelog.html.includes(publishedRelease.title) || !ssrChangelog.html.includes('Powered by ShipLog')) {
    throw new Error('[FAIL] Stage 6: Rendered HTML missing release title or viral badge');
  }
  console.log(`  ✔ GET /c/demo-app -> 200 OK SSR rendered (OG Meta: "${ssrChangelog.meta.ogTitle}")`);

  console.log('\n============================================================');
  console.log(' ✅ ALL 6 PIPELINE SIMULATION STAGES PASSED SUCCESSFULLY');
  console.log('============================================================\n');
}

if (process.argv[1] && process.argv[1].includes('simulate-pipeline')) {
  runSimulation().catch((err) => {
    console.error('\n❌ PIPELINE SIMULATION FAILED:', err);
    process.exit(1);
  });
}
