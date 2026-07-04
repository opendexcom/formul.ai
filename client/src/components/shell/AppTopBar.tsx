import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useGlobalSearch } from './GlobalSearchContext';
import NotificationBell from './NotificationBell';
import UserAvatarMenu from './UserAvatarMenu';
import { usePlanUsageSnapshot } from '../../hooks/usePlanUsageSnapshot';

const AppTopBar: React.FC = () => {
  const { openSearch } = useGlobalSearch();
  const { billingEnabled, loading, planName } = usePlanUsageSnapshot();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 transition hover:border-gray-300 hover:bg-white"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search studies…</span>
          <kbd className="hidden rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-400 sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {billingEnabled && (
          <Link
            to="/settings/billing"
            className="hidden rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 sm:inline-flex"
            title="View billing and usage"
          >
            {loading ? 'Plan…' : planName}
          </Link>
        )}
        <NotificationBell />
        <UserAvatarMenu />
      </div>
    </header>
  );
};

export default AppTopBar;
