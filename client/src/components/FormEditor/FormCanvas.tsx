import React, { useState, useRef } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { FormData, Question, QuestionType } from '../../services/formsService';
import QuestionEditor from './QuestionEditor';
import { QuestionRoleBadge, type QuestionRole } from '../variants/QuestionRoleBadge';

interface FormCanvasProps {
  form: FormData;
  selectedQuestionId: string | null;
  onSelectQuestion: (questionId: string | null) => void;
  onUpdateForm: (updates: Partial<FormData>) => void;
  onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
  onDeleteQuestion: (questionId: string) => void;
  onDuplicateQuestion: (questionId: string) => void;
  onReorderQuestions: (startIndex: number, endIndex: number) => void;
  questionDesignRoles?: Record<string, QuestionRole>;
  sourceVariantQuestions?: Question[];
  sourceVariantLabel?: string;
}

const fieldShell =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-400';

function QuestionPreview({
  question,
  role,
}: {
  question: Question;
  role?: QuestionRole;
}) {
  return (
    <div className="flex flex-col gap-3">
      {role && role !== 'core' && <QuestionRoleBadge role={role} />}
      <p className="text-sm font-medium leading-5 text-gray-900">{question.title}</p>
      <div className="pointer-events-none">{renderPreviewControl(question)}</div>
    </div>
  );
}

function renderPreviewControl(question: Question) {
  const options = question.options?.length ? question.options : ['Option 1'];

  switch (question.type) {
    case QuestionType.TEXTAREA:
      return <div className={`${fieldShell} h-16`} />;
    case QuestionType.DROPDOWN:
      return (
        <div className={`${fieldShell} flex items-center justify-between`}>
          <span>Select</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      );
    case QuestionType.CHECKBOX:
    case QuestionType.MULTIPLE_CHOICE:
      return (
        <div className="flex flex-col gap-2">
          {options.slice(0, 4).map((option) => (
            <div key={option} className="flex items-center gap-2 text-xs text-gray-500">
              <span
                className={`h-4 w-4 border border-gray-300 ${
                  question.type === QuestionType.MULTIPLE_CHOICE ? 'rounded-full' : 'rounded'
                }`}
              />
              <span className="truncate">{option}</span>
            </div>
          ))}
        </div>
      );
    case QuestionType.RATING: {
      const max = Number(question.validation?.max?.value ?? 5);
      const count = Math.min(10, Math.max(1, Number.isFinite(max) ? max : 5));
      return (
        <div className="flex gap-2">
          {Array.from({ length: count }, (_, index) => (
            <Star key={index} className="h-5 w-5 text-amber-500" />
          ))}
        </div>
      );
    }
    case QuestionType.COMMENT:
      return (
        <p className="text-[13px] leading-[18px] text-gray-500">
          {question.description || 'Hint or instruction'}
        </p>
      );
    default:
      return <div className={fieldShell} />;
  }
}

const FormCanvas: React.FC<FormCanvasProps> = ({
  form,
  selectedQuestionId,
  onSelectQuestion,
  onUpdateForm,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onReorderQuestions,
  questionDesignRoles,
  sourceVariantQuestions,
  sourceVariantLabel,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    const dragData = e.dataTransfer.getData('application/json');

    if (dragData) {
      try {
        const { type, fieldType } = JSON.parse(dragData);
        if (type === 'field') {
          const newQuestion: Question = {
            id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: getDefaultQuestionTitle(fieldType),
            type: fieldType,
            required: false,
            order: dropIndex,
            options: needsOptions(fieldType) ? ['Option 1'] : undefined,
            canBeOther: false,
          };

          const updatedQuestions = [...form.questions];
          updatedQuestions.splice(dropIndex, 0, newQuestion);
          const reorderedQuestions = updatedQuestions.map((q, index) => ({ ...q, order: index }));

          onUpdateForm({ questions: reorderedQuestions });
          onSelectQuestion(newQuestion.id);
        }
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    } else if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderQuestions(draggedIndex, dropIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');

    if (dragData) {
      try {
        const { type } = JSON.parse(dragData);
        if (type === 'field') {
          handleDrop(e, form.questions.length);
        }
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    }
  };

  const orderedQuestions = [...form.questions].sort((a, b) => a.order - b.order);

  return (
    <div
      ref={canvasRef}
      className="flex min-h-full justify-center bg-gray-50 p-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <div className="flex h-fit w-full max-w-[500px] flex-col gap-6 rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => onUpdateForm({ title: e.target.value })}
            className="w-full bg-transparent p-0 text-2xl font-bold leading-8 text-gray-900 outline-none"
            placeholder="Untitled Form"
          />
          <textarea
            value={form.description || ''}
            onChange={(e) => onUpdateForm({ description: e.target.value })}
            className="w-full resize-none bg-transparent p-0 text-[13px] leading-[18px] text-gray-500 outline-none placeholder:text-gray-400"
            placeholder="Form description (optional)"
            rows={2}
          />
        </div>

        {orderedQuestions.length === 0 ? (
          <div className="py-6 text-center">
            <h3 className="text-sm font-medium text-gray-900">No fields added yet</h3>
            <p className="mt-1 text-[13px] text-gray-500">Add fields from the panel on the left</p>
          </div>
        ) : (
          orderedQuestions.map((question, index) => {
            const selected = selectedQuestionId === question.id;
            return (
              <div
                key={question.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative rounded-lg border bg-white transition-colors ${
                  selected ? 'border-blue-600' : 'border-gray-200 hover:border-gray-300'
                } ${dragOverIndex === index ? 'border-blue-400 bg-blue-50' : ''} ${
                  draggedIndex === index ? 'opacity-60' : ''
                }`}
                onClick={() => onSelectQuestion(question.id)}
              >
                {selected ? (
                  <QuestionEditor
                    question={question}
                    isSelected
                    onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
                    onDelete={() => onDeleteQuestion(question.id)}
                    onDuplicate={() => onDuplicateQuestion(question.id)}
                    questionDesignRole={questionDesignRoles?.[question.id]}
                    sourceVariantQuestions={sourceVariantQuestions}
                    sourceVariantLabel={sourceVariantLabel}
                  />
                ) : (
                  <div className="p-5">
                    <QuestionPreview
                      question={question}
                      role={questionDesignRoles?.[question.id]}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}

        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-gray-400 p-5 text-center text-[13px] leading-[18px] text-gray-500"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          Drop fields here to add them to your form
        </div>
      </div>
    </div>
  );
};

function getDefaultQuestionTitle(type: QuestionType): string {
  const titles = {
    [QuestionType.TEXT]: 'Short Answer',
    [QuestionType.TEXTAREA]: 'Long Answer',
    [QuestionType.MULTIPLE_CHOICE]: 'Single Choice',
    [QuestionType.CHECKBOX]: 'Checkboxes',
    [QuestionType.DROPDOWN]: 'Dropdown',
    [QuestionType.EMAIL]: 'Email',
    [QuestionType.NUMBER]: 'Number',
    [QuestionType.DATE]: 'Date',
    [QuestionType.TIME]: 'Time',
    [QuestionType.RATING]: 'Rating',
    [QuestionType.COMMENT]: 'Hint or instruction',
  };
  return titles[type] || 'Question';
}

function needsOptions(type: QuestionType): boolean {
  return [QuestionType.MULTIPLE_CHOICE, QuestionType.CHECKBOX, QuestionType.DROPDOWN].includes(type);
}

export default FormCanvas;
