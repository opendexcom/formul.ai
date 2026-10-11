import { SentimentCalculator } from './sentiment.calculator';

type MockResponse = {
  metadata?: any;
};

describe('SentimentCalculator', () => {
  let calculator: SentimentCalculator;

  beforeEach(() => {
    calculator = new SentimentCalculator();
  });

  describe('calculateSentimentDistribution', () => {
    it('calculates percentages and average score from overallSentiment metadata', () => {
      const responses: MockResponse[] = [
        { metadata: { overallSentiment: { label: 'positive', score: 0.8 } } },
        { metadata: { overallSentiment: { label: 'negative', score: -0.4 } } },
        { metadata: { overallSentiment: { label: 'neutral' } } },
        { metadata: {} }, // no overallSentiment -> ignored for counts
      ];

      const dist = calculator.calculateSentimentDistribution(responses as any);

      // 3 responses with sentiment, 4 total; responses without overallSentiment are ignored for counts
      expect(dist.positive).toBe(25); // 1/4
      expect(dist.negative).toBe(25); // 1/4
      expect(dist.neutral).toBe(25);  // 1/4
      expect(dist.averageScore).toBeCloseTo((0.8 + -0.4) / 2, 5);
    });

    it('counts ambivalent labels as neutral', () => {
      const responses: MockResponse[] = [
        { metadata: { overallSentiment: { label: 'ambivalent', score: 0.15 } } },
        { metadata: { overallSentiment: { label: 'ambivalent', score: 0.1 } } },
      ];

      const dist = calculator.calculateSentimentDistribution(responses as any);

      expect(dist.positive).toBe(0);
      expect(dist.neutral).toBe(100);
      expect(dist.negative).toBe(0);
      expect(dist.averageScore).toBeCloseTo(0.125, 5);
    });

    it('returns zeros when there are no responses', () => {
      const dist = calculator.calculateSentimentDistribution([] as any);

      expect(dist).toEqual({
        positive: 0,
        neutral: 0,
        negative: 0,
        averageScore: 0,
      });
    });
  });

  describe('calculateTopicSentimentBreakdown', () => {
    it('aggregates sentiment counts per canonical topic', () => {
      const responses: MockResponse[] = [
        {
          metadata: {
            canonicalTopics: ['Workload', 'Culture'],
            overallSentiment: { label: 'positive' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Workload'],
            overallSentiment: { label: 'negative' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Culture'],
            overallSentiment: { label: 'neutral' },
          },
        },
      ];

      const breakdown = calculator.calculateTopicSentimentBreakdown(responses as any);

      expect(breakdown.Workload).toEqual({
        positive: 1,
        neutral: 0,
        negative: 1,
        total: 2,
      });

      expect(breakdown.Culture).toEqual({
        positive: 1,
        neutral: 1,
        negative: 0,
        total: 2,
      });
    });
  });

  describe('calculateDominantSentimentPerTopic', () => {
    it('classifies dominant sentiment and confidence per topic based on breakdown', () => {
      const responses: MockResponse[] = [
        {
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'positive' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'positive' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'neutral' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Management'],
            overallSentiment: { label: 'negative' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Management'],
            overallSentiment: { label: 'negative' },
          },
        },
        {
          metadata: {
            canonicalTopics: ['Management'],
            overallSentiment: { label: 'neutral' },
          },
        },
      ];

      const result = calculator.calculateDominantSentimentPerTopic(responses as any);

      expect(result.Pay.dominantSentiment).toBe('positive');
      expect(result.Pay.confidence).toBeGreaterThan(0);
      expect(result.Pay.distribution.positive).toBeGreaterThan(0);

      expect(result.Management.dominantSentiment).toBe('negative');
      expect(result.Management.confidence).toBeGreaterThan(0);
      expect(result.Management.distribution.negative).toBeGreaterThan(0);
    });

    it('returns "positive" when posPercent > 60', () => {
      const responses: MockResponse[] = [
        ...Array(7).fill({
          metadata: { canonicalTopics: ['A'], overallSentiment: { label: 'positive' } },
        }),
        ...Array(2).fill({
          metadata: { canonicalTopics: ['A'], overallSentiment: { label: 'neutral' } },
        }),
        { metadata: { canonicalTopics: ['A'], overallSentiment: { label: 'negative' } } },
      ];
      const result = calculator.calculateDominantSentimentPerTopic(responses as any);
      expect(result.A.dominantSentiment).toBe('positive');
    });

    it('returns "negative" when negPercent > 60', () => {
      const responses: MockResponse[] = [
        ...Array(7).fill({
          metadata: { canonicalTopics: ['B'], overallSentiment: { label: 'negative' } },
        }),
        ...Array(2).fill({
          metadata: { canonicalTopics: ['B'], overallSentiment: { label: 'neutral' } },
        }),
        { metadata: { canonicalTopics: ['B'], overallSentiment: { label: 'positive' } } },
      ];
      const result = calculator.calculateDominantSentimentPerTopic(responses as any);
      expect(result.B.dominantSentiment).toBe('negative');
    });

    it('returns "mostly positive" when posPercent > 40 and negPercent < 20', () => {
      const responses: MockResponse[] = [
        ...Array(5).fill({
          metadata: { canonicalTopics: ['C'], overallSentiment: { label: 'positive' } },
        }),
        ...Array(4).fill({
          metadata: { canonicalTopics: ['C'], overallSentiment: { label: 'neutral' } },
        }),
        { metadata: { canonicalTopics: ['C'], overallSentiment: { label: 'negative' } } },
      ];
      const result = calculator.calculateDominantSentimentPerTopic(responses as any);
      expect(result.C.dominantSentiment).toBe('mostly positive');
    });

    it('returns "mostly negative" when negPercent > 40 and posPercent < 20', () => {
      const responses: MockResponse[] = [
        ...Array(5).fill({
          metadata: { canonicalTopics: ['D'], overallSentiment: { label: 'negative' } },
        }),
        ...Array(4).fill({
          metadata: { canonicalTopics: ['D'], overallSentiment: { label: 'neutral' } },
        }),
        { metadata: { canonicalTopics: ['D'], overallSentiment: { label: 'positive' } } },
      ];
      const result = calculator.calculateDominantSentimentPerTopic(responses as any);
      expect(result.D.dominantSentiment).toBe('mostly negative');
    });

    it('returns "mixed" when no clear majority', () => {
      const responses: MockResponse[] = [
        ...Array(4).fill({
          metadata: { canonicalTopics: ['E'], overallSentiment: { label: 'positive' } },
        }),
        ...Array(3).fill({
          metadata: { canonicalTopics: ['E'], overallSentiment: { label: 'negative' } },
        }),
        ...Array(3).fill({
          metadata: { canonicalTopics: ['E'], overallSentiment: { label: 'neutral' } },
        }),
      ];
      const result = calculator.calculateDominantSentimentPerTopic(responses as any);
      expect(result.E.dominantSentiment).toBe('mixed');
    });
  });

  describe('calculateSentimentPolarity', () => {
    it('returns average of sentiment scores', () => {
      const responses: MockResponse[] = [
        { metadata: { overallSentiment: { score: 1 } } },
        { metadata: { overallSentiment: { score: 0 } } },
        { metadata: { overallSentiment: { score: -1 } } },
      ];

      const polarity = calculator.calculateSentimentPolarity(responses as any);
      expect(polarity).toBeCloseTo(0, 5);
    });

    it('returns 0 when there are no scored sentiments', () => {
      const polarity = calculator.calculateSentimentPolarity([] as any);
      expect(polarity).toBe(0);
    });
  });

  describe('identifyExtremeSentiments', () => {
    it('splits responses into veryPositive and veryNegative buckets based on threshold', () => {
      const responses: MockResponse[] = [
        { metadata: { overallSentiment: { score: 0.9 } } },
        { metadata: { overallSentiment: { score: 0.6 } } },
        { metadata: { overallSentiment: { score: -0.8 } } },
        { metadata: { overallSentiment: { score: -0.4 } } },
        { metadata: { overallSentiment: { score: 0.75 } } },
      ];

      const { veryPositive, veryNegative } = calculator.identifyExtremeSentiments(
        responses as any,
        0.7,
      );

      expect(veryPositive.length).toBe(2);
      expect(veryNegative.length).toBe(1);
    });
  });
});

