import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import formsService, { FormData } from '../services/formsService';
import { Header, FormCard, PageHeader, ShareFormModal } from '../components/common';
import { LoadingSpinner, Alert, EmptyState } from '../components/ui';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormData | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});

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
    } catch (error: any) {
      setError('Failed to load forms');
      console.error('Error loading forms:', error);
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
      setSelectedForm(form);
      setShareModalOpen(true);
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
    </div>
  );
};

export default Dashboard;