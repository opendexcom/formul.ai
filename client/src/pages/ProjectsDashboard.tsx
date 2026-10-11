import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Plus } from 'lucide-react';
import { AppPageLayout, PageHeader, QuotaLimitBanner } from '../components/common';
import { Alert, EmptyState, LoadingSpinner } from '../components/ui';
import projectsService, { ProjectData } from '../services/projectsService';
import { useUsageLimits } from '../hooks/useUsageLimits';

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  designing: 'Designing',
  published: 'Published',
  collecting: 'Collecting responses',
  analyzing: 'Analyzing',
  analyzed: 'Analyzed',
  reported: 'Reported',
  completed: 'Completed',
  archived: 'Archived',
};

const ProjectsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { formsExceeded } = useUsageLimits();

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      setProjects(await projectsService.getProjects());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async () => {
    if (formsExceeded) return;
    const name = window.prompt('Project name');
    if (!name?.trim()) return;
    try {
      const created = await projectsService.createProject({ name: name.trim() });
      navigate(`/projects/${created._id}/variants`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <AppPageLayout>
      <PageHeader
        title="Your Research Projects"
        description="Design variants, collect responses, and review analytics."
        actionLabel="Create New Study"
        actionIcon={Plus}
        actionDisabled={formsExceeded}
        onAction={handleCreateProject}
      />

      {formsExceeded && (
        <QuotaLimitBanner message="You've reached your projects limit." className="mb-6" />
      )}

      {error && <Alert type="error" className="mb-6" message={error} />}

      {loading ? (
        <LoadingSpinner size="lg" className="py-12" text="Loading studies..." />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No studies yet"
          description="Create your first study and start building variants with AI chat."
          actionLabel="Create first study"
          onAction={handleCreateProject}
          actionDisabled={formsExceeded}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project._id}
              type="button"
              className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow"
              onClick={() => navigate(`/projects/${project._id}/variants`)}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {project.type === 'ab_test' ? 'A/B test' : 'Single study'}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-gray-900">{project.name}</h3>
              {project.hypothesis && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{project.hypothesis}</p>
              )}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>{statusLabels[project.status] ?? project.status}</span>
                <span>{project.responseCount ?? 0} responses</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </AppPageLayout>
  );
};

export default ProjectsDashboard;
