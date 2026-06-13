import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { createApiClient } from '../services/apiClient';

type CapabilitiesContextValue = {
  features: string[];
  loading: boolean;
  hasFeature: (feature: string) => boolean;
};

const CapabilitiesContext = createContext<CapabilitiesContextValue>({
  features: [],
  loading: true,
  hasFeature: () => false,
});

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createApiClient();
    client
      .get<{ features?: string[] }>('/capabilities')
      .then((res) => setFeatures(res.data.features ?? []))
      .catch(() => setFeatures([]))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      features,
      loading,
      hasFeature: (feature: string) => features.includes(feature),
    }),
    [features, loading],
  );

  return (
    <CapabilitiesContext.Provider value={value}>
      {children}
    </CapabilitiesContext.Provider>
  );
}

export function useCapabilities(): CapabilitiesContextValue {
  return useContext(CapabilitiesContext);
}
