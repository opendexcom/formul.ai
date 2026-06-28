import { useEffect, useState } from 'react';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';

export interface UsageLimitsState {
  loading: boolean;
  loaded: boolean;
  enforced: boolean;
  tokensExceeded: boolean;
  formsExceeded: boolean;
}

const DEFAULT_STATE: UsageLimitsState = {
  loading: true,
  loaded: false,
  enforced: false,
  tokensExceeded: false,
  formsExceeded: false,
};

interface UsageStatsResponse {
  tokens?: {
    exceeded?: boolean;
    unlimited?: boolean;
  };
  forms?: {
    exceeded?: boolean;
  };
  current?: {
    tokensUsed?: number;
    quotaLimit?: number;
    percentageUsed?: number;
  };
}

function parseUsageLimits(data: UsageStatsResponse): {
  tokensExceeded: boolean;
  formsExceeded: boolean;
} {
  const tokensExceeded =
    data.tokens?.exceeded === true ||
    (data.tokens?.unlimited !== true &&
      !!data.current?.quotaLimit &&
      (data.current.tokensUsed ?? 0) >= data.current.quotaLimit) ||
    (data.current?.percentageUsed ?? 0) >= 100;

  const formsExceeded = data.forms?.exceeded === true;

  return { tokensExceeded, formsExceeded };
}

export function useUsageLimits(): UsageLimitsState {
  const [state, setState] = useState<UsageLimitsState>(DEFAULT_STATE);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState({
        loading: false,
        loaded: true,
        enforced: false,
        tokensExceeded: false,
        formsExceeded: false,
      });
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${resolveApiBaseUrl()}/usage/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (response.status === 404) {
          setState({
            loading: false,
            loaded: true,
            enforced: false,
            tokensExceeded: false,
            formsExceeded: false,
          });
          return;
        }

        if (!response.ok) {
          setState({
            loading: false,
            loaded: true,
            enforced: false,
            tokensExceeded: false,
            formsExceeded: false,
          });
          return;
        }

        const data = (await response.json()) as UsageStatsResponse;
        const { tokensExceeded, formsExceeded } = parseUsageLimits(data);
        setState({
          loading: false,
          loaded: true,
          enforced: true,
          tokensExceeded,
          formsExceeded,
        });
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            loaded: true,
            enforced: false,
            tokensExceeded: false,
            formsExceeded: false,
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
