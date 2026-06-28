import React from 'react';
import { Link } from 'react-router-dom';

interface QuotaLimitBannerProps {
  message: string;
  className?: string;
}

const QuotaLimitBanner: React.FC<QuotaLimitBannerProps> = ({
  message,
  className = '',
}) => {
  return (
    <div
      className={`p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 ${className}`}
      role="alert"
    >
      {message}{' '}
      <Link to="/settings/billing" className="font-medium underline hover:text-amber-950">
        Upgrade your plan
      </Link>
    </div>
  );
};

export default QuotaLimitBanner;
