import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import projectsService, { type ProjectData } from '../../services/projectsService';
import { useCrossVariantAccess } from '../../hooks/useCrossVariantAccess';
import { Alert, Button, LoadingSpinner } from '../ui';
import {
  shellPageTitleClass,
  shellSubNavLinkClass,
  studyStatusBadgeClass,
  studyStatusLabels,
  studyTypeBadgeClass,
} from './design-tokens';

type ProjectShellContextValue = {
  project: ProjectData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const ProjectShellContext = createContext<ProjectShellContextValue | null>(null);

export function useProjectShell(): ProjectShellContextValue {
  const ctx = useContext(ProjectShellContext);
  if (!ctx) {
    throw new Error('useProjectShell must be used within ProjectShell');
  }
  return ctx;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `${shellSubNavLinkClass} ${
    isActive
      ? 'bg-blue-50 text-blue-700'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;

const ProjectShell: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { available: crossVariantAvailable, loading: crossVariantAccessLoading } =
    useCrossVariantAccess();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      setError('');
      setProject(await projectsService.getProject(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load study');
      setProject(null);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!projectId) return;
      setLoading(true);
      try {
        const data = await projectsService.getProject(projectId);
        if (!cancelled) {
          setProject(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load study');
          setProject(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const showCompareTab = crossVariantAvailable && (project?.variants.length ?? 0) >= 2;
  const contextValue = useMemo(
    () => ({ project, loading, error, refresh }),
    [project, loading, error, refresh],
  );

  if (loading) {
    return <LoadingSpinner size="lg" className="py-12" text="Loading study..." />;
  }

  if (error && !project) {
    return <Alert type="error" message={error} />;
  }

  if (!project || !projectId) {
    return <Alert type="error" message="Study not found" />;
  }

  return (
    <ProjectShellContext.Provider value={contextValue}>
      <div className="space-y-6">
        <Link
          to="/overview#studies"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to studies
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={shellPageTitleClass}>{project.name}</h1>
            {project.hypothesis && (
              <p className="mt-1 max-w-3xl text-sm text-gray-600">{project.hypothesis}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  studyTypeBadgeClass[project.type]
                }`}
              >
                {project.type === 'ab_test' ? 'A/B test' : 'Single study'}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  studyStatusBadgeClass[project.status]
                }`}
              >
                {studyStatusLabels[project.status] ?? project.status}
              </span>
            </div>
          </div>
          {showCompareTab && (
            <Button
              variant="primary"
              icon={BarChart3}
              onClick={() => navigate(`/projects/${projectId}/compare`)}
            >
              Cross-variant analysis
            </Button>
          )}
          {!crossVariantAccessLoading && crossVariantAvailable && project.variants.length < 2 && (
            <p className="text-sm text-gray-500">
              Add another variant to unlock cross-variant analysis.
            </p>
          )}
        </div>

        <nav
          aria-label="Study sections"
          className="flex flex-wrap gap-2 border-b border-gray-200 pb-4"
        >
          <NavLink to={`/projects/${projectId}/overview`} className={tabClass}>
            Overview
          </NavLink>
          <NavLink to={`/projects/${projectId}/variants`} className={tabClass}>
            Variants
          </NavLink>
          <NavLink to={`/projects/${projectId}/variants/main/responses`} className={tabClass}>
            Responses
          </NavLink>
          <NavLink to={`/projects/${projectId}/analytics`} className={tabClass}>
            Analytics
          </NavLink>
          {showCompareTab && (
            <NavLink to={`/projects/${projectId}/compare`} className={tabClass}>
              Compare
            </NavLink>
          )}
        </nav>

        {error && <Alert type="error" message={error} />}
        <Outlet />
      </div>
    </ProjectShellContext.Provider>
  );
};

export default ProjectShell;
