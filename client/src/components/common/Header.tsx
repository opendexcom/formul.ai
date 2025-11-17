import React from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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