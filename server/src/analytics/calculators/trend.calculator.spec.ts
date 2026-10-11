import { TrendCalculator } from './trend.calculator';
import { Types } from 'mongoose';

type MockResponse = {
  _id?: Types.ObjectId;
  submittedAt: Date;
  metadata?: { canonicalTopics?: string[]; overallSentiment?: { label: string; score?: number } };
};

describe('TrendCalculator', () => {
  let calculator: TrendCalculator;

  beforeEach(() => {
    calculator = new TrendCalculator();
  });

  describe('calculateTrends', () => {
    it('returns hasEnoughData false when fewer than 5 responses', () => {
      const responses: MockResponse[] = [
        { submittedAt: new Date(), metadata: { canonicalTopics: ['A'] } },
        { submittedAt: new Date(), metadata: { canonicalTopics: ['A'] } },
      ];
      const result = calculator.calculateTrends(responses as any, ['A']);

      expect(result.hasEnoughData).toBe(false);
      expect(result.message).toContain('Need at least 5 responses');
      expect(result.emergingTopics).toEqual([]);
      expect(result.sentimentShifts).toEqual([]);
    });

    it('returns hasEnoughData true and period comparison with enough responses', () => {
      const base = new Date('2025-01-01').getTime();
      const responses: MockResponse[] = Array.from({ length: 10 }, (_, i) => ({
        _id: new Types.ObjectId(),
        submittedAt: new Date(base + i * 86400000),
        metadata: {
          canonicalTopics: ['TopicA', 'TopicB'],
          overallSentiment: { label: i < 5 ? 'positive' : 'negative', score: i < 5 ? 0.5 : -0.5 },
        },
      }));

      const result = calculator.calculateTrends(responses as any, ['TopicA', 'TopicB']);

      expect(result.hasEnoughData).toBe(true);
      expect(result.periodComparison).toBeDefined();
      expect(result.periodComparison!.olderPeriod.responseCount).toBe(5);
      expect(result.periodComparison!.newerPeriod.responseCount).toBe(5);
      expect(['stable', 'increasing', 'decreasing']).toContain(result.volumeTrend);
    });
  });
});
