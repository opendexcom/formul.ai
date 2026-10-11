import { useEffect, useState } from 'react';
import { useCapabilities } from '../context/CapabilitiesContext';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';
import {
  fetchPlanUsageSnapshot,
  type UsageStatsSnapshot,
} from '../utils/planDisplay';
import { useBillingAvailable } from './useBillingAvailable';

export interface PlanUsageSnapshotState {
  billingEnabled: boolean;
  loading: boolean;
  planName: string;
  usage: UsageStatsSnapshot | null;
}

const INITIAL: PlanUsageSnapshotState = {
  billingEnabled: false,
  loading: true,
  planName: 'Free',
  usage: null,
};

export function usePlanUsageSnapshot(): PlanUsageSnapshotState {
  const billingEnabled = useBillingAvailable();
  const { features } = useCapabilities();
  const [state, setState] = useState<PlanUsageSnapshotState>(INITIAL);

  useEffect(() => {
    if (!billingEnabled) {
      setState({
        billingEnabled: false,
        loading: false,
        planName: 'Free',
        usage: null,
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setState({
        billingEnabled: true,
        loading: false,
        planName: 'Free',
        usage: null,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, billingEnabled: true, loading: true }));

    void fetchPlanUsageSnapshot(resolveApiBaseUrl(), token)
      .then((snapshot) => {
        if (cancelled) return;
        setState({
          billingEnabled: true,
          loading: false,
          planName: snapshot.planName,
          usage: snapshot.usage,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          billingEnabled: true,
          loading: false,
          planName: 'Free',
          usage: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [billingEnabled, features.join('|')]);

  return { ...state, billingEnabled };
}

export function formatUsageLine(
  used: number,
  limit: number | null | undefined,
  unlimited: boolean,
): string {
  if (unlimited || limit == null) {
    return `${used.toLocaleString()} · Unlimited`;
  }
  return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
}

export function resolveTokenUsage(usage: UsageStatsSnapshot | null): {
  used: number;
  limit: number | null;
  unlimited: boolean;
  percentage: number;
} {
  const unlimited = usage?.tokens?.unlimited === true;
  const limit = unlimited
    ? null
    : (usage?.tokens?.limit ?? usage?.current?.quotaLimit ?? null);
  const used = usage?.tokens?.used ?? usage?.current?.tokensUsed ?? 0;
  const percentage =
    unlimited || limit == null || limit <= 0
      ? 0
      : Math.min(100, Math.round((used / limit) * 100));
  return { used, limit, unlimited, percentage };
}

export function resolveProjectUsage(usage: UsageStatsSnapshot | null): {
  used: number;
  limit: number | null;
  unlimited: boolean;
  percentage: number;
} {
  const used = usage?.projects?.used ?? 0;
  const limit = usage?.projects?.limit ?? null;
  const unlimited = limit == null;
  const percentage =
    unlimited || limit <= 0
      ? 0
      : Math.min(100, Math.round((used / limit) * 100));
  return { used, limit, unlimited, percentage };
}
