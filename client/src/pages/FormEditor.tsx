import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import FormFieldsPanel from '../components/FormEditor/FormFieldsPanel';
import FormCanvas from '../components/FormEditor/FormCanvas';
import FormSettings from '../components/FormEditor/FormSettings';
import FormPreview from '../components/FormEditor/FormPreview';
import AIFormChat from '../components/FormEditor/AIFormChat';
import { FormData, Question, QuestionType, FormSettings as FormSettingsType } from '../services/formsService';
import formsService from '../services/formsService';
import { GeneratedForm } from '../services/aiService';
import { useAuth } from '../context/AuthContext';

const FormEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
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

  const loadForm = async (formId: string) => {
    setLoading(true);
    try {
      const formData = await formsService.getForm(formId);
      setForm(formData);
    } catch (error) {
      console.error('Error loading form:', error);
      // If form not found or error, redirect to dashboard
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const saveForm = async () => {
    setSaving(true);
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
      [QuestionType.MULTIPLE_CHOICE]: 'Multiple Choice',
      [QuestionType.CHECKBOX]: 'Checkboxes',
      [QuestionType.DROPDOWN]: 'Dropdown',
      [QuestionType.EMAIL]: 'Email',
      [QuestionType.NUMBER]: 'Number',
      [QuestionType.DATE]: 'Date',
      [QuestionType.TIME]: 'Time',
      [QuestionType.RATING]: 'Rating',
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
        // Keep hasUnsavedChanges=true so the user can click Save manually
      } finally {
        setSaving(false);
      }
    })();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                placeholder="Untitled Form"
              />
              {hasUnsavedChanges && (
                <span className="text-sm text-orange-600 ml-2">• Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Tab Navigation */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('design')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'design'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Design
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Preview
              </button>
            </div>

            <button
              onClick={saveForm}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {activeTab === 'design' && (
          <>
            {/* Left Panel - Form Fields */}
            <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
              <FormFieldsPanel onAddQuestion={addQuestion} />
            </div>

            {/* Center - Form Canvas */}
            <div className="flex-1 overflow-y-auto">
              <FormCanvas
                form={form}
                selectedQuestionId={selectedQuestionId}
                onSelectQuestion={setSelectedQuestionId}
                onUpdateForm={updateForm}
                onUpdateQuestion={updateQuestion}
                onDeleteQuestion={deleteQuestion}
                onDuplicateQuestion={duplicateQuestion}
                onReorderQuestions={reorderQuestions}
              />
            </div>

            {/* Right Panel - Always show AI Chat */}
            <div className="w-80 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
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
          <div className="flex-1 overflow-y-auto">
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
          <div className="flex-1 overflow-y-auto">
            <FormPreview form={form} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FormEditor;