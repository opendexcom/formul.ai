import React from 'react';
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Hash,
  Info,
  List,
  Mail,
  Star,
  Type,
} from 'lucide-react';
import { QuestionType } from '../../services/formsService';

interface FormFieldsPanelProps {
  onAddQuestion: (type: QuestionType) => void;
}

const fieldTypes: Array<{
  type: QuestionType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    type: QuestionType.TEXT,
    label: 'Short Text',
    description: 'Single line text input',
    icon: <Type className="h-4 w-4" />,
  },
  {
    type: QuestionType.TEXTAREA,
    label: 'Long Text',
    description: 'Multi-line text input',
    icon: <AlignLeft className="h-4 w-4" />,
  },
  {
    type: QuestionType.DROPDOWN,
    label: 'Dropdown',
    description: 'Select from dropdown list',
    icon: <ChevronDown className="h-4 w-4" />,
  },
  {
    type: QuestionType.CHECKBOX,
    label: 'Checkboxes',
    description: 'Multiple selection checkboxes',
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    type: QuestionType.MULTIPLE_CHOICE,
    label: 'Single Choice',
    description: 'Single selection radio buttons',
    icon: <List className="h-4 w-4" />,
  },
  {
    type: QuestionType.DATE,
    label: 'Date',
    description: 'Date picker',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    type: QuestionType.EMAIL,
    label: 'Email',
    description: 'Email address input',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    type: QuestionType.RATING,
    label: 'Rating',
    description: 'Star rating scale',
    icon: <Star className="h-4 w-4" />,
  },
  {
    type: QuestionType.NUMBER,
    label: 'Number',
    description: 'Numeric input',
    icon: <Hash className="h-4 w-4" />,
  },
  {
    type: QuestionType.TIME,
    label: 'Time',
    description: 'Time picker',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    type: QuestionType.COMMENT,
    label: 'Comment / Hint',
    description: 'Static text or hint for respondents',
    icon: <Info className="h-4 w-4" />,
  },
];

const FormFieldsPanel: React.FC<FormFieldsPanelProps> = ({ onAddQuestion }) => {
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div>
        <h2 className="text-base font-semibold leading-6 text-gray-900">Add Fields</h2>
        <p className="mt-1 text-[13px] leading-[18px] text-gray-500">Click to add form fields</p>
      </div>

      <div className="flex flex-col gap-2">
        {fieldTypes.map((field) => (
          <button
            key={field.type}
            type="button"
            onClick={() => onAddQuestion(field.type)}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                'application/json',
                JSON.stringify({
                  type: 'field',
                  fieldType: field.type,
                }),
              );
            }}
          >
            <span className="flex shrink-0 items-center justify-center rounded-md bg-gray-50 p-1.5 text-gray-600">
              {field.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium leading-4 text-gray-900">{field.label}</span>
              <span className="block truncate text-[13px] leading-[18px] text-gray-400">
                {field.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FormFieldsPanel;
