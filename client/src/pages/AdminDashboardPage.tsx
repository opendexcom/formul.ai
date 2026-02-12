import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/common';

const POLL_INTERVAL_MS = 200;
const MAX_POLL_MS = 30_000; // 30s cap to avoid unbounded polling if module never loads

/**
 * Page that mounts the EE Admin Dashboard (loaded via ee-dev-vite script from plugin).
 * Uses the client's VITE_API_BASE_URL for backend API calls.
 */
const AdminDashboardPage: React.FC = () => {
  const { user, loading } = useAuth();
  const unmountRef = useRef<(() => void) | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [adminLoadFailed, setAdminLoadFailed] = useState(false);

  // Expose backend API base URL for the embedded admin dashboard only when
  // the user is verified as admin. Non-enumerable to reduce discoverability
  // via window enumeration; removed on unmount or when user is no longer admin.
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
  const isAdmin = Boolean(user?.roles?.includes('admin'));
  useEffect(() => {
    const win = window as Window & { __FORMULAI_API_BASE_URL__?: string };
    if (loading || !isAdmin) {
      return () => {
        delete win.__FORMULAI_API_BASE_URL__;
      };
    }
    delete win.__FORMULAI_API_BASE_URL__;
    Object.defineProperty(win, '__FORMULAI_API_BASE_URL__', {
      value: apiBaseUrl,
      writable: false,
      configurable: true,
      enumerable: false,
    });
    return () => {
      delete win.__FORMULAI_API_BASE_URL__;
    };
  }, [apiBaseUrl, loading, isAdmin]);

  // Mount EE admin when ee-root is in the DOM and __ADMIN_MODULE__ is available.
  // Polling is capped at MAX_POLL_MS via a single timeout; only the timeout sets
  // adminLoadFailed so there is no race between interval and timeout.
  useEffect(() => {
    const tryMount = () => {
      const el = document.getElementById('ee-root');
      const adminModule = (window as any).__ADMIN_MODULE__;
      if (el && adminModule?.mount) {
        unmountRef.current = adminModule.mount(el);
        setAdminReady(true);
        return true;
      }
      return false;
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const stopPolling = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    if (!tryMount()) {
      interval = setInterval(() => {
        if (tryMount()) {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);

      timeout = setTimeout(() => {
        stopPolling();
        setAdminLoadFailed(true);
      }, MAX_POLL_MS);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
      if (typeof unmountRef.current === 'function') {
        unmountRef.current();
        unmountRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user?.roles?.includes('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header title="FormulAI" showUserMenu />
      <main className="flex-1">
        {!adminReady && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-gray-500 gap-2">
            {adminLoadFailed ? (
              <>
                <span>Admin dashboard could not be loaded.</span>
                <span className="text-sm">Ensure the admin plugin is loaded or try refreshing.</span>
              </>
            ) : (
              <span>Loading admin dashboard...</span>
            )}
          </div>
        )}
        <div id="ee-root" className="min-h-[calc(100vh-4rem)]" />
      </main>
    </div>
  );
};

export default AdminDashboardPage;
