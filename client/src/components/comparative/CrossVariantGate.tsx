import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppPageLayout, QuotaLimitBanner } from '../common';
import { LoadingSpinner } from '../ui';
import { useCrossVariantAccess } from '../../hooks/useCrossVariantAccess';

interface CrossVariantGateProps {
  children: React.ReactNode;
}

export const CrossVariantGate: React.FC<CrossVariantGateProps> = ({ children }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const { loading, available, reason } = useCrossVariantAccess();

  if (loading) {
    return (
      <AppPageLayout>
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      </AppPageLayout>
    );
  }

  if (!available) {
    return (
      <AppPageLayout>
        <div className="mb-6">
          <Link
            to={`/projects/${projectId}/variants`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to project
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Cross-variant analysis</h1>
        </div>

        {reason === 'plan_required' ? (
          <QuotaLimitBanner message="Cross-variant analysis requires a Pro plan or higher." />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-600">
              Cross-variant analysis is not available in this deployment.
            </p>
            <Link
              to={`/projects/${projectId}/variants`}
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Return to project
            </Link>
          </div>
        )}
      </AppPageLayout>
    );
  }

  return <>{children}</>;
};
