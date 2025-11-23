import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';
import { FormData, Question, QuestionType } from '../services/formsService';
import { Button, LoadingSpinner, Alert } from '../components/ui';

interface FormResponse {
  [questionId: string]: string | number | string[] | boolean | null;
}

const PublicFormView: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData | null>(null);
  const [responses, setResponses] = useState<FormResponse>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (formId) {
      loadPublicForm(formId);
    }
  }, [formId]);

  const loadPublicForm = async (id: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/public/forms/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Form not found');
        } else if (response.status === 403) {
          throw new Error('This form is not publicly available or is no longer accepting responses');
        } else {
          throw new Error('Failed to load form');
        }
      }
      
      const formData = await response.json();
      setForm(formData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load form';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (questionId: string, value: string | number | string[] | boolean) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const { [questionId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateForm = (): boolean => {
    if (!form) return false;
    
    const errors: Record<string, string> = {};
    
    form.questions.forEach(question => {
      if (question.required && (!responses[question.id] || responses[question.id] === '')) {
        errors[question.id] = 'This field is required';
      }
      
      // Add specific validation based on question type
      if (responses[question.id]) {
        switch (question.type) {
          case QuestionType.EMAIL:
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(responses[question.id])) {
              errors[question.id] = 'Please enter a valid email address';
            }
            break;
          case QuestionType.NUMBER:
            if (isNaN(Number(responses[question.id]))) {
              errors[question.id] = 'Please enter a valid number';
            }
            break;
        }
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form || !validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/public/forms/${formId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId,
          responses,
          submittedAt: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Failed to submit response');
      }
      
      await response.json();
      
      if (!response.ok) {
        throw new Error('Failed to submit response');
      }
      
      setSubmitted(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit response';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id] || '';
    const hasError = validationErrors[question.id];
    
    const inputClasses = `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      hasError ? 'border-red-300' : 'border-gray-300'
    }`;

    switch (question.type) {
      case QuestionType.TEXT:
        return (
          <input
            type="text"
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );

      case QuestionType.TEXTAREA:
        return (
          <textarea
            className={inputClasses}
            rows={4}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );

      case QuestionType.EMAIL:
        return (
          <input
            type="email"
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your email address"
          />
        );

      case QuestionType.NUMBER:
        return (
          <input
            type="number"
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter a number"
          />
        );

      case QuestionType.DATE:
        return (
          <input
            type="date"
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case QuestionType.TIME:
        return (
          <input
            type="time"
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case QuestionType.MULTIPLE_CHOICE:
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case QuestionType.CHECKBOX:
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleInputChange(question.id, [...currentValues, option]);
                    } else {
                      handleInputChange(question.id, currentValues.filter(v => v !== option));
                    }
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case QuestionType.DROPDOWN:
        return (
          <select
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          >
            <option value="">Select an option</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case QuestionType.RATING:
        const maxRating = 5;
        return (
          <div className="flex space-x-2">
            {[...Array(maxRating)].map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleInputChange(question.id, index + 1)}
                className={`w-8 h-8 rounded-full border-2 ${
                  value > index
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
                } hover:border-blue-400 transition-colors`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            className={inputClasses}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading form..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert
            type="error"
            message={error}
            className="mb-4"
          />
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Thank you!
            </h2>
            <p className="text-gray-600 mb-6">
              Your response has been submitted successfully.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Form Header */}
          <div className="px-6 py-8 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {form.title}
            </h1>
            {form.description && (
              <p className="text-gray-600">
                {form.description}
              </p>
            )}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <Alert
                type="error"
                message={error}
                className="mb-6"
              />
            )}

            <div className="space-y-8">
              {form.questions
                .sort((a, b) => a.order - b.order)
                .map((question, index) => (
                  <div key={question.id} className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <span className="text-sm text-gray-500 mt-1">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <label className="block text-lg font-medium text-gray-900 mb-1">
                          {question.title}
                          {question.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {question.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {question.description}
                          </p>
                        )}
                        {renderQuestion(question)}
                        {validationErrors[question.id] && (
                          <div className="flex items-center space-x-1 mt-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-600">
                              {validationErrors[question.id]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={Send}
                loading={submitting}
                className="w-full"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Response'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PublicFormView;