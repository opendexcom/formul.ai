import React from 'react';
import { QuestionType } from '../../services/formsService';

interface FormFieldsPanelProps {
  onAddQuestion: (type: QuestionType) => void;
}

const fieldTypes = [
  {
    type: QuestionType.TEXT,
    label: 'Short Text',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
    description: 'Single line text input'
  },
  {
    type: QuestionType.TEXTAREA,
    label: 'Long Text',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    description: 'Multi-line text input'
  },
  {
    type: QuestionType.DROPDOWN,
    label: 'Dropdown',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    ),
    description: 'Select from dropdown list'
  },
  {
    type: QuestionType.CHECKBOX,
    label: 'Checkboxes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Multiple selection checkboxes'
  },
  {
    type: QuestionType.MULTIPLE_CHOICE,
    label: 'Multiple Choice',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Single selection radio buttons'
  },
  {
    type: QuestionType.DATE,
    label: 'Date',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Date picker'
  },
  {
    type: QuestionType.EMAIL,
    label: 'Email',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Email address input'
  },
  {
    type: QuestionType.NUMBER,
    label: 'Number',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
    description: 'Numeric input'
  },
  {
    type: QuestionType.RATING,
    label: 'Rating',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    description: 'Star rating'
  }
];

const FormFieldsPanel: React.FC<FormFieldsPanelProps> = ({ onAddQuestion }) => {
  return (
    <div className="h-full">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Add Fields</h2>
        <p className="text-sm text-gray-600 mt-1">Drag or click to add form fields</p>
      </div>
      
      <div className="p-6 space-y-2">
        {fieldTypes.map((field) => (
          <button
            key={field.type}
            onClick={() => onAddQuestion(field.type)}
            className="w-full flex items-center space-x-3 p-3 text-left rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'field',
                fieldType: field.type
              }));
            }}
          >
            <div className="flex-shrink-0 text-gray-600 group-hover:text-blue-600">
              {field.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                {field.label}
              </div>
              <div className="text-xs text-gray-500 group-hover:text-blue-700">
                {field.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FormFieldsPanel;