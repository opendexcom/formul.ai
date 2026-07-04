import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCapabilities } from '../../context/CapabilitiesContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navLinkClass =
  'block rounded-lg px-3 py-2 text-sm font-medium transition';

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { hasFeature } = useCapabilities();
  const isAdmin = user?.roles?.includes('admin');
  const hasAdminFeature = hasFeature('admin');

  const queueMonitorUrl = `${window.location.origin}/api/admin/queues`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white px-5 py-8 lg:block">
          <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Admin
          </h2>
          <nav aria-label="Admin settings" className="space-y-1">
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                `${navLinkClass} ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              Platform Settings
            </NavLink>
            {hasAdminFeature && (
              <>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    `${navLinkClass} ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  Overview
                </NavLink>
                <NavLink
                  to="/admin/plans"
                  className={({ isActive }) =>
                    `${navLinkClass} ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  Plans & Usage
                </NavLink>
              </>
            )}
            {isAdmin && (
              <a
                href={queueMonitorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${navLinkClass} text-gray-600 hover:bg-gray-50 hover:text-gray-900`}
              >
                Queue Monitor
              </a>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
