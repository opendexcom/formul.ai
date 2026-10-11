import { VariantQuestionDiffService } from './variant-question-diff.service';
import { QuestionType } from '../schemas/form.schema';

describe('VariantQuestionDiffService', () => {
  const service = new VariantQuestionDiffService();

  const baseQuestion = {
    id: 'q1',
    title: 'How do you feel?',
    type: QuestionType.TEXT,
    required: true,
    order: 1,
  };

  it('detects identical questions across variants', () => {
    const result = service.diffVariantQuestions([
      { key: 'main', questions: [baseQuestion] },
      { key: 'A', questions: [{ ...baseQuestion }] },
    ]);

    expect(result.sharedQuestionIds).toEqual(['q1']);
    expect(result.designInterpretation).toContain('identical');
    expect(result.perVariant.main?.changedQuestions).toHaveLength(0);
  });

  it('detects changed question titles', () => {
    const result = service.diffVariantQuestions([
      { key: 'main', questions: [baseQuestion] },
      {
        key: 'A',
        questions: [{ ...baseQuestion, title: 'How do you feel today?' }],
      },
    ]);

    expect(result.perVariant.A?.changedQuestions.some((c) => c.field === 'title')).toBe(true);
    expect(result.designInterpretation).not.toContain('identical');
  });

  it('detects added questions per variant', () => {
    const result = service.diffVariantQuestions([
      { key: 'main', questions: [baseQuestion] },
      {
        key: 'A',
        questions: [
          baseQuestion,
          {
            id: 'q2',
            title: 'Extra question',
            type: QuestionType.TEXT,
            required: false,
            order: 2,
          },
        ],
      },
    ]);

    expect(result.perVariant.A?.addedQuestionIds).toContain('q2');
  });

  it('detects reverse-coded polarity changes', () => {
    const ratingQuestion = {
      id: 'q-rating',
      title: 'I feel positive at work',
      type: QuestionType.RATING,
      required: true,
      order: 1,
      reverseCoded: false,
    };

    const result = service.diffVariantQuestions([
      { key: 'main', questions: [ratingQuestion] },
      {
        key: 'A',
        questions: [{ ...ratingQuestion, reverseCoded: true }],
      },
    ]);

    expect(result.polarityChanges?.length).toBeGreaterThan(0);
    expect(result.designInterpretation).toContain('reverse-coded');
  });
});
