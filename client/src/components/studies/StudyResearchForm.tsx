import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Button } from '../ui';
import projectsService, { ProjectData } from '../../services/projectsService';

interface StudyResearchFormProps {
  project: ProjectData;
  onProjectUpdated: (project: ProjectData) => void;
  compact?: boolean;
}

export const StudyResearchForm: React.FC<StudyResearchFormProps> = ({
  project,
  onProjectUpdated,
  compact = false,
}) => {
  const [hypothesesDraft, setHypothesesDraft] = useState<string[]>(['']);
  const [projectNotesDraft, setProjectNotesDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [savingHypotheses, setSavingHypotheses] = useState(false);
  const [savingProjectNotes, setSavingProjectNotes] = useState(false);

  const syncResearchDrafts = (loadedProject: ProjectData) => {
    const hypotheses = projectsService.normalizeHypotheses(loadedProject);
    setHypothesesDraft(hypotheses.length > 0 ? hypotheses : ['']);
    setProjectNotesDraft(loadedProject.researchNotes ?? '');
  };

  useEffect(() => {
    syncResearchDrafts(project);
  }, [project]);

  const handleSaveHypotheses = async () => {
    try {
      setSavingHypotheses(true);
      setError('');
      setSaveMessage('');
      const hypotheses = hypothesesDraft.map((item) => item.trim()).filter(Boolean);
      const updated = await projectsService.updateProject(project._id, { hypotheses });
      onProjectUpdated(updated);
      syncResearchDrafts(updated);
      setSaveMessage('Hypotheses saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hypotheses');
    } finally {
      setSavingHypotheses(false);
    }
  };

  const handleSaveProjectNotes = async () => {
    try {
      setSavingProjectNotes(true);
      setError('');
      setSaveMessage('');
      const updated = await projectsService.updateProject(project._id, {
        researchNotes: projectNotesDraft.trim(),
      });
      onProjectUpdated(updated);
      syncResearchDrafts(updated);
      setSaveMessage('Research notes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save research notes');
    } finally {
      setSavingProjectNotes(false);
    }
  };

  return (
    <div className={compact ? 'space-y-6' : 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm'}>
      {!compact && (
        <>
          <h2 className="text-lg font-semibold text-gray-900">Research setup</h2>
          <p className="mt-1 text-sm text-gray-600">
            Used by study analysis and per-variant analytics prompts. Not shown to respondents.
          </p>
        </>
      )}

      {error && <Alert type="error" className={compact ? '' : 'mt-4'} message={error} />}
      {saveMessage && <Alert type="success" className={compact ? '' : 'mt-4'} message={saveMessage} />}

      <div className={compact ? 'space-y-6' : 'mt-6 space-y-6'}>
        <div className={compact ? `${''}` : ''}>
          <h3 className="text-sm font-semibold text-gray-900">Research hypotheses</h3>
          {!compact && (
            <p className="mt-1 text-sm text-gray-600">
              Define what you want to learn from this study.
            </p>
          )}
          <div className="mt-3 space-y-3">
            {hypothesesDraft.map((hypothesis, index) => (
              <div key={`hypothesis-${index}`}>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Hypothesis #{index + 1}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={hypothesis}
                    onChange={(event) =>
                      setHypothesesDraft((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder="e.g. Respondents prefer the simplified questionnaire"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {hypothesesDraft.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setHypothesesDraft((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2 text-gray-500 hover:bg-gray-50"
                      title="Remove hypothesis"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => setHypothesesDraft((prev) => [...prev, ''])}
            >
              Add hypothesis
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSaveHypotheses()}
              loading={savingHypotheses}
            >
              Save hypotheses
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Research notes</h3>
          {!compact && (
            <p className="mt-1 text-sm text-gray-600">
              Document study goals and methodology for the whole project.
            </p>
          )}
          <textarea
            rows={4}
            value={projectNotesDraft}
            onChange={(event) => setProjectNotesDraft(event.target.value)}
            placeholder="Describe the purpose of this study and what you want to learn."
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSaveProjectNotes()}
              loading={savingProjectNotes}
            >
              Save notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
