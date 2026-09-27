import { z } from 'zod';

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

export interface PRForSynthesis {
  pr_number: number;
  title: string;
  body?: string | null;
  author?: string;
}

export class GeminiSynthesisService {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  async synthesize(prs: PRForSynthesis[], versionTag: string): Promise<GeminiReleaseOutput> {
    // If no live key or mock key configured, perform deterministic synthesis
    if (!this.apiKey || this.apiKey.startsWith('mock') || this.apiKey === 'test') {
      return this.synthesizeDeterministic(prs, versionTag);
    }

    try {
      // Live Google Gemini 1.5 Flash structured inference
      const prompt = `You are an expert product marketing engineer and technical release writer.
Your function is to translate raw software development inputs (merged pull requests) into customer-facing release notes.

OPERATIONAL RULES:
1. Strict Factuality: Document ONLY functionality explicitly detailed in the source input. Do not infer unstated features.
2. Customer-Centric Framing: Translate technical implementations into clear user benefits. Explain WHAT changed and WHY it matters.
3. Noise Suppression: Ignore internal code refactors, test coverage, and dependency bumps unless they directly affect user experience.
4. Structured Categorization: Group updates into three explicit categories: 'features', 'improvements', and 'fixes'.
5. Multi-Channel Copy: Generate a plain-text email summary and a structured numbered X (Twitter) thread.

Merged PRs for release ${versionTag}:
${prs.map((p) => `- PR #${p.pr_number} by @${p.author || 'contributor'}: ${p.title}\n  Body: ${p.body || 'No description'}`).join('\n\n')}

Return strictly valid JSON matching the schema.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn(`[WARN] Gemini API error (${response.status}), falling back to deterministic synthesis`);
        return this.synthesizeDeterministic(prs, versionTag);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return this.synthesizeDeterministic(prs, versionTag);
      }

      const parsedJson = JSON.parse(rawText);
      return GeminiReleaseOutputSchema.parse(parsedJson);
    } catch (err) {
      console.warn('[WARN] Error calling live Gemini API, using deterministic synthesis:', err);
      return this.synthesizeDeterministic(prs, versionTag);
    }
  }

  private synthesizeDeterministic(prs: PRForSynthesis[], versionTag: string): GeminiReleaseOutput {
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

    const firstFeatureTitle = features[0]?.title || improvements[0]?.title || fixes[0]?.title || 'Release Updates';
    const releaseOutput: GeminiReleaseOutput = {
      release_title: `${versionTag} — ${firstFeatureTitle}`,
      overview_summary: `This release introduces ${features.length} new feature(s), ${improvements.length} improvement(s), and ${fixes.length} bug fix(es) to improve your experience.`,
      categories: {
        features,
        improvements,
        fixes,
      },
      distribution: {
        email_plain_text: `Hey everyone!\n\nShipLog ${versionTag} is live! Includes ${features.length} features, ${improvements.length} improvements, and ${fixes.length} fixes.\n\nCheck out the full changelog on our portal!`,
        social_post_thread: [
          `🚀 ShipLog ${versionTag} is here! Highlights: ${features.map((f) => f.title).join(', ') || 'Speed and reliability updates'}.`,
          `Check out the full release notes and update your widget now! 📦`,
        ],
      },
    };

    return GeminiReleaseOutputSchema.parse(releaseOutput);
  }
}
