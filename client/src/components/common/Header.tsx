import React, { useState, useRef, useEffect } from 'react';
import { FileText, Grid3x3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';

interface HeaderProps {
  title?: string;
  showUserMenu?: boolean;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  title = 'FormulAI',
  showUserMenu = true,
  className = ''
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  return (
    <header className={`bg-white shadow-sm border-b ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>

          {showUserMenu && user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user.firstName}
              </span>

              {user.roles?.includes('admin') && (
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
                        <div className="flex items-center">
                          <span>Dashboard</span>
                        </div>
                      </button>
                      <button
                        onClick={handleAdminSettings}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center">
                          <span>Admin Settings</span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setShowAppsMenu(false);
                          window.open(`${window.location.origin}/api/admin/queues`, '_blank');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center">
                          <span>Queue Monitor</span>
                        </div>
                      </button>
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