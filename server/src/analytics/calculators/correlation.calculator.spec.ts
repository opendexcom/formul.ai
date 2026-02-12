import { CorrelationCalculator } from './correlation.calculator';
import { Types } from 'mongoose';

type MockResponse = {
  _id?: Types.ObjectId;
  metadata?: { canonicalTopics?: string[]; overallSentiment?: { label: string; score?: number } };
};

describe('CorrelationCalculator', () => {
  let calculator: CorrelationCalculator;

  beforeEach(() => {
    calculator = new CorrelationCalculator();
  });

  describe('calculateTopicCooccurrence', () => {
    it('returns empty when fewer than 2 topics per response', () => {
      const responses: MockResponse[] = [
        { _id: new Types.ObjectId(), metadata: { canonicalTopics: ['A'] } },
      ];
      const result = calculator.calculateTopicCooccurrence(responses as any);
      expect(result).toEqual([]);
    });

    it('counts topic pairs and assigns relationship strength', () => {
      const responses: MockResponse[] = [
        { _id: new Types.ObjectId(), metadata: { canonicalTopics: ['Work', 'Pay'] } },
        { _id: new Types.ObjectId(), metadata: { canonicalTopics: ['Work', 'Pay'] } },
        { _id: new Types.ObjectId(), metadata: { canonicalTopics: ['Work', 'Pay', 'Culture'] } },
      ];
      const result = calculator.calculateTopicCooccurrence(responses as any);

      expect(result.length).toBeGreaterThan(0);
      const workPay = result.find(r =>
        (r.topic1 === 'Work' && r.topic2 === 'Pay') || (r.topic1 === 'Pay' && r.topic2 === 'Work'),
      );
      expect(workPay).toBeDefined();
      expect(workPay!.frequency).toBe(3);
      expect(['weak', 'moderate', 'strong']).toContain(workPay!.relationship);
    });
  });

  describe('calculateTopicSentimentCorrelation', () => {
    it('aggregates sentiment per topic', () => {
      const responses: MockResponse[] = [
        {
          _id: new Types.ObjectId(),
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'positive', score: 0.8 },
          },
        },
        {
          _id: new Types.ObjectId(),
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'negative', score: -0.5 },
          },
        },
      ];
      const result = calculator.calculateTopicSentimentCorrelation(responses as any);

      expect(result.length).toBe(1);
      expect(result[0].topic).toBe('Pay');
      expect(result[0].sentiment.positive).toBe(50);
      expect(result[0].sentiment.negative).toBe(50);
      expect(result[0].responseCount).toBe(2);
    });
  });

  describe('calculateClosedQuestionTopicCorrelations', () => {
    it('returns empty when there are no closed questions', () => {
      const form: any = {
        questions: [{ id: 'q1', title: 'Open', type: 'text' }],
      };
      const responses: any[] = [];

      const result = calculator.calculateClosedQuestionTopicCorrelations(
        form,
        responses as any,
      );

      expect(result).toEqual([]);
    });

    it('computes topic distribution per answer value for a closed question', () => {
      const form: any = {
        questions: [
          { id: 'q1', title: 'Department', type: 'multiple_choice' },
        ],
      };
      const responses: any[] = [
        {
          answers: [{ questionId: 'q1', value: 'HR' }],
          metadata: { canonicalTopics: ['Workload'] },
        },
        {
          answers: [{ questionId: 'q1', value: 'HR' }],
          metadata: { canonicalTopics: ['Workload', 'Culture'] },
        },
        {
          answers: [{ questionId: 'q1', value: 'IT' }],
          metadata: { canonicalTopics: ['Tools'] },
        },
      ];

      const result = calculator.calculateClosedQuestionTopicCorrelations(
        form,
        responses as any,
      );

      expect(result).toHaveLength(1);
      const qCorr = result[0];
      expect(qCorr.questionId).toBe('q1');
      expect(qCorr.correlations.length).toBe(1); // only 'HR' has >= 2 responses
      expect(qCorr.correlations[0].answerValue).toBe('HR');
      expect(qCorr.correlations[0].topicDistribution[0]).toMatchObject({
        topic: 'Workload',
      });
    });
  });
});
