import React, { useState } from 'react';
import { Question, QuestionType } from '../../services/formsService';

interface QuestionEditorProps {
  question: Question;
  isSelected: boolean;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  isSelected,
  onUpdate,
  onDelete,
  onDuplicate,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const addOption = () => {
    const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
    onUpdate({ options: newOptions });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = question.options?.filter((_, i) => i !== index) || [];
    onUpdate({ options: newOptions });
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case QuestionType.TEXT:
        return (
          <input
            type="text"
            placeholder="Short answer text"
            className="w-full p-3 border border-gray-300 rounded-md bg-gray-50"
            disabled
          />
        );

      case QuestionType.TEXTAREA:
        return (
          <textarea
            placeholder="Long answer text"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-md bg-gray-50 resize-none"
            disabled
          />
        );

      case QuestionType.EMAIL:
        return (
          <input
            type="email"
            placeholder="Email address"
            className="w-full p-3 border border-gray-300 rounded-md bg-gray-50"
            disabled
          />
        );

      case QuestionType.NUMBER:
        return (
          <input
            type="number"
            placeholder="Number"
            className="w-full p-3 border border-gray-300 rounded-md bg-gray-50"
            disabled
          />
        );

      case QuestionType.DATE:
        return (
          <input
            type="date"
            className="w-full p-3 border border-gray-300 rounded-md bg-gray-50"
            disabled
          />
        );

      case QuestionType.MULTIPLE_CHOICE:
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <input type="radio" disabled className="text-blue-600" />
                {isSelected ? (
                  <div className="flex items-center space-x-2 flex-1">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded"
                      placeholder={`Option ${index + 1}`}
                    />
                    {question.options && question.options.length > 1 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-700">{option}</span>
                )}
              </div>
            ))}
            {isSelected && (
              <button
                onClick={addOption}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add option</span>
              </button>
            )}
          </div>
        );

      case QuestionType.CHECKBOX:
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <input type="checkbox" disabled className="text-blue-600" />
                {isSelected ? (
                  <div className="flex items-center space-x-2 flex-1">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded"
                      placeholder={`Option ${index + 1}`}
                    />
                    {question.options && question.options.length > 1 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-700">{option}</span>
                )}
              </div>
            ))}
            {isSelected && (
              <button
                onClick={addOption}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add option</span>
              </button>
            )}
          </div>
        );

      case QuestionType.DROPDOWN:
        return (
          <div>
            <select className="w-full p-3 border border-gray-300 rounded-md bg-gray-50" disabled>
              <option>Choose...</option>
              {question.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {isSelected && (
              <div className="mt-3 space-y-2">
                {question.options?.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded"
                      placeholder={`Option ${index + 1}`}
                    />
                    {question.options && question.options.length > 1 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add option</span>
                </button>
              </div>
            )}
          </div>
        );

      case QuestionType.RATING:
        return (
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className="w-6 h-6 text-gray-300"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                  clipRule="evenodd"
                />
              </svg>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      {/* Question Title */}
      <div className="mb-4">
        {isSelected ? (
          <input
            type="text"
            value={question.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
            placeholder="Question title"
            autoFocus={isEditing}
          />
        ) : (
          <h3 
            className="text-lg font-medium text-gray-900 cursor-text"
            onClick={() => setIsEditing(true)}
          >
            {question.title}
          </h3>
        )}
        
        {isSelected && question.description !== undefined && (
          <textarea
            value={question.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="mt-2 text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full resize-none"
            placeholder="Question description (optional)"
            rows={2}
          />
        )}
      </div>

      {/* Question Input */}
      <div className="mb-4">
        {renderQuestionInput()}
      </div>

      {/* Question Actions */}
      {isSelected && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700">Required</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onDuplicate}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Duplicate question"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              title="Delete question"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Drag Handle */}
      {isSelected && (
        <div className="absolute left-2 top-6 cursor-move text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default QuestionEditor;