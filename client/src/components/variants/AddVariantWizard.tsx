import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { LoadingSpinner } from '../ui';
import { Question } from '../../services/formsService';
import { ProjectData } from '../../services/projectsService';
import formsService from '../../services/formsService';
import {
  buildVariantPayloadFromRoles,
  QuestionRolesMap,
  SplitQuestionPicker,
  summarizeRoles,
} from './SplitQuestionPicker';
import { QuestionRole } from './QuestionRoleBadge';

type WizardStep = 'audience' | 'source' | 'split' | 'confirm';

interface AddVariantWizardProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  variantKey: 'A' | 'B';
  onComplete: (formId: string, modifiedQuestionIds: string[], variantKey: 'A' | 'B') => Promise<void>;
  onSubmit: (payload: {
    key: 'A' | 'B';
    targetGroupName?: string;
    cloneFromKey: 'main' | 'A' | 'B';
    excludeQuestionIds?: string[];
    modifiedQuestionIds?: string[];
    polarityFlippedQuestionIds?: string[];
  }) => Promise<{ formId: string }>;
}

const stepTitles: Record<WizardStep, string> = {
  audience: 'Add variant — audience',
  source: 'Add variant — clone source',
  split: 'Add variant — split design',
  confirm: 'Add variant — confirm',
};

export const AddVariantWizard: React.FC<AddVariantWizardProps> = ({
  isOpen,
  onClose,
  project,
  variantKey,
  onComplete,
  onSubmit,
}) => {
  const [step, setStep] = useState<WizardStep>('audience');
  const [targetGroupName, setTargetGroupName] = useState(`Variant ${variantKey}`);
  const [cloneFromKey, setCloneFromKey] = useState<'main' | 'A' | 'B'>('main');
  const [sourceQuestions, setSourceQuestions] = useState<Question[]>([]);
  const [roles, setRoles] = useState<QuestionRolesMap>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableSources = useMemo(
    () => project.variants.map((v) => v.key),
    [project.variants],
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep('audience');
    setTargetGroupName(`Variant ${variantKey}`);
    setCloneFromKey('main');
    setSourceQuestions([]);
    setRoles({});
    setError('');
  }, [isOpen, variantKey]);

  useEffect(() => {
    if (step !== 'split' && step !== 'confirm') return;
    const sourceVariant = project.variants.find((v) => v.key === cloneFromKey);
    if (!sourceVariant) return;

    let cancelled = false;
    const load = async () => {
      try {
        setLoadingQuestions(true);
        setError('');
        const form = await formsService.getForm(sourceVariant.formId);
        if (cancelled) return;
        setSourceQuestions(form.questions);
        setRoles(
          Object.fromEntries(form.questions.map((q) => [q.id, 'core' as QuestionRole])),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load source questions');
        }
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [step, cloneFromKey, project.variants]);

  const handleRoleChange = (questionId: string, role: QuestionRole) => {
    setRoles((prev) => ({ ...prev, [questionId]: role }));
  };

  const payload = buildVariantPayloadFromRoles(roles);
  const summary = summarizeRoles(roles);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');
      const result = await onSubmit({
        key: variantKey,
        targetGroupName: targetGroupName.trim() || undefined,
        cloneFromKey,
        ...payload,
      });
      await onComplete(result.formId, payload.modifiedQuestionIds, variantKey);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'audience':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Name the audience for variant <strong>{variantKey}</strong>.
            </p>
            <input
              type="text"
              value={targetGroupName}
              onChange={(e) => setTargetGroupName(e.target.value)}
              placeholder={`Variant ${variantKey}`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        );

      case 'source':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose which variant to clone as the starting questionnaire.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableSources.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCloneFromKey(key)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    cloneFromKey === key
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {key === 'main' ? 'Main' : `Variant ${key}`}
                </button>
              ))}
            </div>
          </div>
        );

      case 'split':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Mark which questions stay identical (core), which you will edit, which to exclude,
              or which need reverse-coded polarity.
            </p>
            {loadingQuestions ? (
              <LoadingSpinner text="Loading questions..." />
            ) : sourceQuestions.length === 0 ? (
              <p className="text-sm text-gray-500">No questions in source form yet.</p>
            ) : (
              <SplitQuestionPicker
                questions={sourceQuestions}
                roles={roles}
                onRoleChange={handleRoleChange}
              />
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4 text-sm text-gray-700">
            <p>
              Creating variant <strong>{variantKey}</strong> for audience{' '}
              <strong>{targetGroupName || `Variant ${variantKey}`}</strong>, cloned from{' '}
              <strong>{cloneFromKey}</strong>.
            </p>
            <ul className="space-y-1 rounded-lg bg-gray-50 p-4">
              <li>{summary.core} core question(s) — unchanged</li>
              <li>{summary.modify} to modify in editor</li>
              <li>{summary.polarityFlip} with reverse polarity</li>
              <li>{summary.exclude} excluded from this variant</li>
            </ul>
            {(payload.modifiedQuestionIds.length > 0 ||
              payload.polarityFlippedQuestionIds.length > 0) && (
              <p className="text-gray-600">
                After creation you will be taken to the form editor to edit marked questions.
              </p>
            )}
          </div>
        );
    }
  };

  const canNext =
    step === 'audience' ||
    step === 'source' ||
    (step === 'split' && !loadingQuestions);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stepTitles[step]}
      className="max-w-2xl w-full"
    >
      <div className="space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {renderStep()}
        <div className="flex justify-between border-t border-gray-200 pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 'audience') onClose();
              else if (step === 'source') setStep('audience');
              else if (step === 'split') setStep('source');
              else setStep('split');
            }}
            disabled={submitting}
          >
            {step === 'audience' ? 'Cancel' : 'Back'}
          </Button>
          {step === 'confirm' ? (
            <Button onClick={handleSubmit} loading={submitting}>
              Create variant
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (step === 'audience') setStep('source');
                else if (step === 'source') setStep('split');
                else setStep('confirm');
              }}
              disabled={!canNext}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
