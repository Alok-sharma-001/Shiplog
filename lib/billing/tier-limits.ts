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

export const TIER_LIMITS = {
  free: {
    max_repos: 1,
    max_monthly_releases: 2,
    white_label: false,
    custom_domain: false,
  },
  pro: {
    max_repos: Infinity,
    max_monthly_releases: Infinity,
    white_label: true,
    custom_domain: true,
  },
} as const;

export function checkCanConnectRepo(tenant: TenantTierInfo): FeatureGateVerdict {
  if (tenant.tier === 'pro') {
    return { allowed: true };
  }
  if (tenant.active_repos_count >= TIER_LIMITS.free.max_repos) {
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
  if (tenant.monthly_releases_count >= TIER_LIMITS.free.max_monthly_releases) {
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
