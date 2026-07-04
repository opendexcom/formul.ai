/** Shared Tailwind class fragments for the redesign design system. */

export const shellCardClass =
  'rounded-xl border border-gray-200 bg-white p-5 shadow-sm';

export const shellPageTitleClass = 'text-2xl font-semibold text-gray-900';

export const shellPageDescriptionClass = 'mt-1 text-sm text-gray-600';

export const shellSubNavLinkClass =
  'inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition';

export const shellTableHeaderClass =
  'text-xs font-semibold uppercase tracking-wide text-gray-500';

export type StudyType = 'single' | 'ab_test';

export type StudyStatus =
  | 'draft'
  | 'designing'
  | 'published'
  | 'collecting'
  | 'analyzing'
  | 'analyzed'
  | 'reported'
  | 'completed'
  | 'archived';

export type AiStatus =
  | 'ready'
  | 'needs_data'
  | 'reported'
  | 'analyzing'
  | 'not_started';

export const studyTypeBadgeClass: Record<StudyType, string> = {
  single: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ab_test: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};

export const studyStatusBadgeClass: Record<StudyStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  designing: 'bg-slate-100 text-slate-700',
  published: 'bg-sky-50 text-sky-700',
  collecting: 'bg-green-50 text-green-700',
  analyzing: 'bg-amber-50 text-amber-700',
  analyzed: 'bg-emerald-50 text-emerald-700',
  reported: 'bg-violet-50 text-violet-700',
  completed: 'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-500',
};

export const aiStatusBadgeClass: Record<AiStatus, string> = {
  ready: 'bg-green-50 text-green-700',
  needs_data: 'bg-amber-50 text-amber-700',
  reported: 'bg-violet-50 text-violet-700',
  analyzing: 'bg-amber-50 text-amber-700',
  not_started: 'bg-gray-100 text-gray-600',
};

export const studyStatusLabels: Record<StudyStatus, string> = {
  draft: 'Draft',
  designing: 'Designing',
  published: 'Published',
  collecting: 'Collecting',
  analyzing: 'Analyzing',
  analyzed: 'Analyzed',
  reported: 'Reported',
  completed: 'Completed',
  archived: 'Archived',
};

export const aiStatusLabels: Record<AiStatus, string> = {
  ready: 'Ready',
  needs_data: 'Needs more data',
  reported: 'Reported',
  analyzing: 'Analyzing…',
  not_started: 'Not started',
};

export function deriveAiStatus(
  status: StudyStatus,
  responseCount: number,
): AiStatus {
  if (status === 'analyzing') return 'analyzing';
  if (status === 'reported') return 'reported';
  if (status === 'analyzed' || status === 'completed') return 'ready';
  if (responseCount > 0 && ['collecting', 'published'].includes(status)) {
    return responseCount < 10 ? 'needs_data' : 'not_started';
  }
  return 'not_started';
}
