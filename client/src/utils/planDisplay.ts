export function formatPlanKey(planKey?: string | null): string {
  if (!planKey) return 'Free';
  return planKey
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export interface BillingPlanOption {
  key: string;
  name: string;
}

export function resolvePlanDisplayName(
  planKey: string | undefined | null,
  plans: BillingPlanOption[],
): string {
  if (!planKey) return 'Free';
  const list = Array.isArray(plans) ? plans : [];
  return list.find((plan) => plan.key === planKey)?.name ?? formatPlanKey(planKey);
}

interface BillingPlansResponse {
  plans?: BillingPlanOption[];
}

export interface BillingSubscriptionResponse {
  subscription?: {
    plan?: string;
  } | null;
}

export interface UsageStatsSnapshot {
  current?: {
    planTier?: string;
    tokensUsed?: number;
    quotaLimit?: number;
  };
  tokens?: {
    used?: number;
    limit?: number | null;
    unlimited?: boolean;
  };
  projects?: {
    used?: number;
    limit?: number | null;
    percentageUsed?: number;
  };
}

export async function fetchPlanUsageSnapshot(
  apiBaseUrl: string,
  token: string,
): Promise<{
  usage: UsageStatsSnapshot | null;
  planName: string;
}> {
  const headers = { Authorization: `Bearer ${token}` };

  const [usageRes, plansRes, subscriptionRes] = await Promise.all([
    fetch(`${apiBaseUrl}/usage/stats`, { headers }),
    fetch(`${apiBaseUrl}/billing/plans`, { headers }),
    fetch(`${apiBaseUrl}/billing/subscription`, { headers }),
  ]);

  const usage = usageRes.ok ? ((await usageRes.json()) as UsageStatsSnapshot) : null;

  let plans: BillingPlanOption[] = [];
  if (plansRes.ok) {
    const payload = (await plansRes.json()) as BillingPlanOption[] | BillingPlansResponse;
    plans = Array.isArray(payload) ? payload : (payload.plans ?? []);
  }

  const subscription = subscriptionRes.ok
    ? ((await subscriptionRes.json()) as BillingSubscriptionResponse)
    : null;

  const planKey = subscription?.subscription?.plan ?? usage?.current?.planTier;
  const planName = resolvePlanDisplayName(planKey, plans);

  return { usage, planName };
}
