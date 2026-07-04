import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { List, Pencil, Plus, Share2, Users, BarChart3 } from 'lucide-react';
import { Alert, Button, LoadingSpinner } from '../components/ui';
import { useShareFormModal } from '../hooks/useShareFormModal';
import formsService from '../services/formsService';
import projectsService, { ProjectData, ProjectVariant } from '../services/projectsService';
import { getNextVariantKey } from '../utils/variantComparison';
import { AddVariantWizard } from '../components/variants';

const variantDisplayIndex: Record<ProjectVariant['key'], number> = {
  main: 1,
  A: 2,
  B: 3,
};

interface VariantOverview {
  key: ProjectVariant['key'];
  formId: string;
  title: string;
  questionCount: number;
  responseCount: number;
  isActive: boolean;
  isPublic: boolean;
}

const ProjectVariantsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [variantOverviews, setVariantOverviews] = useState<VariantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [sharingVariantKey, setSharingVariantKey] = useState<string | null>(null);
  const [addingVariant, setAddingVariant] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const { openShareForForm, ShareFormUI } = useShareFormModal();

  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError('');
      const loadedProject = await projectsService.getProject(projectId);
      setProject(loadedProject);

      const overviews = await Promise.all(
        loadedProject.variants.map(async (variant) => {
          const [form, responseCount] = await Promise.all([
            formsService.getForm(variant.formId),
            formsService.getResponseCount(variant.formId),
          ]);

          return {
            key: variant.key,
            formId: variant.formId,
            title: form.title,
            questionCount: form.questions.length,
            responseCount,
            isActive: form.isActive,
            isPublic: form.isPublic,
          };
        }),
      );
      setVariantOverviews(overviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const nextVariantKey = project ? getNextVariantKey(project.variants) : null;

  const handleShareVariant = async (formId: string, variantKey: string) => {
    try {
      setSharingVariantKey(variantKey);
      setError('');
      openShareForForm(await formsService.getForm(formId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open share dialog');
    } finally {
      setSharingVariantKey(null);
    }
  };

  const handleAddVariant = () => {
    if (!project || !nextVariantKey) return;
    setWizardOpen(true);
  };

  const handleWizardSubmit = async (payload: Parameters<typeof projectsService.addVariant>[1] & { key: 'A' | 'B' }) => {
    if (!project) throw new Error('Project not found');
    setAddingVariant(true);
    const updated = await projectsService.addVariant(project._id, payload);
    const newVariant = updated.variants.find((v) => v.key === payload.key);
    if (!newVariant) throw new Error('Variant was not created');
    await loadProjectData();
    return { formId: newVariant.formId };
  };

  const handleWizardComplete = async (formId: string, modifiedQuestionIds: string[], variantKey: 'A' | 'B') => {
    if (!projectId) return;
    const params = new URLSearchParams({ projectId, variant: variantKey });
    if (modifiedQuestionIds.length > 0) {
      params.set('editQuestions', modifiedQuestionIds.join(','));
    }
    navigate(`/forms/${formId}/edit?${params.toString()}`);
  };

  const getOverview = (variant: ProjectVariant) =>
    variantOverviews.find((overview) => overview.key === variant.key);

  const getVariantLabel = (variant: ProjectVariant, overview?: VariantOverview) =>
    variant.targetGroup?.name ?? overview?.title ?? variant.key;

  if (loading) {
    return <LoadingSpinner size="lg" className="py-12" text="Loading project..." />;
  }

  if (error && !project) {
    return <Alert type="error" message={error || 'Project not found'} />;
  }

  if (!project) {
    return <Alert type="error" message="Project not found" />;
  }

  return (
    <>
      {error && <Alert type="error" className="mb-6" message={error} />}

      <div className="mx-auto max-w-3xl space-y-4">
        {project.variants.map((variant) => {
          const overview = getOverview(variant);
          const label = getVariantLabel(variant, overview);
          const displayIndex = variantDisplayIndex[variant.key] ?? variant.key;

          return (
            <div
              key={variant.key}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Variant {displayIndex}: {label}
                    </p>
                    {overview?.isActive && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                    {overview?.isPublic && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Public
                      </span>
                    )}
                    {variant.targetGroup?.name && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {variant.targetGroup.name}
                      </span>
                    )}
                  </div>
                  {overview?.title && overview.title !== label && (
                    <p className="mt-1 text-sm text-gray-600">{overview.title}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>{overview?.questionCount ?? 0} questions</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {overview?.responseCount ?? 0} responses
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/projects/${project._id}/variants/${variant.key}/edit`)
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareVariant(variant.formId, variant.key)}
                    disabled={sharingVariantKey === variant.key}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Share2 className="h-4 w-4" />
                    {sharingVariantKey === variant.key ? 'Loading...' : 'Share'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/projects/${project._id}/variants/${variant.key}/responses`)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <List className="h-4 w-4" />
                    Results ({overview?.responseCount ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/projects/${project._id}/variants/${variant.key}/analytics`)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analyze
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {nextVariantKey && (
          <Button
            variant="secondary"
            icon={Plus}
            onClick={handleAddVariant}
            loading={addingVariant}
            className="w-full"
          >
            Add variant
          </Button>
        )}
      </div>

      <ShareFormUI />

      {nextVariantKey && (
        <AddVariantWizard
          isOpen={wizardOpen}
          onClose={() => {
            setWizardOpen(false);
            setAddingVariant(false);
          }}
          project={project}
          variantKey={nextVariantKey}
          onSubmit={handleWizardSubmit}
          onComplete={(formId, modifiedQuestionIds) =>
            handleWizardComplete(formId, modifiedQuestionIds, nextVariantKey)
          }
        />
      )}
    </>
  );
};

export default ProjectVariantsPage;
