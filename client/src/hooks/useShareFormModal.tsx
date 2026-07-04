import { useState } from 'react';
import { ShareFormModal } from '../components/common';
import formsService, { FormData } from '../services/formsService';
import { logger } from '../utils/logger';

export function useShareFormModal(onFormUpdate?: (updatedForm: FormData) => void) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormData | null>(null);
  const [activationConfirmOpen, setActivationConfirmOpen] = useState(false);
  const [formToActivate, setFormToActivate] = useState<FormData | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');

  const handleFormUpdate = (updatedForm: FormData) => {
    setSelectedForm(updatedForm);
    onFormUpdate?.(updatedForm);
  };

  const openShareForForm = (form: FormData) => {
    if (!form.isActive) {
      setFormToActivate(form);
      setActivationConfirmOpen(true);
      return;
    }
    setSelectedForm(form);
    setShareModalOpen(true);
  };

  const handleActivateAndShare = async () => {
    if (!formToActivate?._id) return;

    setActivating(true);
    setActivationError('');
    try {
      const updatedForm = await formsService.updateForm(formToActivate._id, { isActive: true });
      setActivationConfirmOpen(false);
      setFormToActivate(null);
      setSelectedForm(updatedForm);
      setShareModalOpen(true);
      onFormUpdate?.(updatedForm);
    } catch (error) {
      logger.error('Error activating form:', error);
      setActivationError('Failed to activate form');
    } finally {
      setActivating(false);
    }
  };

  const ShareFormUI = () => (
    <>
      <ShareFormModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setSelectedForm(null);
        }}
        form={selectedForm}
        onFormUpdate={handleFormUpdate}
      />

      {activationConfirmOpen && formToActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Form Not Active</h3>
              <p className="text-gray-600">
                The form &quot;<span className="font-medium">{formToActivate.title}</span>&quot; is not
                currently active. Would you like to activate it so people can submit responses?
              </p>
              {activationError && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {activationError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setActivationConfirmOpen(false);
                  setFormToActivate(null);
                  setActivationError('');
                }}
                disabled={activating}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivateAndShare}
                disabled={activating}
                className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activating ? 'Activating...' : 'Activate & Share'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { openShareForForm, ShareFormUI };
}
