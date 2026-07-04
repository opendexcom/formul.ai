import React, { useEffect, useRef } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCapabilities } from '../context/CapabilitiesContext';
import { isBillingRouteAllowed } from '../hooks/useBillingAvailable';
import {
  FORMULAI_UI_READY_EVENT,
  getFormulaiUiManifest,
  type PluginRouteDefinition,
} from './types';
export { usePluginNav } from './pluginNavigation';

type PluginRouteHostProps = {
  path: string;
};

const PluginRouteHost: React.FC<PluginRouteHostProps> = ({ path }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mountRoute = () => {
      const container = containerRef.current;
      const route = getFormulaiUiManifest()?.routes?.find((r) => r.path === path);
      if (!container || !route || unmountRef.current) return;

      unmountRef.current = route.mount(container);
    };

    mountRoute();
    const onReady = () => mountRoute();
    window.addEventListener(FORMULAI_UI_READY_EVENT, onReady);
    return () => {
      window.removeEventListener(FORMULAI_UI_READY_EVENT, onReady);
      unmountRef.current?.();
      unmountRef.current = null;
    };
  }, [path]);

  return <div ref={containerRef} className="min-h-[200px]" />;
};

function PluginProtectedRoute({
  route,
  children,
}: {
  route: PluginRouteDefinition;
  children: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const { hasFeature, loading: capsLoading } = useCapabilities();

  if (loading || capsLoading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!route.public && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (route.requiresFeature && !isBillingRouteAllowed(route.requiresFeature, hasFeature)) {
    return <Navigate to="/overview" replace />;
  }

  if (route.requiresRole && !user?.roles?.includes(route.requiresRole)) {
    return <Navigate to="/overview" replace />;
  }

  return <>{children}</>;
}

function useManifestRoutes(): PluginRouteDefinition[] {
  const [routes, setRoutes] = React.useState<PluginRouteDefinition[]>(
    () => getFormulaiUiManifest()?.routes ?? [],
  );

  useEffect(() => {
    const sync = () => setRoutes(getFormulaiUiManifest()?.routes ?? []);
    sync();
    window.addEventListener(FORMULAI_UI_READY_EVENT, sync);
    return () => window.removeEventListener(FORMULAI_UI_READY_EVENT, sync);
  }, []);

  return routes;
}

type PluginRouteOptions = {
  publicOnly?: boolean;
  authenticatedOnly?: boolean;
};

function filterRoutes(
  routes: PluginRouteDefinition[],
  options?: PluginRouteOptions,
): PluginRouteDefinition[] {
  if (options?.publicOnly) {
    return routes.filter((route) => route.public);
  }
  if (options?.authenticatedOnly) {
    return routes.filter((route) => !route.public);
  }
  return routes;
}

export function usePluginRoutes(options?: PluginRouteOptions): React.ReactNode {
  const routes = filterRoutes(useManifestRoutes(), options);

  if (routes.length === 0) return null;

  return routes.map((route) => (
    <Route
      key={route.path}
      path={route.path.replace(/^\//, '')}
      element={
        <PluginProtectedRoute route={route}>
          <PluginRouteHost path={route.path} />
        </PluginProtectedRoute>
      }
    />
  ));
}

export function usePublicPluginRoutes(): React.ReactNode {
  return usePluginRoutes({ publicOnly: true });
}

export function useAuthenticatedPluginRoutes(): React.ReactNode {
  return usePluginRoutes({ authenticatedOnly: true });
}
