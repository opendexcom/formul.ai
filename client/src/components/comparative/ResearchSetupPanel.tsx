import React, { useEffect, useState } from 'react';
import { Alert, Button } from '../ui';
import projectsService, { ProjectData, ProjectVariant } from '../../services/projectsService';
import { StudyResearchForm } from '../studies/StudyResearchForm';

interface ResearchSetupPanelProps {
  project: ProjectData;
  onProjectUpdated: (project: ProjectData) => void;
}

export const ResearchSetupPanel: React.FC<ResearchSetupPanelProps> = ({
  project,
  onProjectUpdated,
}) => {
  const [variantNotesDraft, setVariantNotesDraft] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [savingVariantKey, setSavingVariantKey] = useState<ProjectVariant['key'] | null>(null);

  const syncVariantDrafts = (loadedProject: ProjectData) => {
    setVariantNotesDraft(
      Object.fromEntries(
        loadedProject.variants.map((variant) => [
          variant.key,
          variant.internalDescription ?? '',
        ]),
      ),
    );
  };

  useEffect(() => {
    syncVariantDrafts(project);
  }, [project]);

  const handleSaveVariantNotes = async (variantKey: ProjectVariant['key']) => {
    try {
      setSavingVariantKey(variantKey);
      setError('');
      setSaveMessage('');
      const updated = await projectsService.updateVariant(project._id, variantKey, {
        internalDescription: variantNotesDraft[variantKey]?.trim() || '',
      });
      onProjectUpdated(updated);
      syncVariantDrafts(updated);
      setSaveMessage(`Variant notes saved for variant ${variantKey}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variant notes');
    } finally {
      setSavingVariantKey(null);
    }
  };

  const getVariantLabel = (variant: ProjectVariant) =>
    variant.targetGroup?.name ?? `Variant ${variant.key}`;

  return (
    <section className="mb-6 space-y-6">
      <StudyResearchForm project={project} onProjectUpdated={onProjectUpdated} />

      {error && <Alert type="error" message={error} />}
      {saveMessage && <Alert type="success" message={saveMessage} />}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Variant context</h3>
        <p className="mt-1 text-sm text-gray-600">
          Internal notes for each variant branch.
        </p>
        <div className="mt-3 space-y-3">
          {project.variants.map((variant) => (
            <details
              key={variant.key}
              className="rounded-lg border border-gray-200 bg-gray-50"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
                {getVariantLabel(variant)}
              </summary>
              <div className="border-t border-gray-200 px-4 py-3">
                <textarea
                  rows={3}
                  value={variantNotesDraft[variant.key] ?? ''}
                  onChange={(event) =>
                    setVariantNotesDraft((prev) => ({
                      ...prev,
                      [variant.key]: event.target.value,
                    }))
                  }
                  placeholder="What is this variant testing and what does success look like?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleSaveVariantNotes(variant.key)}
                    loading={savingVariantKey === variant.key}
                  >
                    Save notes
                  </Button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
