import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CreditCard, LogOut, Settings, Shield, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { useBillingAvailable } from '../../hooks/useBillingAvailable';
import {
  formatUsageLine,
  resolveProjectUsage,
  resolveTokenUsage,
  usePlanUsageSnapshot,
} from '../../hooks/usePlanUsageSnapshot';

const UserAvatarMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { hasFeature } = useCapabilities();
  const hasBilling = useBillingAvailable();
  const { billingEnabled, loading: planLoading, planName, usage } = usePlanUsageSnapshot();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const isAdmin = user?.roles?.includes('admin');
  const tokens = resolveTokenUsage(usage);
  const projects = resolveProjectUsage(usage);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 transition hover:bg-gray-100"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-sm text-gray-700 sm:inline">
          Welcome, {user?.firstName}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
            {billingEnabled && (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Plan
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {planLoading ? 'Loading…' : planName}
                </p>
                {!planLoading && usage && (
                  <dl className="mt-2 space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between gap-2">
                      <dt>AI tokens</dt>
                      <dd className="text-right text-gray-900">
                        {formatUsageLine(tokens.used, tokens.limit, tokens.unlimited)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Studies</dt>
                      <dd className="text-right text-gray-900">
                        {formatUsageLine(projects.used, projects.limit, projects.unlimited)}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => go('/settings/preferences')}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <User className="h-4 w-4" /> Profile
          </button>
          <button
            type="button"
            onClick={() => go('/settings/preferences')}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
          {hasBilling && (
            <button
              type="button"
              onClick={() => go('/settings/billing')}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <CreditCard className="h-4 w-4" /> Billing & usage
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => go(hasFeature('admin') ? '/admin' : '/admin/settings')}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Shield className="h-4 w-4" /> Admin
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserAvatarMenu;
