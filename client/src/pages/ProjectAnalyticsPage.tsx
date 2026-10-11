import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, LoadingSpinner } from '../components/ui';
import projectsService from '../services/projectsService';
import FormAnalytics from './FormAnalytics';

const ProjectAnalyticsPage: React.FC = () => {
  const { projectId, key } = useParams<{ projectId: string; key: string }>();
  const [targetFormId, setTargetFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const resolveTarget = async () => {
      if (!projectId || !key) return;
      try {
        setLoading(true);
        setError('');
        const project = await projectsService.getProject(projectId);
        const variant = projectsService.getVariantByKey(project, key);
        if (!variant?.formId) {
          setError(`Variant ${key} not found`);
          return;
        }
        setTargetFormId(variant.formId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open analytics');
      } finally {
        setLoading(false);
      }
    };
    void resolveTarget();
  }, [projectId, key]);

  if (targetFormId && projectId && key) {
    return (
      <FormAnalytics
        embedded
        formIdOverride={targetFormId}
        projectIdOverride={projectId}
        variantOverride={key}
      />
    );
  }

  return (
    <div>
      {error && <Alert type="error" className="mb-4" message={error} />}
      {loading && <LoadingSpinner size="lg" className="py-12" text="Opening analytics..." />}
    </div>
  );
};

export default ProjectAnalyticsPage;
