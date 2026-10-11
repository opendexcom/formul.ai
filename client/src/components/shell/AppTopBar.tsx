import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { useGlobalSearch } from './GlobalSearchContext';
import NotificationBell from './NotificationBell';

const AppTopBar: React.FC = () => {
  const { openSearch } = useGlobalSearch();
  const { pathname } = useLocation();
  const inStudy = pathname.startsWith('/projects/');

  return (
    <header
      className={`flex h-16 shrink-0 items-center border-b border-gray-200 bg-white px-8 ${
        inStudy ? 'justify-between' : 'justify-end'
      }`}
    >
      {inStudy && (
        <Link
          to="/overview#studies"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to studies
        </Link>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <NotificationBell />
      </div>
    </header>
  );
};

export default AppTopBar;
