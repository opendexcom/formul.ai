import React from 'react';
import { Question, QuestionType } from '../../services/formsService';
import { QuestionRole, QuestionRoleBadge } from './QuestionRoleBadge';

export type QuestionRolesMap = Record<string, QuestionRole>;

const POLARITY_ELIGIBLE_TYPES = new Set<string>([
  QuestionType.RATING,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.DROPDOWN,
]);

interface SplitQuestionPickerProps {
  questions: Question[];
  roles: QuestionRolesMap;
  onRoleChange: (questionId: string, role: QuestionRole) => void;
}

export const SplitQuestionPicker: React.FC<SplitQuestionPickerProps> = ({
  questions,
  roles,
  onRoleChange,
}) => {
  const sorted = [...questions].sort((a, b) => a.order - b.order);

  return (
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {sorted.map((question) => {
        const role = roles[question.id] ?? 'core';
        const canPolarityFlip = POLARITY_ELIGIBLE_TYPES.has(question.type);

        return (
          <div
            key={question.id}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-400">Q{question.order}</span>
                <QuestionRoleBadge role={role} />
                <span className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
                  {question.type}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-gray-900">{question.title}</p>
            </div>
            <select
              value={role}
              onChange={(event) =>
                onRoleChange(question.id, event.target.value as QuestionRole)
              }
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="core">Core (unchanged)</option>
              <option value="modify">Modify wording</option>
              {canPolarityFlip && (
                <option value="polarity_flip">Modify + reverse polarity</option>
              )}
              <option value="exclude">Exclude from variant</option>
            </select>
          </div>
        );
      })}
    </div>
  );
};

export function buildVariantPayloadFromRoles(roles: QuestionRolesMap): {
  excludeQuestionIds: string[];
  modifiedQuestionIds: string[];
  polarityFlippedQuestionIds: string[];
} {
  const excludeQuestionIds: string[] = [];
  const modifiedQuestionIds: string[] = [];
  const polarityFlippedQuestionIds: string[] = [];

  for (const [questionId, role] of Object.entries(roles)) {
    if (role === 'exclude') excludeQuestionIds.push(questionId);
    else if (role === 'modify') modifiedQuestionIds.push(questionId);
    else if (role === 'polarity_flip') {
      modifiedQuestionIds.push(questionId);
      polarityFlippedQuestionIds.push(questionId);
    }
  }

  return { excludeQuestionIds, modifiedQuestionIds, polarityFlippedQuestionIds };
}

export function summarizeRoles(roles: QuestionRolesMap): {
  core: number;
  modify: number;
  exclude: number;
  polarityFlip: number;
} {
  const counts = { core: 0, modify: 0, exclude: 0, polarityFlip: 0 };
  for (const role of Object.values(roles)) {
    if (role === 'core') counts.core += 1;
    else if (role === 'modify') counts.modify += 1;
    else if (role === 'exclude') counts.exclude += 1;
    else if (role === 'polarity_flip') counts.polarityFlip += 1;
  }
  return counts;
}
