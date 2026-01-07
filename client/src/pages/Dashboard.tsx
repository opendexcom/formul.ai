import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import formsService, { FormData } from '../services/formsService';
import { Header, FormCard, PageHeader, ShareFormModal } from '../components/common';
import { LoadingSpinner, Alert, EmptyState } from '../components/ui';
import { logger } from '../utils/logger';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormData | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [activationConfirmOpen, setActivationConfirmOpen] = useState(false);
  const [formToActivate, setFormToActivate] = useState<FormData | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      setLoading(true);
      const userForms = await formsService.getForms();
      setForms(userForms);
      
      // Load response counts for each form
      const counts: Record<string, number> = {};
      await Promise.all(
        userForms.map(async (form) => {
          if (form._id) {
            try {
              const count = await formsService.getResponseCount(form._id);
              counts[form._id] = count;
            } catch (error) {
              console.error(`Error loading response count for form ${form._id}:`, error);
              counts[form._id] = 0;
            }
          }
        })
      );
      setResponseCounts(counts);
    } catch (error) {
      setError('Failed to load forms');
      logger.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForm = () => {
    navigate('/forms/new');
  };

  const handlePreviewForm = (formId: string) => {
    navigate(`/forms/${formId}/edit?tab=preview`);
  };

  const handleShareForm = (formId: string) => {
    const form = forms.find(f => f._id === formId);
    if (form) {
      if (!form.isActive) {
        // Form is not active, ask user to confirm activation
        setFormToActivate(form);
        setActivationConfirmOpen(true);
      } else {
        // Form is active, open share modal directly
        setSelectedForm(form);
        setShareModalOpen(true);
      }
    }
  };

  const handleActivateAndShare = async () => {
    if (!formToActivate || !formToActivate._id) return;
    
    setActivating(true);
    try {
      const updatedForm = await formsService.updateForm(formToActivate._id, { isActive: true });
      // Update forms list with activated form
      setForms(prevForms => 
        prevForms.map(form => 
          form._id === updatedForm._id ? updatedForm : form
        )
      );
      // Close confirmation and open share modal
      setActivationConfirmOpen(false);
      setFormToActivate(null);
      setSelectedForm(updatedForm);
      setShareModalOpen(true);
    } catch (error) {
      logger.error('Error activating form:', error);
      setError('Failed to activate form');
    } finally {
      setActivating(false);
    }
  };

  const handleAnalytics = (formId: string) => {
    navigate(`/forms/${formId}/analytics`);
  };

  const handleFormUpdate = (updatedForm: FormData) => {
    setForms(prevForms => 
      prevForms.map(form => 
        form._id === updatedForm._id ? updatedForm : form
      )
    );
    setSelectedForm(updatedForm);
  };

  const getResponseCount = (form: FormData) => {
    return form._id ? responseCounts[form._id] || 0 : 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Your Forms"
          description="Create and manage your forms"
          actionLabel="Create New Form"
          actionIcon={Plus}
          onAction={handleCreateForm}
        />

        {error && (
          <Alert
            type="error"
            message={error}
            className="mb-6"
          />
        )}

        {loading ? (
          <LoadingSpinner 
            size="lg" 
            text="Loading your forms..." 
            className="py-12"
          />
        ) : forms.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No forms yet"
            description="Create your first form to get started with collecting responses and insights."
            actionLabel="Create Your First Form"
            onAction={handleCreateForm}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <FormCard
                key={form._id}
                form={form}
                onEdit={(id) => navigate(`/forms/${id}/edit`)}
                onPreview={handlePreviewForm}
                onShare={handleShareForm}
                onAnalytics={handleAnalytics}
                responseCount={getResponseCount(form)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Share Form Modal */}
      <ShareFormModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setSelectedForm(null);
        }}
        form={selectedForm}
        onFormUpdate={handleFormUpdate}
      />

      {/* Activation Confirmation Modal */}
      {activationConfirmOpen && formToActivate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Form Not Active</h3>
              <p className="text-gray-600">
                The form "<span className="font-medium">{formToActivate.title}</span>" is not currently active. 
                Would you like to activate it so people can submit responses?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setActivationConfirmOpen(false);
                  setFormToActivate(null);
                }}
                disabled={activating}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivateAndShare}
                disabled={activating}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                {activating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Activating...
                  </>
                ) : (
                  'Activate & Share'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;