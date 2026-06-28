import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCapabilities } from '../../context/CapabilitiesContext';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const inputClass =
  'block rounded-lg px-3 py-2 text-sm font-medium transition';

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const { hasFeature } = useCapabilities();

  const navItems = [
    { label: 'Profile', to: '/settings/preferences' },
    ...(hasFeature('billing')
      ? [{ label: 'Billing', to: '/settings/billing' }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white px-5 py-8 lg:block">
          <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Settings
          </h2>
          <nav aria-label="User settings" className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${inputClass} ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SettingsLayout;
