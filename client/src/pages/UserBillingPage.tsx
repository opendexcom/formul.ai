import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/common';

const POLL_INTERVAL_MS = 200;
const MAX_POLL_MS = 30_000;

/**
 * Page that mounts the EE User Subscription page (billing/usage for current user).
 * Same injection pattern as AdminDashboardPage: polls for __BILLING_MODULE__, mounts into ee-billing-root.
 */
const UserBillingPage: React.FC = () => {
  const unmountRef = useRef<(() => void) | null>(null);
  const [billingReady, setBillingReady] = useState(false);
  const [billingLoadFailed, setBillingLoadFailed] = useState(false);

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;

  useEffect(() => {
    const win = window as Window & { __FORMULAI_API_BASE_URL__?: string };
    Object.defineProperty(win, '__FORMULAI_API_BASE_URL__', {
      value: apiBaseUrl,
      writable: false,
      configurable: true,
      enumerable: false,
    });
    return () => {
      delete win.__FORMULAI_API_BASE_URL__;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const tryMount = () => {
      const el = document.getElementById('ee-billing-root');
      const billingModule = (window as any).__BILLING_MODULE__;
      if (el && billingModule?.mount) {
        unmountRef.current = billingModule.mount(el);
        setBillingReady(true);
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
        setBillingLoadFailed(true);
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header title="FormulAI" showUserMenu />
      <main className="flex-1">
        {!billingReady && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-gray-500 gap-2">
            {billingLoadFailed ? (
              <>
                <span>Billing is available in FormulAI Enterprise.</span>
                <span className="text-sm">
                  If you use Enterprise, ensure the billing plugin is loaded or try refreshing.
                </span>
              </>
            ) : (
              <span>Loading subscription...</span>
            )}
          </div>
        )}
        <div id="ee-billing-root" className="min-h-[calc(100vh-4rem)]" />
      </main>
    </div>
  );
};

export default UserBillingPage;
