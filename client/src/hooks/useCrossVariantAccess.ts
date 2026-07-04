import { useEffect, useState } from 'react';
import { useCapabilities } from '../context/CapabilitiesContext';
import { useBillingAvailable } from './useBillingAvailable';
import { createApiClient } from '../services/apiClient';

const PLAN_HIERARCHY = ['basic', 'advanced', 'pro', 'enterprise'];
const MINIMUM_PLAN = 'pro';
const CROSS_VARIANT_FEATURE = 'cross-variant-analysis';

function normalizePlan(plan: string | null | undefined): string {
  return (plan ?? 'basic').trim().toLowerCase();
}

export type CrossVariantAccessReason = 'loading' | 'available' | 'not_ee' | 'plan_required';

export interface CrossVariantAccessState {
  loading: boolean;
  available: boolean;
  plan: string | null;
  reason: CrossVariantAccessReason;
}

function hasRequiredPlan(userPlan: string, requiredPlan: string): boolean {
  const userPlanIndex = PLAN_HIERARCHY.indexOf(userPlan);
  const requiredPlanIndex = PLAN_HIERARCHY.indexOf(requiredPlan);
  if (userPlanIndex < 0 || requiredPlanIndex < 0) return false;
  return userPlanIndex >= requiredPlanIndex;
}

export function useCrossVariantAccess(): CrossVariantAccessState {
  const { hasFeature, loading: capsLoading } = useCapabilities();
  const [plan, setPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // EE-only: billing capability is always present when the EE plugin is loaded.
  // cross-variant-analysis is registered alongside it; accept either for resilience
  // when the server hot-reloads before the latest plugin build is picked up.
  const billingAvailable = useBillingAvailable();
  const hasEeFeature =
    hasFeature(CROSS_VARIANT_FEATURE) || hasFeature('billing') || billingAvailable;
  const hasBilling = billingAvailable;

  useEffect(() => {
    if (capsLoading) return;

    if (!hasEeFeature || !hasBilling) {
      setPlan(null);
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);

    createApiClient()
      .get<{ subscription?: { plan?: string } | null }>('/billing/subscription')
      .then((res) => {
        if (cancelled) return;
        setPlan(normalizePlan(res.data?.subscription?.plan ?? 'basic'));
      })
      .catch(() => {
        if (!cancelled) setPlan('basic');
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [capsLoading, hasEeFeature, hasBilling]);

  const loading = capsLoading || (hasEeFeature && hasBilling && planLoading);

  if (loading) {
    return { loading: true, available: false, plan: null, reason: 'loading' };
  }

  if (!hasEeFeature) {
    return { loading: false, available: false, plan: null, reason: 'not_ee' };
  }

  const resolvedPlan = normalizePlan(plan ?? 'basic');
  if (!hasRequiredPlan(resolvedPlan, MINIMUM_PLAN)) {
    return {
      loading: false,
      available: false,
      plan: resolvedPlan,
      reason: 'plan_required',
    };
  }

  return {
    loading: false,
    available: true,
    plan: resolvedPlan,
    reason: 'available',
  };
}
