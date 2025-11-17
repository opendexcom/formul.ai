import React from 'react';
import { LucideIcon } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${className}`}>
      <div className="text-center py-12">
        <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">
          {description}
        </p>
        {actionLabel && onAction && (
          <Button onClick={onAction} variant="primary">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;