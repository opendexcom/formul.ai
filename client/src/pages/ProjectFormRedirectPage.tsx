import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AppPageLayout } from '../components/common';
import { Alert, LoadingSpinner } from '../components/ui';
import projectsService from '../services/projectsService';

const ProjectFormRedirectPage: React.FC = () => {
  const { projectId, key } = useParams<{ projectId: string; key: string }>();
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const resolveDestination = async () => {
      if (!projectId) return;
      try {
        const project = await projectsService.getProject(projectId);
        const variant =
          project.variants.find((item) => item.key === key) ??
          project.variants.find((item) => item.key === 'main') ??
          project.variants[0];
        if (!variant?.formId) {
          setError('Variant form not found');
          return;
        }
        setDestination(
          `/forms/${variant.formId}/edit?projectId=${projectId}&variant=${variant.key}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open variant');
      }
    };
    resolveDestination();
  }, [key, projectId]);

  if (destination) {
    return <Navigate to={destination} replace />;
  }

  return (
    <AppPageLayout>
      {error ? (
        <Alert type="error" message={error} />
      ) : (
        <LoadingSpinner size="lg" className="py-12" text="Opening variant editor..." />
      )}
    </AppPageLayout>
  );
};

export default ProjectFormRedirectPage;
