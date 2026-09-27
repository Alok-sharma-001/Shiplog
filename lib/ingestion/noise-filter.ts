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

/**
 * Evaluates whether a merged GitHub PR represents engineering noise
 * that should be excluded from user-facing release notes.
 */
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
