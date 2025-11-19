import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import aiService, { GeneratedForm } from '../../services/aiService';

interface AIFormGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onFormGenerated: (form: GeneratedForm) => void;
  currentForm?: GeneratedForm;
}

const AIFormGenerator: React.FC<AIFormGeneratorProps> = ({
  isOpen,
  onClose,
  onFormGenerated,
  currentForm,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'generate' | 'refine'>('generate');

  const isAvailable = aiService.isAvailable();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for your form');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let generatedForm: GeneratedForm;
      
      if (mode === 'refine' && currentForm) {
        generatedForm = await aiService.refineForm(currentForm, prompt);
      } else {
        generatedForm = await aiService.generateForm(prompt);
      }

      onFormGenerated(generatedForm);
      setPrompt('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate form');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setPrompt('');
      setError(null);
      onClose();
    }
  };

  const examplePrompts = [
    'Customer satisfaction survey for a restaurant',
    'Employee onboarding form with personal and emergency contact information',
    'Event registration form with dietary preferences',
    'Product feedback form with rating scales',
    'Job application form with experience and skills',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="✨ AI Form Generator"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {!isAvailable ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-medium text-yellow-800">API Key Required</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  To use AI form generation, please set your OpenAI API key in the environment variable{' '}
                  <code className="bg-yellow-100 px-1 rounded">REACT_APP_OPENAI_API_KEY</code>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentForm && (
              <div className="flex gap-2 bg-gray-50 p-2 rounded-lg">
                <button
                  onClick={() => setMode('generate')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === 'generate'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Generate New
                </button>
                <button
                  onClick={() => setMode('refine')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === 'refine'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Refine Current
                </button>
              </div>
            )}

            <div>
              <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'refine' 
                  ? 'How would you like to refine your form?' 
                  : 'What kind of form do you want to build?'}
              </label>
              <textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'refine'
                    ? 'E.g., Add a section about dietary restrictions, make the email field required'
                    : 'E.g., Create a customer feedback survey for my coffee shop...'
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isGenerating}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {mode === 'generate' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Example prompts:</p>
                <div className="space-y-2">
                  {examplePrompts.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(example)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                      disabled={isGenerating}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {mode === 'refine' ? 'Refining...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {mode === 'refine' ? 'Refine Form' : 'Generate Form'}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default AIFormGenerator;
