import React from 'react';
import Button from '../ui/Button';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  actionDisabled?: boolean;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  actionDisabled = false,
  className = ''
}) => {
  return (
    <div className={`flex justify-between items-center mb-8 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        {description && (
          <p className="text-gray-600">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="primary"
          icon={actionIcon}
          iconPosition="left"
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default PageHeader;