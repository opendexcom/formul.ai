import React, { useEffect, useRef, useState } from 'react';
import { Route } from 'react-router-dom';
import type { PluginRouteDefinition } from './types';

const POLL_MS = 100;
const MAX_POLL_MS = 15_000;

type PluginRouteHostProps = {
  path: string;
};

const PluginRouteHost: React.FC<PluginRouteHostProps> = ({ path }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const route = window.__FORMULAI_UI__?.routes?.find((r) => r.path === path);
    if (!route) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tryMount = () => {
      if (unmountRef.current) return true;
      unmountRef.current = route.mount(container);
      return true;
    };

    if (!tryMount()) {
      interval = setInterval(() => {
        if (tryMount() && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, POLL_MS);
      timeout = setTimeout(() => {
        if (interval) clearInterval(interval);
      }, MAX_POLL_MS);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      unmountRef.current?.();
      unmountRef.current = null;
    };
  }, [path]);

  return <div ref={containerRef} className="min-h-screen" />;
};

const PluginRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<PluginRouteDefinition[]>(
    () => window.__FORMULAI_UI__?.routes ?? [],
  );

  useEffect(() => {
    const poll = () => {
      const next = window.__FORMULAI_UI__?.routes ?? [];
      setRoutes((prev) =>
        prev.length === next.length && prev.every((r, i) => r.path === next[i]?.path)
          ? prev
          : next,
      );
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    const timeout = setTimeout(() => clearInterval(interval), MAX_POLL_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (routes.length === 0) return null;

  return (
    <>
      {routes.map((route) => (
        <Route key={route.path} path={route.path} element={<PluginRouteHost path={route.path} />} />
      ))}
    </>
  );
};

export default PluginRoutes;
