import React, { useState, useRef } from 'react';
import { FormData, Question, QuestionType } from '../../services/formsService';
import QuestionEditor from './QuestionEditor';

interface FormCanvasProps {
  form: FormData;
  selectedQuestionId: string | null;
  onSelectQuestion: (questionId: string | null) => void;
  onUpdateForm: (updates: Partial<FormData>) => void;
  onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
  onDeleteQuestion: (questionId: string) => void;
  onDuplicateQuestion: (questionId: string) => void;
  onReorderQuestions: (startIndex: number, endIndex: number) => void;
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
          // Adding new field from panel
          const newQuestion: Question = {
            id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: getDefaultQuestionTitle(fieldType),
            type: fieldType,
            required: false,
            order: dropIndex,
            options: needsOptions(fieldType) ? ['Option 1'] : undefined,
          };

          const updatedQuestions = [...form.questions];
          updatedQuestions.splice(dropIndex, 0, newQuestion);
          
          // Update order for all questions
          const reorderedQuestions = updatedQuestions.map((q, index) => ({ ...q, order: index }));
          
          onUpdateForm({ questions: reorderedQuestions });
          onSelectQuestion(newQuestion.id);
        }
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    } else if (draggedIndex !== null && draggedIndex !== dropIndex) {
      // Reordering existing questions
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
          // Add to end of form
          handleDrop(e, form.questions.length);
        }
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    }
  };

  const getDefaultQuestionTitle = (type: QuestionType): string => {
    const titles = {
      [QuestionType.TEXT]: 'Short Answer',
      [QuestionType.TEXTAREA]: 'Long Answer',
      [QuestionType.MULTIPLE_CHOICE]: 'Multiple Choice',
      [QuestionType.CHECKBOX]: 'Checkboxes',
      [QuestionType.DROPDOWN]: 'Dropdown',
      [QuestionType.EMAIL]: 'Email',
      [QuestionType.NUMBER]: 'Number',
      [QuestionType.DATE]: 'Date',
      [QuestionType.TIME]: 'Time',
      [QuestionType.RATING]: 'Rating',
    };
    return titles[type] || 'Question';
  };

  const needsOptions = (type: QuestionType): boolean => {
    return [QuestionType.MULTIPLE_CHOICE, QuestionType.CHECKBOX, QuestionType.DROPDOWN].includes(type);
  };

  return (
    <div 
      ref={canvasRef}
      className="max-w-4xl mx-auto p-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      {/* Form Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <input
          type="text"
          value={form.title}
          onChange={(e) => onUpdateForm({ title: e.target.value })}
          className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full mb-2"
          placeholder="Untitled Form"
        />
        <textarea
          value={form.description || ''}
          onChange={(e) => onUpdateForm({ description: e.target.value })}
          className="text-gray-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full resize-none"
          placeholder="Form description (optional)"
          rows={2}
        />
      </div>

      {/* Questions */}
      {form.questions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No fields added yet</h3>
          <p className="text-gray-500">Add fields from the panel on the left</p>
        </div>
      ) : (
        <div className="space-y-4">
          {form.questions
            .sort((a, b) => a.order - b.order)
            .map((question, index) => (
              <div
                key={question.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative bg-white rounded-lg shadow-sm border-2 transition-all ${
                  selectedQuestionId === question.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                } ${
                  dragOverIndex === index ? 'border-blue-400 bg-blue-50' : ''
                }`}
                onClick={() => onSelectQuestion(question.id)}
              >
                {dragOverIndex === index && (
                  <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
                
                <QuestionEditor
                  question={question}
                  isSelected={selectedQuestionId === question.id}
                  onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
                  onDelete={() => onDeleteQuestion(question.id)}
                  onDuplicate={() => onDuplicateQuestion(question.id)}
                />
              </div>
            ))}
        </div>
      )}

      {/* Drop Zone */}
      {form.questions.length > 0 && (
        <div
          className="mt-6 p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          Drop fields here to add them to your form
        </div>
      )}
    </div>
  );
};

export default FormCanvas;