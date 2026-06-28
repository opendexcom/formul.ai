import React, { useState, useRef, useEffect } from 'react';
import { FileText, Grid3x3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { usePluginNav } from '../../plugins/pluginNavigation';
import type { PluginNavItem } from '../../plugins/types';

interface HeaderProps {
  title?: string;
  showUserMenu?: boolean;
  className?: string;
}

function navItemVisible(
  item: PluginNavItem,
  hasFeature: (feature: string) => boolean,
  userRoles: string[] | undefined,
): boolean {
  if (item.requiresFeature && !hasFeature(item.requiresFeature)) return false;
  if (item.requiresRole && !userRoles?.includes(item.requiresRole)) return false;
  return true;
}

const Header: React.FC<HeaderProps> = ({
  title = 'FormulAI',
  showUserMenu = true,
  className = ''
}) => {
  const { user, logout } = useAuth();
  const { hasFeature } = useCapabilities();
  const navigate = useNavigate();
  const pluginNav = usePluginNav();
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const headerLinks = pluginNav.filter(
    (item) => item.location === 'header-link' && navItemVisible(item, hasFeature, user?.roles),
  );
  const appsMenuItems = pluginNav.filter(
    (item) => item.location === 'apps-menu' && navItemVisible(item, hasFeature, user?.roles),
  );
  const showAppsMenuButton =
    user?.roles?.includes('admin') || appsMenuItems.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAppsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdminSettings = () => {
    setShowAppsMenu(false);
    navigate('/admin/settings');
  };

  const openNavItem = (item: PluginNavItem) => {
    setShowAppsMenu(false);
    if (item.external) {
      window.open(item.path, '_blank');
      return;
    }
    navigate(item.path);
  };

  return (
    <header className={`bg-white shadow-sm border-b ${className}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center rounded-lg transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Go to dashboard"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </button>

          {showUserMenu && user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user.firstName}
              </span>

              <button
                type="button"
                onClick={() => navigate('/settings/preferences')}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Settings
              </button>

              {headerLinks.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openNavItem(item)}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </button>
              ))}

              {showAppsMenuButton && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowAppsMenu(!showAppsMenu)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Apps menu"
                  >
                    <Grid3x3 className="w-5 h-5" />
                  </button>

                  {showAppsMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          setShowAppsMenu(false);
                          navigate('/dashboard');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Dashboard
                      </button>
                      {appsMenuItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openNavItem(item)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                      {user.roles?.includes('admin') && (
                        <button
                          onClick={handleAdminSettings}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Admin Settings
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
              >
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
