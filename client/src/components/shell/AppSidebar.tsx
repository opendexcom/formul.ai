import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Settings,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { useBillingAvailable } from '../../hooks/useBillingAvailable';
import SidebarPlanWidget from './SidebarPlanWidget';
import UserAvatarMenu from './UserAvatarMenu';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { hasFeature } = useCapabilities();
  const { user } = useAuth();
  const hasBilling = useBillingAvailable();
  const location = useLocation();
  const isAdmin = user?.roles?.includes('admin');
  const hasAdminFeature = hasFeature('admin');

  const itemClass = (active: boolean) =>
    `flex items-center rounded-lg text-sm transition ${
      collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
    } ${
      active
        ? 'bg-blue-50 font-semibold text-blue-600'
        : 'font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const overviewActive = location.pathname === '/overview' && location.hash !== '#studies';
  const studiesActive =
    (location.pathname === '/overview' && location.hash === '#studies') ||
    location.pathname.startsWith('/projects/');
  const integrationsActive = location.pathname === '/integrations';
  const settingsActive =
    location.pathname.startsWith('/settings') &&
    !location.pathname.startsWith('/settings/billing');
  const billingActive = location.pathname.startsWith('/settings/billing');
  const adminActive = location.pathname.startsWith('/admin');
  const helpActive = location.pathname === '/help';

  const primaryNav = [
    { to: '/overview', label: 'Overview', icon: LayoutDashboard, active: overviewActive },
    { to: '/overview#studies', label: 'Studies', icon: FileText, active: studiesActive },
    { to: '/integrations', label: 'Integrations', icon: Link2, active: integrationsActive },
  ];

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-gray-200 bg-gray-50 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center ${
          collapsed ? 'justify-center gap-0.5 px-1' : 'justify-between pr-3'
        }`}
      >
        <Link
          to="/overview"
          className={`flex items-center text-left ${collapsed ? '' : 'gap-2 px-5'}`}
          title="FormulAI"
        >
          <span
            className={`flex items-center justify-center rounded-lg bg-blue-600 text-white ${
              collapsed ? 'h-8 w-8' : 'h-9 w-9'
            }`}
          >
            <FileText className={collapsed ? 'h-4 w-4' : 'h-5 w-5'} />
          </span>
          {!collapsed && (
            <span className="text-lg font-semibold leading-7 text-gray-900">FormulAI</span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 ${
            collapsed ? 'h-8 w-8' : 'h-8 w-8'
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-6 w-6" />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-1" aria-label="Main navigation">
        <div className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={itemClass(item.active)}
              title={collapsed ? item.label : undefined}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>

        <div className={collapsed ? 'mt-4 flex flex-col gap-1' : 'flex flex-col gap-1 pt-4'}>
          {!collapsed && (
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.5px] text-gray-400">
              MANAGEMENT
            </p>
          )}
          <Link
            to="/settings/preferences"
            className={itemClass(settingsActive)}
            title={collapsed ? 'Settings' : undefined}
            aria-current={settingsActive ? 'page' : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
          {hasBilling && (
            <Link
              to="/settings/billing"
              className={itemClass(billingActive)}
              title={collapsed ? 'Billing' : undefined}
              aria-current={billingActive ? 'page' : undefined}
            >
              <CreditCard className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Billing</span>}
            </Link>
          )}
          {isAdmin && (
            <Link
              to={hasAdminFeature ? '/admin' : '/admin/settings'}
              className={itemClass(adminActive)}
              title={collapsed ? 'Admin' : undefined}
              aria-current={adminActive ? 'page' : undefined}
            >
              <Shield className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
        </div>
      </nav>

      <div className={`shrink-0 ${collapsed ? 'px-2 pb-3' : 'px-4 pb-3'}`}>
        <SidebarPlanWidget collapsed={collapsed} />
      </div>

      <div className="shrink-0 border-t border-gray-200 p-3">
        <Link
          to="/help"
          className={itemClass(helpActive)}
          title={collapsed ? 'Help & Support' : undefined}
          aria-current={helpActive ? 'page' : undefined}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Help & Support</span>}
        </Link>
        <UserAvatarMenu collapsed={collapsed} />
      </div>
    </aside>
  );
};

export default AppSidebar;
