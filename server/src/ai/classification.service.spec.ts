import { ClassificationService } from './classification.service';
import * as jevClient from './jev-decisions.client';

jest.mock('./jev-decisions.client', () => {
  const actual = jest.requireActual('./jev-decisions.client');
  return {
    ...actual,
    invokeJevDecisions: jest.fn(),
  };
});

describe('ClassificationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENROUTER_API_KEY: 'or-test' };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps jev answers onto the combined-analysis classification contract', async () => {
    (jevClient.invokeJevDecisions as jest.Mock).mockResolvedValue({
      answers: {
        sentiment: { type: 'choice', choice: 'positive', confidence: 0.88 },
        tone: { type: 'choice', choice: 'satisfied', confidence: 0.8 },
        completeness: { type: 'score', score: 4 },
        depth: { type: 'score', score: 3 },
        clarity: { type: 'score', score: 4 },
        topic_0_sentiment: {
          type: 'choice',
          choice: 'negative',
          confidence: 0.7,
        },
      },
      usage: {
        model: 'typesafe/jev-1.13',
        promptTokens: 90,
        completionTokens: 0,
        totalTokens: 90,
      },
    });

    const service = new ClassificationService();
    expect(service.shouldSplitCombinedAnalysis()).toBe(true);

    const { results, usage } = await service.classifyResponses([
      {
        responseId: 'r1',
        answersText: 'Pay is too low',
        topics: [{ topic: 'Compensation' }],
      },
    ]);

    expect(results[0].responseId).toBe('r1');
    expect(results[0].overallSentiment.sentiment).toBe('positive');
    expect(results[0].overallSentiment.emotionalTone).toBe('satisfied');
    expect(results[0].overallSentiment.score).toBeGreaterThan(0);
    expect(results[0].topicSentiments[0]).toMatchObject({
      topic: 'Compensation',
      sentiment: 'negative',
    });
    expect(results[0].topicSentiments[0].score).toBeLessThan(0);
    expect(results[0].responseQuality.completeness).toBeCloseTo(1);
    expect(results[0].responseQuality.depth).toBeCloseTo(0.75);
    expect(usage[0].promptTokens).toBe(90);
  });

  it('picks a cluster label from member options', async () => {
    (jevClient.invokeJevDecisions as jest.Mock).mockResolvedValue({
      answers: { canonical: { type: 'choice', choice: 'opt_1' } },
      usage: { model: 'typesafe/jev-1.13', promptTokens: 30 },
    });

    const service = new ClassificationService();
    const labelled = await service.labelCluster([
      'Company Culture',
      'Workplace Culture',
    ]);
    expect(labelled.label).toBe('Workplace Culture');
  });
});
