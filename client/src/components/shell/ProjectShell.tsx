import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import projectsService, { type ProjectData } from '../../services/projectsService';
import { useCrossVariantAccess } from '../../hooks/useCrossVariantAccess';
import { Alert, Button, LoadingSpinner } from '../ui';
import { studyStatusLabels } from './design-tokens';

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
  `inline-flex h-11 items-center border-b-2 px-4 text-sm transition ${
    isActive
      ? 'border-blue-600 font-semibold text-blue-600'
      : 'border-transparent font-medium text-gray-500 hover:text-gray-700'
  }`;

const ProjectShell: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { available: crossVariantAvailable } = useCrossVariantAccess();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDelete = async () => {
    if (!projectId) return;
    try {
      setDeleting(true);
      setError('');
      await projectsService.deleteProject(projectId);
      navigate('/overview#studies');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete study');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

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
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold leading-8 text-gray-900">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {project.type === 'ab_test' ? 'A/B Study' : 'Single study'}
              </span>
              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {studyStatusLabels[project.status] ?? project.status}
              </span>
            </div>
          </div>
          <Button
            variant={confirmDelete ? 'danger' : 'secondary'}
            disabled={deleting}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              void handleDelete();
            }}
          >
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete study'}
          </Button>
        </div>

        <nav aria-label="Study sections" className="flex gap-2 border-b border-gray-200">
          <NavLink to={`/projects/${projectId}/overview`} className={tabClass}>
            Brief
          </NavLink>
          <NavLink to={`/projects/${projectId}/variants`} className={tabClass} end>
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
