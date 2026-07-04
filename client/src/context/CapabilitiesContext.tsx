import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl';

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
    fetch(`${resolveApiBaseUrl()}/capabilities`)
      .then((res) => (res.ok ? res.json() : { features: [] }))
      .then((data: { features?: string[] }) => setFeatures(data.features ?? []))
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
