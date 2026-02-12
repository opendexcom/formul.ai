import { StatisticsCalculator } from './statistics.calculator';

// Use a very loose shape for ResponseDocument to avoid pulling in Mongoose in unit tests
type MockResponse = {
  _id?: string;
  answers: Array<{ value: any }>;
  metadata?: any;
};

describe('StatisticsCalculator', () => {
  let calculator: StatisticsCalculator;

  beforeEach(() => {
    calculator = new StatisticsCalculator();
  });

  describe('calculateTopicFrequencies', () => {
    it('counts unique canonical topics per response and computes percentages and sentiment', () => {
      const responses: MockResponse[] = [
        {
          _id: '1',
          answers: [],
          metadata: {
            canonicalTopics: ['Workload', 'Management', 'Workload'], // duplicate within response
            overallSentiment: { label: 'positive' },
          },
        },
        {
          _id: '2',
          answers: [],
          metadata: {
            canonicalTopics: ['Workload'],
            overallSentiment: { label: 'negative' },
          },
        },
      ];

      const result = calculator.calculateTopicFrequencies(responses as any);

      expect(Object.keys(result)).toEqual(['Workload', 'Management']);

      expect(result.Workload).toMatchObject({
        count: 2, // duplicate in first response should not double count
        percentage: 100, // 2 / 2 responses
        sentimentBreakdown: {
          positive: 1,
          negative: 1,
          neutral: 0,
        },
      });

      expect(result.Management).toMatchObject({
        count: 1,
        percentage: 50, // 1 / 2 responses
      });
    });
  });

  describe('calculateTopicDistributionFromResponses', () => {
    it('initializes all canonical topics and aggregates counts, sentiment and representative quotes', () => {
      const canonicalTopics = ['Pay', 'Culture'];

      const responses: MockResponse[] = [
        {
          _id: '1',
          answers: [],
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'negative' },
            quotes: ['First quote about pay'],
          },
        },
        {
          _id: '2',
          answers: [],
          metadata: {
            canonicalTopics: ['Pay', 'Culture'],
            overallSentiment: { label: 'positive' },
            quotes: ['Culture quote'],
          },
        },
      ];

      const result = calculator.calculateTopicDistributionFromResponses(
        responses as any,
        canonicalTopics,
      );

      expect(Object.keys(result)).toEqual(canonicalTopics);

      expect(result.Pay.count).toBe(2);
      expect(result.Pay.percentage).toBe(100); // 2 / 2 responses
      expect(result.Pay.sentiment).toEqual({
        positive: 1,
        neutral: 0,
        negative: 1,
      });
      expect(result.Pay.representativeQuotes.length).toBeGreaterThanOrEqual(1);

      expect(result.Culture.count).toBe(1);
      expect(result.Culture.percentage).toBe(50); // 1 / 2 responses
      expect(result.Culture.sentiment.positive).toBe(1);
    });
  });

  describe('assessDataQuality', () => {
    it('calculates averages, completion rate, text quality and overall score', () => {
      const responses: MockResponse[] = [
        {
          answers: [
            { value: 'Short answer' },
            { value: 'Another short' },
          ],
          metadata: {
            quotes: {
              responseQuality: { completeness: 0.4 },
            },
          },
        },
        {
          answers: [
            { value: 'This is a considerably longer answer to a survey question.' },
            { value: '' },
          ],
          metadata: {
            quotes: {
              responseQuality: { completeness: 0.8 },
            },
          },
        },
      ];

      const quality = calculator.assessDataQuality(responses as any);

      expect(quality.totalResponses).toBe(2);
      expect(quality.validResponses).toBeGreaterThan(0);
      expect(quality.averageResponseLength).toBeGreaterThan(0);
      expect(quality.completionRate).toBeGreaterThan(0);
      expect(quality.overallScore).toBeCloseTo(0.6, 1);
      expect(['high', 'medium', 'low']).toContain(quality.textQuality);
    });

    it('sets textQuality to high when average response length > 200', () => {
      const longText = 'a'.repeat(250);
      const responses: MockResponse[] = [
        { answers: [{ value: longText }], metadata: {} },
      ];
      const quality = calculator.assessDataQuality(responses as any);
      expect(quality.textQuality).toBe('high');
    });

    it('sets textQuality to low when average response length < 50', () => {
      const responses: MockResponse[] = [
        { answers: [{ value: 'Hi' }], metadata: {} },
      ];
      const quality = calculator.assessDataQuality(responses as any);
      expect(quality.textQuality).toBe('low');
    });

    it('uses default overallScore 0.5 when no response quality metadata', () => {
      const responses: MockResponse[] = [
        { answers: [{ value: 'Some text' }], metadata: {} },
      ];
      const quality = calculator.assessDataQuality(responses as any);
      expect(quality.overallScore).toBe(0.5);
    });
  });

  describe('determineTheoreticalSampling', () => {
    it('uses complete sample for small datasets', () => {
      const responses = new Array<MockResponse>(10).fill({ answers: [] });

      const strategy = calculator.determineTheoreticalSampling(
        responses as any,
        {} as any,
      );

      expect(strategy.description).toBe('Complete sample');
      expect(strategy.criteria).toContain('all');
    });

    it('uses maximum variation sampling for medium datasets', () => {
      const responses = new Array<MockResponse>(100).fill({ answers: [] });

      const strategy = calculator.determineTheoreticalSampling(
        responses as any,
        {} as any,
      );

      expect(strategy.description).toBe('Maximum variation sampling');
      expect(strategy.criteria).toEqual(
        expect.arrayContaining(['maximum_variation', 'typical_cases', 'extreme_cases']),
      );
    });

    it('uses theoretical sampling with maximum variation for large datasets', () => {
      const responses = new Array<MockResponse>(500).fill({ answers: [] });

      const strategy = calculator.determineTheoreticalSampling(
        responses as any,
        {} as any,
      );

      expect(strategy.description).toBe('Theoretical sampling with maximum variation');
      expect(strategy.criteria).toEqual(
        expect.arrayContaining([
          'maximum_variation',
          'deviant_cases',
          'typical_cases',
          'extreme_cases',
          'information_rich',
          'temporal_coverage',
        ]),
      );
    });
  });

  describe('theoreticalSample', () => {
    it('returns all responses when strategy criteria includes "all"', () => {
      const responses = [
        { _id: '1', answers: [] },
        { _id: '2', answers: [] },
      ];
      const strategy = { description: '', rationale: '', criteria: ['all'] };

      const result = calculator.theoreticalSample(responses as any, strategy as any);

      expect(result).toEqual(responses);
    });

    it('returns subset when strategy criteria does not include "all"', () => {
      const responses = new Array(100)
        .fill(null)
        .map((_, i) => ({ _id: `id-${i}`, answers: [] }));
      const strategy = {
        description: 'Maximum variation',
        rationale: '',
        criteria: ['maximum_variation', 'typical_cases'],
      };

      const result = calculator.theoreticalSample(responses as any, strategy as any);

      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((r: any) => r._id != null)).toBe(true);
    });
  });

  describe('calculateClimateData', () => {
    it('returns positivityScore, dominantTendency and semanticAxis from emotional tones', () => {
      const sentimentDistribution = {
        positive: 40,
        neutral: 20,
        negative: 40,
        averageScore: 0,
      };
      const emotionalTones = [
        { tone: 'concerned', percentage: 50 },
        { tone: 'satisfied', percentage: 50 },
      ];

      const result = calculator.calculateClimateData(
        [] as any,
        ['TopicA', 'TopicB'],
        sentimentDistribution,
        emotionalTones,
      );

      expect(result.positivityScore).toBe(50); // 40 + 20*0.5
      expect(result.dominantTendency).toBe('neutral');
      expect(result.sentimentBreakdown).toEqual({
        positive: 40,
        neutral: 20,
        negative: 40,
      });
      expect(result.semanticAxis).toEqual({
        left: 'concerned',
        right: 'satisfied',
        position: expect.any(Number),
      });
    });

    it('uses topTopics for semanticAxis when emotionalTones has fewer than 2', () => {
      const sentimentDistribution = {
        positive: 80,
        neutral: 10,
        negative: 10,
        averageScore: 0,
      };

      const result = calculator.calculateClimateData(
        [] as any,
        ['Pay', 'Culture'],
        sentimentDistribution,
        [],
      );

      expect(result.dominantTendency).toBe('positive');
      expect(result.semanticAxis?.left).toBe('Pay');
      expect(result.semanticAxis?.right).toBe('Culture');
    });
  });

  describe('calculateDescriptiveStats', () => {
    it('returns zeros for empty input', () => {
      const stats = calculator.calculateDescriptiveStats([]);

      expect(stats).toEqual({
        mean: 0,
        median: 0,
        mode: 0,
        stdDev: 0,
        min: 0,
        max: 0,
      });
    });

    it('calculates mean, median, mode, stdDev, min and max', () => {
      const stats = calculator.calculateDescriptiveStats([1, 2, 2, 3, 4]);

      expect(stats.mean).toBe(2.4);
      expect(stats.median).toBe(2);
      expect(stats.mode).toBe(2);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(4);
      expect(stats.stdDev).toBeGreaterThan(0);
    });
  });
});

