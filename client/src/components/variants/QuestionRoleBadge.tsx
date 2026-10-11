import React from 'react';

export type QuestionRole = 'core' | 'modify' | 'exclude' | 'polarity_flip';

const roleStyles: Record<QuestionRole, string> = {
  core: 'bg-gray-100 text-gray-700',
  modify: 'bg-blue-100 text-blue-800',
  exclude: 'bg-red-100 text-red-800',
  polarity_flip: 'bg-purple-100 text-purple-800',
};

const roleLabels: Record<QuestionRole, string> = {
  core: 'Core',
  modify: 'Modify',
  exclude: 'Excluded',
  polarity_flip: 'Polarity flip',
};

interface QuestionRoleBadgeProps {
  role: QuestionRole;
}

export const QuestionRoleBadge: React.FC<QuestionRoleBadgeProps> = ({ role }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleStyles[role]}`}
  >
    {roleLabels[role]}
  </span>
);
