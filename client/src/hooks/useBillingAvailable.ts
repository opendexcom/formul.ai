import { useEffect, useState } from 'react';
import { useCapabilities } from '../context/CapabilitiesContext';
import { FORMULAI_UI_READY_EVENT, getFormulaiUiManifest } from '../plugins/types';

/** True when EE registered billing routes in the UI manifest. */
export function hasBillingInManifest(): boolean {
  const routes = getFormulaiUiManifest()?.routes ?? [];
  return routes.some(
    (route) =>
      route.requiresFeature === 'billing' ||
      route.path.startsWith('/settings/billing'),
  );
}

function isEeDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__FORMULAI_EE__ === true) return true;
  return hasBillingInManifest();
}

/**
 * Billing + usage UI should appear when the EE plugin is active.
 * Falls back to the EE UI manifest when /capabilities is empty or slow.
 */
export function useBillingAvailable(): boolean {
  const { hasFeature, loading } = useCapabilities();
  const [manifestBilling, setManifestBilling] = useState(hasBillingInManifest);

  useEffect(() => {
    const sync = () => setManifestBilling(hasBillingInManifest());
    sync();
    window.addEventListener(FORMULAI_UI_READY_EVENT, sync);
    return () => window.removeEventListener(FORMULAI_UI_READY_EVENT, sync);
  }, []);

  if (hasFeature('billing') || hasFeature('usage-limits')) {
    return true;
  }

  if (manifestBilling || isEeDeployment()) {
    return true;
  }

  // While capabilities load, keep billing visible in EE builds.
  if (loading && isEeDeployment()) {
    return true;
  }

  return false;
}

export function isBillingRouteAllowed(
  requiresFeature: string | undefined,
  hasFeature: (feature: string) => boolean,
): boolean {
  if (!requiresFeature) return true;
  if (requiresFeature === 'billing') {
    return (
      hasFeature('billing') ||
      hasFeature('usage-limits') ||
      hasBillingInManifest() ||
      (typeof window !== 'undefined' && window.__FORMULAI_EE__ === true)
    );
  }
  return hasFeature(requiresFeature);
}
