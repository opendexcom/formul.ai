import { Injectable } from '@nestjs/common';
import { Question } from '../schemas/form.schema';
import {
  QuestionDiffResult,
  QuestionFieldChange,
  QuestionTitleRef,
  VariantKey,
  VariantQuestionDiff,
} from './comparative-report.types';

const COMPARABLE_FIELDS: Array<keyof Question> = [
  'title',
  'description',
  'type',
  'required',
  'order',
  'options',
  'reverseCoded',
];

@Injectable()
export class VariantQuestionDiffService {
  diffVariantQuestions(
    variantQuestions: Array<{ key: VariantKey; questions: Question[] }>,
  ): QuestionDiffResult {
    const allIds = new Set<string>();
    const idsByVariant = new Map<VariantKey, Set<string>>();

    for (const { key, questions } of variantQuestions) {
      const ids = new Set(questions.map((q) => q.id));
      idsByVariant.set(key, ids);
      ids.forEach((id) => allIds.add(id));
    }

    const sharedQuestionIds = [...allIds].filter((id) =>
      variantQuestions.every(({ key }) => idsByVariant.get(key)?.has(id)),
    );

    const perVariant: Partial<Record<VariantKey, VariantQuestionDiff>> = {};
    const questionsByVariant = new Map(
      variantQuestions.map(({ key, questions }) => [key, questions]),
    );

    const polarityChanges: QuestionFieldChange[] = [];
    for (const { key } of variantQuestions) {
      const variantIds = idsByVariant.get(key) ?? new Set<string>();
      const addedQuestionIds = [...variantIds].filter((id) => !sharedQuestionIds.includes(id));
      const removedQuestionIds = [...allIds].filter(
        (id) => sharedQuestionIds.includes(id) === false && !variantIds.has(id),
      );

      const changedQuestions: QuestionFieldChange[] = [];
      for (const questionId of sharedQuestionIds) {
        const snapshots = variantQuestions
          .map(({ key: variantKey }) => {
            const question = questionsByVariant.get(variantKey)?.find((q) => q.id === questionId);
            return question ? { variantKey, question } : null;
          })
          .filter(Boolean) as Array<{ variantKey: VariantKey; question: Question }>;

        if (snapshots.length < 2) continue;

        const baseline = snapshots[0].question;
        for (const { variantKey, question } of snapshots.slice(1)) {
          for (const field of COMPARABLE_FIELDS) {
            const before = this.serializeField(baseline[field]);
            const after = this.serializeField(question[field]);
            if (before !== after) {
              const change = {
                questionId,
                field: String(field),
                before,
                after: `${variantKey}: ${after}`,
              };
              changedQuestions.push(change);
              if (field === 'reverseCoded') {
                polarityChanges.push(change);
              }
            }
          }
        }
      }

      perVariant[key] = {
        addedQuestionIds,
        removedQuestionIds,
        changedQuestions: this.dedupeChanges(changedQuestions),
      };
    }

    const questionTitles = this.buildQuestionTitles(variantQuestions);

    return {
      sharedQuestionIds,
      perVariant,
      designInterpretation: this.buildDesignInterpretation(
        variantQuestions,
        sharedQuestionIds,
        perVariant,
        questionTitles,
        polarityChanges,
      ),
      polarityChanges,
      questionTitles,
    };
  }

  private buildQuestionTitles(
    variantQuestions: Array<{ key: VariantKey; questions: Question[] }>,
  ): QuestionTitleRef[] {
    const titleMap = new Map<string, QuestionTitleRef>();
    for (const { questions } of variantQuestions) {
      for (const question of questions) {
        if (!titleMap.has(question.id)) {
          titleMap.set(question.id, {
            questionId: question.id,
            title: question.title,
            reverseCoded: question.reverseCoded ?? false,
          });
        }
      }
    }
    return [...titleMap.values()];
  }

  private serializeField(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return JSON.stringify(value);
    return String(value);
  }

  private dedupeChanges(changes: QuestionFieldChange[]): QuestionFieldChange[] {
    const seen = new Set<string>();
    return changes.filter((change) => {
      const key = `${change.questionId}:${change.field}:${change.before}:${change.after}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildDesignInterpretation(
    variantQuestions: Array<{ key: VariantKey; questions: Question[] }>,
    sharedQuestionIds: string[],
    perVariant: Partial<Record<VariantKey, VariantQuestionDiff>>,
    questionTitles: QuestionTitleRef[],
    polarityChanges: QuestionFieldChange[],
  ): string {
    const hasStructuralDiff = Object.values(perVariant).some(
      (diff) =>
        (diff?.addedQuestionIds.length ?? 0) > 0 ||
        (diff?.removedQuestionIds.length ?? 0) > 0 ||
        (diff?.changedQuestions.length ?? 0) > 0,
    );

    if (!hasStructuralDiff && variantQuestions.length > 1) {
      return 'Questions are identical across variants; differences are likely in audience/target group or research notes.';
    }

    const changedCount = Object.values(perVariant).reduce(
      (sum, diff) => sum + (diff?.changedQuestions.length ?? 0),
      0,
    );
    const addedCount = Object.values(perVariant).reduce(
      (sum, diff) => sum + (diff?.addedQuestionIds.length ?? 0),
      0,
    );

    const parts = [
      `${sharedQuestionIds.length} question(s) are shared across all variants.`,
    ];
    if (changedCount > 0) {
      parts.push(`${changedCount} field change(s) detected on shared questions.`);
    }
    if (addedCount > 0) {
      parts.push(`${addedCount} variant-specific question addition(s) detected.`);
    }
    if (polarityChanges.length > 0) {
      const titles = polarityChanges
        .map((change) => {
          const ref = questionTitles.find((q) => q.questionId === change.questionId);
          return ref ? `"${ref.title}"` : change.questionId;
        })
        .join(', ');
      parts.push(
        `${polarityChanges.length} reverse-coded polarity change(s) on: ${titles}.`,
      );
    }
    const reverseCodedItems = questionTitles.filter((q) => q.reverseCoded);
    if (reverseCodedItems.length > 0) {
      parts.push(
        `Reverse-coded items: ${reverseCodedItems.map((q) => `"${q.title}"`).join(', ')}.`,
      );
    }
    parts.push(
      'Comparisons on closed questions and topics are limited to shared question IDs.',
    );
    return parts.join(' ');
  }
}
