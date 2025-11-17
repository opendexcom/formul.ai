import React, { useState } from 'react';
import { FormData, Question, QuestionType } from '../../services/formsService';

interface FormPreviewProps {
  form: FormData;
}

const FormPreview: React.FC<FormPreviewProps> = ({ form }) => {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 5; // For pagination if needed
  
  const totalPages = Math.ceil(form.questions.length / questionsPerPage);
  const currentQuestions = form.questions
    .sort((a, b) => a.order - b.order)
    .slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);

  const handleInputChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', responses);
    alert('Form submitted successfully! (Preview mode)');
  };

  const renderQuestionInput = (question: Question) => {
    const value = responses[question.id] || '';

    switch (question.type) {
      case QuestionType.TEXT:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Your answer"
            required={question.required}
          />
        );

      case QuestionType.TEXTAREA:
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Your answer"
            required={question.required}
          />
        );

      case QuestionType.EMAIL:
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="your.email@example.com"
            required={question.required}
          />
        );

      case QuestionType.NUMBER:
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter a number"
            required={question.required}
          />
        );

      case QuestionType.DATE:
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required={question.required}
          />
        );

      case QuestionType.MULTIPLE_CHOICE:
        return (
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                  required={question.required}
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case QuestionType.CHECKBOX:
        return (
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  value={option}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter(v => v !== option);
                    handleInputChange(question.id, newValues);
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case QuestionType.DROPDOWN:
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required={question.required}
          >
            <option value="">Choose an option</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case QuestionType.RATING:
        return (
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleInputChange(question.id, rating)}
                className={`w-8 h-8 ${
                  value >= rating ? 'text-yellow-400' : 'text-gray-300'
                } hover:text-yellow-400 transition-colors`}
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const progressPercentage = form.settings.showProgressBar 
    ? Math.round(((currentPage + 1) / Math.max(totalPages, 1)) * 100)
    : 0;

  return (
    <div 
      className="min-h-screen p-8"
      style={{ 
        backgroundColor: form.settings.customTheme?.backgroundColor || '#F9FAFB',
        fontFamily: form.settings.customTheme?.fontFamily || 'Inter'
      }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Preview Mode Banner */}
        <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-blue-800 font-medium">Preview Mode</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            This is how your form will appear to respondents. Submissions will not be saved.
          </p>
        </div>

        {/* Progress Bar */}
        {form.settings.showProgressBar && totalPages > 1 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: form.settings.customTheme?.primaryColor || '#3B82F6'
                }}
              />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Form Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {form.title}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-lg leading-relaxed">
                {form.description}
              </p>
            )}
          </div>

          {/* Questions */}
          {currentQuestions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
              <p className="text-gray-500">Add some questions to see the preview</p>
            </div>
          ) : (
            currentQuestions.map((question) => (
              <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-4">
                  <label className="block text-lg font-medium text-gray-900 mb-2">
                    {question.title}
                    {question.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {question.description && (
                    <p className="text-gray-600 text-sm mb-4">
                      {question.description}
                    </p>
                  )}
                </div>
                {renderQuestionInput(question)}
              </div>
            ))
          )}

          {/* Navigation & Submit */}
          {currentQuestions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                  {totalPages > 1 && currentPage > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Previous
                    </button>
                  )}
                </div>
                
                <div className="flex space-x-4">
                  {totalPages > 1 && currentPage < totalPages - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="px-6 py-2 text-white rounded-md hover:opacity-90"
                      style={{ backgroundColor: form.settings.customTheme?.primaryColor || '#3B82F6' }}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-6 py-2 text-white rounded-md hover:opacity-90"
                      style={{ backgroundColor: form.settings.customTheme?.primaryColor || '#3B82F6' }}
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default FormPreview;