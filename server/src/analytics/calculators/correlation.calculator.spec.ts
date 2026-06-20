import {
  CorrelationCalculator,
  formatTopicSentimentCorrelation,
  topicCorrelationToCountBreakdown,
} from './correlation.calculator';
import { Types } from 'mongoose';

type MockResponse = {
  _id?: Types.ObjectId;
  metadata?: {
    canonicalTopics?: string[];
    canonicalTopicSentiments?: Array<{
      topic: string;
      label: string;
      score: number;
    }>;
    overallSentiment?: { label: string; score?: number };
  };
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

    it('uses topic-specific sentiment when canonicalTopicSentiments exist', () => {
      const responses: MockResponse[] = [
        {
          _id: new Types.ObjectId(),
          metadata: {
            canonicalTopics: ['Pay', 'Culture'],
            overallSentiment: { label: 'negative', score: -0.8 },
            canonicalTopicSentiments: [
              { topic: 'Pay', label: 'positive', score: 0.7 },
              { topic: 'Culture', label: 'negative', score: -0.6 },
            ],
          },
        },
      ];
      const result = calculator.calculateTopicSentimentCorrelation(responses as any);

      expect(result.find((r) => r.topic === 'Pay')?.sentiment.positive).toBe(100);
      expect(result.find((r) => r.topic === 'Culture')?.sentiment.negative).toBe(
        100,
      );
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

describe('topic sentiment formatting helpers', () => {
  it('formatTopicSentimentCorrelation converts counts to percentages', () => {
    const result = formatTopicSentimentCorrelation(
      'Company Culture',
      { positive: 4, neutral: 4, negative: 5 },
      0.19,
    );

    expect(result.responseCount).toBe(13);
    expect(result.sentiment.positive + result.sentiment.neutral + result.sentiment.negative).toBeGreaterThanOrEqual(
      98,
    );
    expect(result.sentiment.negative).toBe(38);
  });

  it('topicCorrelationToCountBreakdown handles legacy count rows', () => {
    const counts = topicCorrelationToCountBreakdown({
      sentiment: { positive: 4, neutral: 4, negative: 5 },
      responseCount: 13,
    });

    expect(counts).toEqual({
      positive: 4,
      neutral: 4,
      negative: 5,
      total: 13,
    });
  });

  it('topicCorrelationToCountBreakdown handles percentage rows', () => {
    const counts = topicCorrelationToCountBreakdown({
      sentiment: { positive: 31, neutral: 31, negative: 38 },
      responseCount: 13,
    });

    expect(counts.total).toBe(13);
    expect(counts.negative).toBe(5);
  });
});
