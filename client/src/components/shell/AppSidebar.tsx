import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { useBillingAvailable } from '../../hooks/useBillingAvailable';
import SidebarPlanWidget from './SidebarPlanWidget';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-blue-50 text-blue-700'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { hasFeature } = useCapabilities();
  const { user } = useAuth();
  const hasBilling = useBillingAvailable();
  const isAdmin = user?.roles?.includes('admin');
  const hasAdminFeature = hasFeature('admin');

  const mainNav = [
    { to: '/overview', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/overview#studies', label: 'Studies', icon: FileText, end: false },
    { to: '/integrations', label: 'Integrations', icon: Link2, end: true },
    { to: '/settings/preferences', label: 'Settings', icon: Settings, end: false },
  ];

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-gray-50 transition-all duration-200 ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      <div className={`flex h-16 shrink-0 items-center border-b border-gray-200 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <button
          type="button"
          onClick={() => (window.location.href = '/overview')}
          className="flex items-center gap-2 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <FileText className="h-5 w-5" />
          </span>
          {!collapsed && <span className="text-lg font-semibold text-gray-900">FormulAI</span>}
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navLinkClass}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to={hasAdminFeature ? '/admin' : '/admin/settings'}
            className={navLinkClass}
            title={collapsed ? 'Admin' : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Admin</span>}
          </NavLink>
        )}
      </nav>

      <div className="mt-auto shrink-0 border-t border-gray-200">
        <SidebarPlanWidget collapsed={collapsed} />

        <div className="space-y-1 px-3 py-3">
        {hasBilling && (
          <NavLink
            to="/settings/billing"
            className={navLinkClass}
            title={collapsed ? 'Billing' : undefined}
          >
            <CreditCard className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Billing</span>}
          </NavLink>
        )}
        <NavLink
          to="/help"
          className={navLinkClass}
          title={collapsed ? 'Help & Support' : undefined}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Help & Support</span>}
        </NavLink>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronsLeft className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
