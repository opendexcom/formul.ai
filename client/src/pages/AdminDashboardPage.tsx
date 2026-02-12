import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/common';

/**
 * Page that mounts the EE Admin Dashboard (loaded via ee-dev-vite script from plugin).
 * Uses the client's VITE_API_BASE_URL for backend API calls.
 */
const AdminDashboardPage: React.FC = () => {
  const { user, loading } = useAuth();
  const unmountRef = useRef<(() => void) | null>(null);
  const [adminReady, setAdminReady] = useState(false);

  // Expose backend API base URL for the embedded admin dashboard
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
  useEffect(() => {
    (window as any).__FORMULAI_API_BASE_URL__ = apiBaseUrl;
    return () => {
      delete (window as any).__FORMULAI_API_BASE_URL__;
    };
  }, [apiBaseUrl]);

  // Mount EE admin when ee-root is in the DOM and __ADMIN_MODULE__ is available
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
    if (!tryMount()) {
      interval = setInterval(() => {
        if (tryMount() && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 200);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
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
          <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-gray-500">
            Loading admin dashboard...
          </div>
        )}
        <div id="ee-root" className="min-h-[calc(100vh-4rem)]" />
      </main>
    </div>
  );
};

export default AdminDashboardPage;
