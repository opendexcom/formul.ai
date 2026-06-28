import React, { useEffect, useRef } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCapabilities } from '../context/CapabilitiesContext';
import { Header } from '../components/common';
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

  return <div ref={containerRef} className="min-h-screen" />;
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!route.public && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (route.requiresFeature && !hasFeature(route.requiresFeature)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (route.requiresRole && !user?.roles?.includes(route.requiresRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function usePluginRoutes(): React.ReactNode {
  const [routes, setRoutes] = React.useState<PluginRouteDefinition[]>(
    () => getFormulaiUiManifest()?.routes ?? [],
  );

  useEffect(() => {
    const sync = () => setRoutes(getFormulaiUiManifest()?.routes ?? []);
    sync();
    window.addEventListener(FORMULAI_UI_READY_EVENT, sync);
    return () => window.removeEventListener(FORMULAI_UI_READY_EVENT, sync);
  }, []);

  if (routes.length === 0) return null;

  return routes.map((route) => {
    const routeElement = (
      <PluginProtectedRoute route={route}>
        <PluginRouteHost path={route.path} />
      </PluginProtectedRoute>
    );

    return (
      <Route
        key={route.path}
        path={route.path}
        element={
          route.path.startsWith('/settings/billing') ? (
            <>
              <Header title="FormulAI" />
              {routeElement}
            </>
          ) : (
            routeElement
          )
        }
      />
    );
  });
}
