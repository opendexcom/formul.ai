import React from 'react';
import {
  ClosedQuestionComparison,
  QuestionDiffResult,
  SplitQuestionnaireDesign,
  VariantKey,
} from '../../types/comparative-report';
import { QuestionRoleBadge } from '../variants/QuestionRoleBadge';
import type { QuestionRole } from '../variants/QuestionRoleBadge';

interface QuestionDiffCardProps {
  questionDiff: QuestionDiffResult;
  splitQuestionnaireDesign?: SplitQuestionnaireDesign;
}

function titleFor(
  questionId: string,
  questionTitles?: QuestionDiffResult['questionTitles'],
): string {
  const ref = questionTitles?.find((q) => q.questionId === questionId);
  return ref?.title ?? questionId;
}

function plannedRole(
  questionId: string,
  variantKey: VariantKey,
  design?: SplitQuestionnaireDesign,
): QuestionRole | null {
  if (!design) return null;
  const variantDesign = design.perVariant[variantKey];
  if (!variantDesign) return null;
  if (variantDesign.polarityFlippedQuestionIds.includes(questionId)) return 'polarity_flip';
  if (variantDesign.modifiedQuestionIds.includes(questionId)) return 'modify';
  if (variantDesign.excludedQuestionIds.includes(questionId)) return 'exclude';
  if (design.coreQuestionIds.includes(questionId)) return 'core';
  return null;
}

export const QuestionDiffCard: React.FC<QuestionDiffCardProps> = ({
  questionDiff,
  splitQuestionnaireDesign,
}) => {
  const variantKeys = Object.keys(questionDiff.perVariant) as VariantKey[];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Question design</h2>
      <p className="mt-2 text-sm text-gray-600">{questionDiff.designInterpretation}</p>
      <p className="mt-2 text-sm text-gray-500">
        {questionDiff.sharedQuestionIds.length} shared question(s) across variants.
      </p>

      {splitQuestionnaireDesign && (
        <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-4">
          <h3 className="text-sm font-semibold text-purple-900">Planned split design</h3>
          <p className="mt-1 text-sm text-purple-800">
            {splitQuestionnaireDesign.coreQuestionIds.length} core question(s)
          </p>
          {(['main', 'A', 'B'] as VariantKey[]).map((key) => {
            const design = splitQuestionnaireDesign.perVariant[key];
            if (!design) return null;
            const hasPlanned =
              design.modifiedQuestionIds.length > 0 ||
              design.excludedQuestionIds.length > 0 ||
              design.polarityFlippedQuestionIds.length > 0;
            if (!hasPlanned) return null;
            return (
              <div key={key} className="mt-2 text-sm text-purple-800">
                <p className="font-medium">Variant {key}</p>
                {design.modifiedQuestionIds.length > 0 && (
                  <p className="mt-1">
                    Modified:{' '}
                    {design.modifiedQuestionIds
                      .map((id) => titleFor(id, questionDiff.questionTitles))
                      .join(', ')}
                  </p>
                )}
                {design.polarityFlippedQuestionIds.length > 0 && (
                  <p className="mt-1">
                    Polarity-flipped:{' '}
                    {design.polarityFlippedQuestionIds
                      .map((id) => titleFor(id, questionDiff.questionTitles))
                      .join(', ')}
                  </p>
                )}
                {design.excludedQuestionIds.length > 0 && (
                  <p className="mt-1">
                    Excluded:{' '}
                    {design.excludedQuestionIds
                      .map((id) => titleFor(id, questionDiff.questionTitles))
                      .join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {variantKeys.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Detected differences</h3>
          {variantKeys.map((key) => {
            const diff = questionDiff.perVariant[key];
            if (!diff) return null;
            const hasChanges =
              diff.addedQuestionIds.length > 0 ||
              diff.removedQuestionIds.length > 0 ||
              diff.changedQuestions.length > 0;
            if (!hasChanges) return null;
            return (
              <div key={String(key)} className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-800">Variant {String(key)}</p>
                {diff.addedQuestionIds.length > 0 && (
                  <p className="mt-1 text-gray-600">
                    Added:{' '}
                    {diff.addedQuestionIds
                      .map((id) => titleFor(id, questionDiff.questionTitles))
                      .join(', ')}
                  </p>
                )}
                {diff.removedQuestionIds.length > 0 && (
                  <p className="mt-1 text-gray-600">
                    Removed:{' '}
                    {diff.removedQuestionIds
                      .map((id) => titleFor(id, questionDiff.questionTitles))
                      .join(', ')}
                  </p>
                )}
                {diff.changedQuestions.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-gray-600">
                    {diff.changedQuestions.slice(0, 8).map((change) => (
                      <li key={`${change.questionId}-${change.field}`}>
                        {titleFor(change.questionId, questionDiff.questionTitles)} ({change.field})
                        {change.field === 'reverseCoded' && (
                          <span className="ml-1 rounded bg-purple-100 px-1 text-xs text-purple-800">
                            reverse coded
                          </span>
                        )}
                        {plannedRole(change.questionId, key, splitQuestionnaireDesign) && (
                          <span className="ml-2 inline-flex">
                            <QuestionRoleBadge
                              role={
                                plannedRole(change.questionId, key, splitQuestionnaireDesign)!
                              }
                            />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(questionDiff.questionTitles ?? []).some((q) => q.reverseCoded) && (
        <div className="mt-4 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
          <p className="font-medium">Reverse-coded items</p>
          <ul className="mt-1 list-disc pl-5">
            {(questionDiff.questionTitles ?? [])
              .filter((q) => q.reverseCoded)
              .map((q) => (
                <li key={q.questionId}>{q.title}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface ClosedQuestionComparisonCardProps {
  comparisons: ClosedQuestionComparison[];
}

export const ClosedQuestionComparisonCard: React.FC<ClosedQuestionComparisonCardProps> = ({
  comparisons,
}) => {
  if (comparisons.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Closed-question comparison</h2>
      <p className="mt-1 text-sm text-gray-600">
        Shared rating and choice questions compared across variants. Distributions are normalized
        when reverse coding applies.
      </p>
      <div className="mt-4 space-y-4">
        {comparisons.map((comparison) => (
          <div key={comparison.questionId} className="rounded-lg border border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-gray-900">{comparison.questionTitle}</p>
              {comparison.normalizedForComparison && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                  Normalized for reverse coding
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {comparison.perVariant.map((entry) => (
                <div key={entry.key} className="rounded bg-gray-50 p-3 text-sm">
                  <p className="font-medium text-gray-800">
                    Variant {entry.key}
                    {entry.reverseCoded && (
                      <span className="ml-2 text-xs text-purple-700">(reverse coded)</span>
                    )}
                  </p>
                  <ul className="mt-1 text-gray-600">
                    {Object.entries(entry.distribution)
                      .slice(0, 6)
                      .map(([answer, count]) => (
                        <li key={answer}>
                          {answer}: {count}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
