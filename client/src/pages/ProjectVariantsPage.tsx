import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
      {error && <Alert type="error" className="mb-5" message={error} />}

      <div className="space-y-5">
        {project.variants.map((variant) => {
          const overview = getOverview(variant);
          const groupName = variant.targetGroup?.name ?? 'General';
          const displayIndex = variantDisplayIndex[variant.key] ?? variant.key;

          return (
            <div
              key={variant.key}
              className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <span>Variant {displayIndex}: {groupName}</span>
                <span className="font-normal normal-case tracking-normal text-gray-400">•</span>
                <span className="text-xs font-medium normal-case tracking-normal text-gray-500">
                  {groupName}
                </span>
              </p>
              <div>
                <p className="text-base font-medium leading-6 text-gray-900">
                  {overview?.title || 'Untitled form'}
                </p>
                <p className="mt-1 text-[13px] leading-[18px] text-gray-500">
                  {overview?.questionCount ?? 0} questions · {overview?.responseCount ?? 0} responses
                </p>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                <Button
                  type="button"
                  onClick={() =>
                    navigate(`/projects/${project._id}/variants/${variant.key}/edit`)
                  }
                >
                  Edit
                </Button>
                <button
                  type="button"
                  onClick={() => handleShareVariant(variant.formId, variant.key)}
                  disabled={sharingVariantKey === variant.key}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {sharingVariantKey === variant.key ? 'Loading...' : 'Share'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/projects/${project._id}/variants/${variant.key}/responses`)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Results ({overview?.responseCount ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/projects/${project._id}/variants/${variant.key}/analytics`)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  Analyze
                </button>
              </div>
            </div>
          );
        })}

        {nextVariantKey && (
          <div className="flex justify-center pt-3">
            <Button
              variant="secondary"
              onClick={handleAddVariant}
              loading={addingVariant}
              className="w-full max-w-3xl"
            >
              Add variant
            </Button>
          </div>
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
