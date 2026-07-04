import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, LoadingSpinner } from '../components/ui';
import projectsService, { ProjectData, ProjectVariant } from '../services/projectsService';
import formsService, { FormData } from '../services/formsService';
import { ResponseWithMetadata } from '../types/analytics';
import { RawResponsesTable } from '../components/analytics/RawResponsesTable';

const ProjectResponsesPage: React.FC = () => {
  const { projectId, key } = useParams<{ projectId: string; key: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [variant, setVariant] = useState<ProjectVariant | null>(null);
  const [form, setForm] = useState<FormData | null>(null);
  const [responses, setResponses] = useState<ResponseWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadResponses = async () => {
      if (!projectId || !key) return;
      try {
        setLoading(true);
        setError('');
        const loadedProject = await projectsService.getProject(projectId);
        setProject(loadedProject);
        const selectedVariant = projectsService.getVariantByKey(loadedProject, key);
        if (!selectedVariant) {
          setError(`Variant ${key} not found`);
          return;
        }
        setVariant(selectedVariant);
        const [formData, responsesData] = await Promise.all([
          formsService.getForm(selectedVariant.formId),
          formsService.getFormResponses(selectedVariant.formId),
        ]);
        setForm(formData);
        setResponses(responsesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load responses');
      } finally {
        setLoading(false);
      }
    };
    loadResponses();
  }, [projectId, key]);

  return (
    <div>
      {project && project.variants.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {project.variants.map((v) => (
            <Link
              key={v.key}
              to={`/projects/${projectId}/variants/${v.key}/responses`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                v.key === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Variant {v.key}
            </Link>
          ))}
        </div>
      )}
      {variant && form && (
        <p className="mb-4 text-sm text-gray-600">
          Variant {variant.key} · {form.title}
        </p>
      )}
      {error && <Alert type="error" className="mb-4" message={error} />}
      {loading && (
        <LoadingSpinner size="lg" className="py-12" text="Loading responses..." />
      )}
      {!loading && form && (
        <RawResponsesTable
          form={form}
          responses={responses}
          showAnalyticsStatus={false}
        />
      )}
    </div>
  );
};

export default ProjectResponsesPage;
