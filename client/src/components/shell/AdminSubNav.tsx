import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { shellSubNavLinkClass } from './design-tokens';

const AdminSubNav: React.FC = () => {
  const { hasFeature } = useCapabilities();
  const hasAdminFeature = hasFeature('admin');

  const items = [
    { to: '/admin/settings', label: 'Platform settings' },
    ...(hasAdminFeature
      ? [
          { to: '/admin', label: 'Overview' },
          { to: '/admin/plans', label: 'Plans & usage' },
        ]
      : []),
  ];

  return (
    <nav aria-label="Admin sections" className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/admin'}
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

export default AdminSubNav;
