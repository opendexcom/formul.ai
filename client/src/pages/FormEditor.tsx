import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Search, Settings } from 'lucide-react';
import FormFieldsPanel from '../components/FormEditor/FormFieldsPanel';
import FormCanvas from '../components/FormEditor/FormCanvas';
import FormSettings from '../components/FormEditor/FormSettings';
import FormPreview from '../components/FormEditor/FormPreview';
import AIFormChat from '../components/FormEditor/AIFormChat';
import { QuotaLimitBanner } from '../components/common';
import Button from '../components/ui/Button';
import NotificationBell from '../components/shell/NotificationBell';
import GlobalSearch from '../components/shell/GlobalSearch';
import { GlobalSearchProvider, useGlobalSearch } from '../components/shell/GlobalSearchContext';
import { useShareFormModal } from '../hooks/useShareFormModal';
import { FormData, Question, QuestionType, FormSettings as FormSettingsType } from '../services/formsService';
import formsService from '../services/formsService';
import projectsService, { ProjectData } from '../services/projectsService';
import { GeneratedForm } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { migrateQuestionForOther } from '../utils/otherOption';
import { useUsageLimits } from '../hooks/useUsageLimits';
import { parseQuotaErrorFromAxios } from '../utils/quotaErrors';
import { QuestionRole } from '../components/variants/QuestionRoleBadge';

const iconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700';

const EditorSearchButton: React.FC = () => {
  const { openSearch } = useGlobalSearch();
  return (
    <button type="button" onClick={openSearch} className={iconButtonClass} aria-label="Search">
      <Search className="h-5 w-5" />
    </button>
  );
};

const FormEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const editQuestionsParam = searchParams.get('editQuestions');
  const [form, setForm] = useState<FormData>({
    title: 'Untitled Form',
    description: '',
    questions: [],
    isActive: false,
    isPublic: true,
    settings: {
      allowMultipleResponses: true,
      requireLogin: false,
      showProgressBar: true,
    }
  });
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'preview'>('design');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [project, setProject] = useState<ProjectData | null>(null);
  const [sourceVariantQuestions, setSourceVariantQuestions] = useState<Question[]>([]);
  const { formsExceeded } = useUsageLimits();
  const isNewForm = !id || id === 'new';
  const displayVariantKey = searchParams.get('variant') ?? form.variantKey;
  const backTarget = projectId ? `/projects/${projectId}/variants` : '/overview';
  const { openShareForForm, ShareFormUI } = useShareFormModal((updatedForm) => {
    setForm(updatedForm);
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    if (id && id !== 'new') {
      loadForm(id);
    }

    // Check for tab parameter in URL
    const tabParam = searchParams.get('tab');
    if (tabParam === 'preview' || tabParam === 'settings') {
      setActiveTab(tabParam as 'design' | 'settings' | 'preview');
    }
  }, [id, isAuthenticated, navigate, searchParams]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    projectsService.getProject(projectId).then(setProject).catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    if (!project || !form.variantKey || form.variantKey === 'main') {
      setSourceVariantQuestions([]);
      return;
    }
    const sourceVariant = project.variants.find((variant) => variant.key === 'main');
    if (!sourceVariant) {
      setSourceVariantQuestions([]);
      return;
    }
    formsService
      .getForm(sourceVariant.formId)
      .then((sourceForm) => setSourceVariantQuestions(sourceForm.questions))
      .catch(() => setSourceVariantQuestions([]));
  }, [project, form.variantKey]);

  useEffect(() => {
    if (!editQuestionsParam || form.questions.length === 0) return;
    const firstEditId = editQuestionsParam.split(',')[0];
    if (firstEditId) setSelectedQuestionId(firstEditId);
  }, [editQuestionsParam, form.questions.length]);

  const questionDesignRoles = useMemo(() => {
    if (!project?.splitQuestionnaireDesign || !form.variantKey) return undefined;
    const design = project.splitQuestionnaireDesign.perVariant?.[form.variantKey];
    if (!design) return undefined;
    const roles: Record<string, QuestionRole> = {};
    for (const id of project.splitQuestionnaireDesign.coreQuestionIds ?? []) {
      roles[id] = 'core';
    }
    for (const id of design.modifiedQuestionIds ?? []) {
      roles[id] = 'modify';
    }
    for (const id of design.excludedQuestionIds ?? []) {
      roles[id] = 'exclude';
    }
    for (const id of design.polarityFlippedQuestionIds ?? []) {
      roles[id] = 'polarity_flip';
    }
    return roles;
  }, [project, form.variantKey]);

  const editQuestionIds = editQuestionsParam
    ? editQuestionsParam.split(',').filter(Boolean)
    : [];

  const loadForm = async (formId: string) => {
    setLoading(true);
    try {
      const formData = await formsService.getForm(formId);
      // Migrate questions to ensure "other" options have the special prefix
      const migratedForm = migrateFormForOtherOptions(formData);
      setForm(migratedForm);
    } catch (error) {
      console.error('Error loading form:', error);
      navigate(backTarget);
    } finally {
      setLoading(false);
    }
  };

  const migrateFormForOtherOptions = (form: FormData): FormData => {
    const migratedQuestions = form.questions.map(question => migrateQuestionForOther(question));
    return { ...form, questions: migratedQuestions };
  };

  const saveForm = async () => {
    if (isNewForm && formsExceeded) return;

    setSaving(true);
    setSaveError('');
    try {
      if (id && id !== 'new') {
        await formsService.updateForm(id, form);
      } else {
        const newForm = await formsService.createForm(form);
        navigate(`/forms/${newForm._id}/edit`, { replace: true });
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving form:', error);
      setSaveError(
        parseQuotaErrorFromAxios(error) || 'Failed to save form. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (updates: Partial<FormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: getDefaultQuestionTitle(type),
      type,
      required: false,
      order: form.questions.length,
      options: needsOptions(type) ? ['Option 1'] : undefined,
      canBeOther: false,
    };

    updateForm({
      questions: [...form.questions, newQuestion]
    });
    setSelectedQuestionId(newQuestion.id);
  };

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    const updatedQuestions = form.questions.map(q =>
      q.id === questionId ? { ...q, ...updates } : q
    );
    updateForm({ questions: updatedQuestions });
  };

  const deleteQuestion = (questionId: string) => {
    const updatedQuestions = form.questions
      .filter(q => q.id !== questionId)
      .map((q, index) => ({ ...q, order: index }));
    
    updateForm({ questions: updatedQuestions });
    
    if (selectedQuestionId === questionId) {
      setSelectedQuestionId(null);
    }
  };

  const duplicateQuestion = (questionId: string) => {
    const questionToDuplicate = form.questions.find(q => q.id === questionId);
    if (!questionToDuplicate) return;

    const duplicatedQuestion: Question = {
      ...questionToDuplicate,
      id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `${questionToDuplicate.title} (Copy)`,
      order: form.questions.length,
    };

    updateForm({
      questions: [...form.questions, duplicatedQuestion]
    });
  };

  const reorderQuestions = (startIndex: number, endIndex: number) => {
    const result = Array.from(form.questions);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    // Update order property
    const reorderedQuestions = result.map((q, index) => ({ ...q, order: index }));
    updateForm({ questions: reorderedQuestions });
  };

  const getDefaultQuestionTitle = (type: QuestionType): string => {
    const titles = {
      [QuestionType.TEXT]: 'Short Answer',
      [QuestionType.TEXTAREA]: 'Long Answer',
      [QuestionType.MULTIPLE_CHOICE]: 'Single Choice',
      [QuestionType.CHECKBOX]: 'Checkboxes',
      [QuestionType.DROPDOWN]: 'Dropdown',
      [QuestionType.EMAIL]: 'Email',
      [QuestionType.NUMBER]: 'Number',
      [QuestionType.DATE]: 'Date',
      [QuestionType.TIME]: 'Time',
      [QuestionType.RATING]: 'Rating',
      [QuestionType.COMMENT]: 'Hint or instruction',
    };
    return titles[type] || 'Question';
  };

  const needsOptions = (type: QuestionType): boolean => {
    return [QuestionType.MULTIPLE_CHOICE, QuestionType.CHECKBOX, QuestionType.DROPDOWN].includes(type);
  };

  // Handle AI-generated form (replace current form and persist)
  const handleAIFormGenerated = (generatedForm: GeneratedForm) => {
    // Build the merged form object to ensure we persist exactly what we show
    const merged = {
      ...form,
      title: generatedForm.title,
      description: generatedForm.description,
      questions: generatedForm.questions,
    } as FormData;

    // Update UI immediately
    setForm(merged);
    setHasUnsavedChanges(true);
    if (generatedForm.questions.length > 0) {
      setSelectedQuestionId(generatedForm.questions[0].id);
    }

    // Persist automatically
    (async () => {
      try {
        if (isNewForm && formsExceeded) return;

        setSaving(true);
        if (id && id !== 'new') {
          const updated = await formsService.updateForm(id, merged);
          setForm(updated);
        } else {
          const created = await formsService.createForm(merged);
          setForm(created);
          navigate(`/forms/${created._id}/edit`, { replace: true });
        }
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('Auto-save after AI generation failed:', err);
        const quotaMessage = parseQuotaErrorFromAxios(err);
        if (quotaMessage) {
          setSaveError(quotaMessage);
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const showMeta =
    hasUnsavedChanges ||
    project?.researchDesignType === 'split_questionnaire' ||
    (isNewForm && formsExceeded) ||
    Boolean(saveError) ||
    editQuestionIds.length > 0;

  return (
    <GlobalSearchProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="shrink-0">Studies</span>
              <span className="text-gray-300">/</span>
              <span className="truncate">{form.title || 'Untitled Form'}</span>
            </button>
            {displayVariantKey && (
              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                Variant {displayVariantKey}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'settings' ? 'design' : 'settings')}
              className={`${iconButtonClass} ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900' : ''}`}
              aria-label="Settings"
              aria-pressed={activeTab === 'settings'}
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'preview' ? 'design' : 'preview')}
              className={`${iconButtonClass} ${activeTab === 'preview' ? 'bg-gray-100 text-gray-900' : ''}`}
              aria-label="Preview"
              aria-pressed={activeTab === 'preview'}
            >
              <Eye className="h-5 w-5" />
            </button>
            <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
            <EditorSearchButton />
            <NotificationBell />
            <Button
              type="button"
              onClick={saveForm}
              disabled={saving || (isNewForm && formsExceeded)}
              loading={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {!isNewForm && form._id && (
              <button
                type="button"
                onClick={() => openShareForForm(form)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Share
              </button>
            )}
          </div>
        </header>

        {showMeta && (
          <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {hasUnsavedChanges && <span className="font-medium text-orange-600">Unsaved changes</span>}
              {project?.researchDesignType === 'split_questionnaire' && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
                  Split questionnaire
                </span>
              )}
            </div>
            {isNewForm && formsExceeded && (
              <QuotaLimitBanner
                message="You've reached your form limit and cannot create a new form."
                className="mt-2"
              />
            )}
            {saveError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {saveError}
              </p>
            )}
            {editQuestionIds.length > 0 && (
              <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Edit the {editQuestionIds.length} question(s) marked for modification in this split
                variant. Questions with reverse polarity already have reverse coding enabled.
              </div>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {activeTab === 'design' && (
            <>
              <div className="w-[280px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
                <FormFieldsPanel onAddQuestion={addQuestion} />
              </div>
              <div className="min-w-0 flex-1 overflow-y-auto">
                <FormCanvas
                  form={form}
                  selectedQuestionId={selectedQuestionId}
                  onSelectQuestion={setSelectedQuestionId}
                  onUpdateForm={updateForm}
                  onUpdateQuestion={updateQuestion}
                  onDeleteQuestion={deleteQuestion}
                  onDuplicateQuestion={duplicateQuestion}
                  onReorderQuestions={reorderQuestions}
                  questionDesignRoles={questionDesignRoles}
                  sourceVariantQuestions={sourceVariantQuestions}
                  sourceVariantLabel="main"
                />
              </div>
              <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-gray-50">
                <AIFormChat
                  currentForm={{
                    title: form.title,
                    description: form.description || '',
                    questions: form.questions,
                  }}
                  onFormGenerated={handleAIFormGenerated}
                />
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <div className="min-w-0 flex-1 overflow-y-auto">
              <FormSettings
                settings={form.settings}
                isActive={form.isActive}
                isPublic={form.isPublic}
                onUpdateSettings={(settings: FormSettingsType) => updateForm({ settings })}
                onToggleActive={(isActive: boolean) => updateForm({ isActive })}
                onTogglePublic={(isPublic: boolean) => updateForm({ isPublic })}
              />
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="min-w-0 flex-1 overflow-y-auto">
              <FormPreview form={form} />
            </div>
          )}
        </div>
      </div>
      <GlobalSearch />
      <ShareFormUI />
    </GlobalSearchProvider>
  );
};

export default FormEditor;