import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  type?: 'error' | 'success' | 'warning' | 'info';
  title?: string;
  message: string;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({ 
  type = 'info', 
  title, 
  message, 
  className = '' 
}) => {
  const typeConfig = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      titleColor: 'text-red-900',
      icon: XCircle,
      iconColor: 'text-red-400'
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      titleColor: 'text-green-900',
      icon: CheckCircle,
      iconColor: 'text-green-400'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      titleColor: 'text-yellow-900',
      icon: AlertCircle,
      iconColor: 'text-yellow-400'
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      titleColor: 'text-blue-900',
      icon: Info,
      iconColor: 'text-blue-400'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex">
        <Icon className={`w-5 h-5 ${config.iconColor} mt-0.5 mr-3 flex-shrink-0`} />
        <div className="flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${config.titleColor} mb-1`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${config.textColor}`}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Alert;