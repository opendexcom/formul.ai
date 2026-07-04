import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';
import GlobalSearch from './GlobalSearch';
import { GlobalSearchProvider } from './GlobalSearchContext';

const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <GlobalSearchProvider>
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />
          <main className="min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalSearch />
    </GlobalSearchProvider>
  );
};

export default AppShell;
