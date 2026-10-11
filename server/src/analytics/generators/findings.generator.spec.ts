import { FindingsGenerator } from './findings.generator';

type MockResponse = {
  metadata?: any;
};

describe('FindingsGenerator', () => {
  let generator: FindingsGenerator;

  beforeEach(() => {
    generator = new FindingsGenerator();
  });

  const baseResponses: MockResponse[] = new Array(10).fill(null).map(() => ({
    metadata: {},
  }));

  const baseTopicFrequencies = {
    Workload: {
      count: 6,
      percentage: 60,
    },
  };

  const baseSentiment = {
    positive: 40,
    neutral: 30,
    negative: 30,
  };

  const baseQuotes = [
    { text: 'Workload is too high.', topics: ['Workload'], sentiment: 'negative' },
    { text: 'Culture is great.', topics: ['Culture'], sentiment: 'positive' },
  ];

  const baseDataQuality = {
    overallScore: 0.55,
  };

  describe('generateKeyFindings - coverage-based confidence', () => {
    it('assigns high confidence when top topic coverage >= 50%', () => {
      const findings = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        baseTopicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const topTopicFinding = findings.find(f =>
        f.finding.startsWith('Most discussed topic'),
      );

      expect(topTopicFinding).toBeDefined();
      expect(topTopicFinding?.confidence).toBe('high');
      expect(topTopicFinding?.basedOnResponses).toBe(6);
    });

    it('assigns medium or low confidence when coverage is lower', () => {
      const topicFrequencies = {
        Workload: {
          count: 3,
          percentage: 30,
        },
      };

      const findingsMedium = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        topicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const mediumFinding = findingsMedium.find(f =>
        f.finding.startsWith('Most discussed topic'),
      );
      expect(mediumFinding?.confidence).toBe('medium');

      const lowTopicFrequencies = {
        Workload: {
          count: 2,
          percentage: 20,
        },
      };

      const findingsLow = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        lowTopicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const lowFinding = findingsLow.find(f =>
        f.finding.startsWith('Most discussed topic'),
      );
      expect(lowFinding?.confidence).toBe('low');
    });
  });

  describe('generateKeyFindings - negative topics', () => {
    it('adds findings for topics with high negative sentiment', () => {
      const topicSentiment = {
        Workload: { positive: 1, neutral: 0, negative: 4, total: 5 }, // 80% negative
        Culture: { positive: 3, neutral: 1, negative: 0, total: 4 },
      };

      const findings = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        baseTopicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
        topicSentiment,
      );

      const negativeFinding = findings.find(
        f => f.type === 'negative' && f.finding.includes('concerning sentiment'),
      );

      expect(negativeFinding).toBeDefined();
      expect(negativeFinding?.finding).toContain('"Workload" has concerning sentiment');
      expect(negativeFinding?.basedOnResponses).toBe(5);
      expect(negativeFinding?.importance).toBe('high');
    });
  });

  describe('generateKeyFindings - empty topTopics', () => {
    it('omits top-topic finding when topTopics is empty', () => {
      const findings = generator.generateKeyFindings(
        baseResponses as any,
        [],
        {},
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const topTopicFinding = findings.find(f =>
        f.finding.startsWith('Most discussed topic'),
      );
      expect(topTopicFinding).toBeUndefined();
      const sentimentFinding = findings.find(f =>
        f.finding.startsWith('Overall sentiment is'),
      );
      expect(sentimentFinding).toBeDefined();
    });
  });

  describe('generateKeyFindings - sentiment importance', () => {
    it('sets importance to high when negative sentiment > 30%', () => {
      const highNegativeSentiment = { positive: 20, neutral: 20, negative: 60 };
      const findings = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        baseTopicFrequencies,
        highNegativeSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const sentimentFinding = findings.find(f =>
        f.finding.startsWith('Overall sentiment is'),
      );
      expect(sentimentFinding?.importance).toBe('high');
    });

    it('sets importance to medium when negative sentiment <= 30%', () => {
      const findings = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        baseTopicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const sentimentFinding = findings.find(f =>
        f.finding.startsWith('Overall sentiment is'),
      );
      expect(sentimentFinding?.importance).toBe('medium');
    });
  });

  describe('generateKeyFindings - trend-based findings', () => {
    it('adds worsening sentiment and emerging topic findings when trends have enough data', () => {
      const trends = {
        hasEnoughData: true,
        sentimentShifts: [
          {
            direction: 'worsening' as const,
            topic: 'Pay',
            fromLabel: 'positive',
            toLabel: 'negative',
            description: 'Sentiment declined from positive to negative',
          },
        ],
        emergingTopics: [
          {
            topic: 'Culture',
            type: 'new' as const,
            newerMentions: 5,
            olderMentions: 0,
            changePercentage: 100,
            description: 'New topic in recent responses',
          },
        ],
        decliningTopics: [],
        volumeTrend: 'stable' as const,
        periodComparison: null,
      };

      const findings = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        baseTopicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
        undefined,
        trends,
      );

      const worseningFinding = findings.find(f =>
        f.finding.includes('sentiment declining') && f.finding.includes('Pay'),
      );
      expect(worseningFinding).toBeDefined();
      expect(worseningFinding?.type).toBe('trend');

      const emergingFinding = findings.find(f =>
        f.finding.includes('Emerging topic') && f.finding.includes('Culture'),
      );
      expect(emergingFinding).toBeDefined();
      expect(emergingFinding?.confidence).toBe('medium');
      expect(emergingFinding?.type).toBe('trend');
    });
  });

  describe('generateKeyFindings - sentiment overview and quality', () => {
    it('always includes an overall sentiment finding and a quality finding when quality is low', () => {
      const findings = generator.generateKeyFindings(
        baseResponses as any,
        ['Workload'],
        baseTopicFrequencies,
        baseSentiment,
        baseQuotes,
        [],
        baseDataQuality,
      );

      const sentimentFinding = findings.find(f =>
        f.finding.startsWith('Overall sentiment is'),
      );
      expect(sentimentFinding).toBeDefined();
      expect(sentimentFinding?.basedOnResponses).toBe(baseResponses.length);

      const qualityFinding = findings.find(f =>
        f.finding.startsWith('Average response quality'),
      );
      expect(qualityFinding).toBeDefined();
      expect(qualityFinding?.confidence).toBe('high');
    });
  });

  describe('extractDominantEmotionalTones', () => {
    it('aggregates emotionalTone from overallSentiment and returns sorted by count', () => {
      const responses: MockResponse[] = [
        { metadata: { overallSentiment: { emotionalTone: 'frustrated' } } },
        { metadata: { overallSentiment: { emotionalTone: 'satisfied' } } },
        { metadata: { overallSentiment: { emotionalTone: 'frustrated' } } },
      ];

      const result = generator.extractDominantEmotionalTones(responses as any);

      expect(result.length).toBe(2);
      expect(result[0].tone).toBe('frustrated');
      expect(result[0].count).toBe(2);
      expect(result[0].percentage).toBe(67);
      expect(result[1].tone).toBe('satisfied');
      expect(result[1].count).toBe(1);
    });
  });

  describe('extractRepresentativeQuotes', () => {
    it('extracts quotes from metadata.quotes array', () => {
      const responses: MockResponse[] = [
        {
          metadata: {
            canonicalTopics: ['Pay'],
            overallSentiment: { label: 'negative' },
            quotes: [{ text: 'Quote one' }, { quote: 'Quote two' }],
          },
        },
      ];

      const result = generator.extractRepresentativeQuotes(responses as any, 5);

      expect(result.length).toBe(2);
      expect(result[0].text).toBe('Quote one');
      expect(result[1].text).toBe('Quote two');
      expect(result[0].topics).toEqual(['Pay']);
      expect(result[0].sentiment).toBe('negative');
    });

    it('extracts from keyQuotes when quotes array not present', () => {
      const responses: MockResponse[] = [
        {
          metadata: {
            canonicalTopics: ['Work'],
            overallSentiment: { label: 'positive' },
            quotes: { keyQuotes: [{ quote: 'Key quote text' }] },
          },
        },
      ];

      const result = generator.extractRepresentativeQuotes(responses as any);

      expect(result.length).toBe(1);
      expect(result[0].text).toBe('Key quote text');
      expect(result[0].sentiment).toBe('positive');
    });

    it('respects limit parameter', () => {
      const responses: MockResponse[] = Array.from({ length: 5 }, (_, i) => ({
        metadata: {
          canonicalTopics: [],
          quotes: [{ text: `Quote ${i}` }],
        },
      }));

      const result = generator.extractRepresentativeQuotes(responses as any, 2);

      expect(result.length).toBe(2);
    });
  });
});

