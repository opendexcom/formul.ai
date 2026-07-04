import React from 'react';
import { NavLink } from 'react-router-dom';
import { useBillingAvailable } from '../../hooks/useBillingAvailable';
import { shellSubNavLinkClass } from './design-tokens';

const SettingsSubNav: React.FC = () => {
  const hasBilling = useBillingAvailable();

  const items = [
    { to: '/settings/preferences', label: 'Profile' },
    ...(hasBilling ? [{ to: '/settings/billing', label: 'Billing & usage' }] : []),
  ];

  return (
    <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${shellSubNavLinkClass} ${
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
  );
};

export default SettingsSubNav;
