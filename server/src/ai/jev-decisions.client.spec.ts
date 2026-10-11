import {
  invokeJevDecisions,
  jevChoice,
  jevNoulTrue,
  jevScore01,
  JevDecisionsError,
} from './jev-decisions.client';
import { OPENROUTER_DECISIONS_URL } from './llm-provider.config';

describe('jev-decisions.client', () => {
  it('POSTs Decisions with data_collection=deny and parses answers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          answers: {
            sentiment: {
              type: 'choice',
              choice: 'positive',
              confidence: 0.9,
            },
            depth: { type: 'score', score: 3, confidence: 0.8 },
          },
          usage: { prompt_tokens: 120, completion_tokens: 0, total_tokens: 120 },
        }),
    });

    const result = await invokeJevDecisions({
      apiKey: 'or-test',
      model: 'typesafe/jev-1.13',
      state: { text: 'great teamwork' },
      questions: {
        sentiment: {
          type: 'choice',
          instructions: 'Overall sentiment',
          criteria: { positive: 'good', negative: 'bad' },
        },
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(OPENROUTER_DECISIONS_URL);
    const body = JSON.parse(init.body);
    expect(body.provider).toEqual({ data_collection: 'deny' });
    expect(body.model).toBe('typesafe/jev-1.13');
    expect(result.answers.sentiment.choice).toBe('positive');
    expect(result.usage.promptTokens).toBe(120);
    expect(result.usage.completionTokens).toBe(0);
    expect(result.dataCollection).toBe('deny');
    expect(jevChoice(result.answers, 'sentiment')).toBe('positive');
    expect(jevScore01(result.answers, 'depth', 5)).toBeCloseTo(0.75);
  });

  it('retries without deny when routing rejects data_collection', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'No endpoints found matching data_collection=deny',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            answers: { is_safe: { type: 'noul', probability: 0.91 } },
            usage: { prompt_tokens: 40, completion_tokens: 0 },
          }),
      });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await invokeJevDecisions({
      apiKey: 'or-test',
      state: { userInput: 'make a form' },
      questions: {
        is_safe: {
          type: 'noul',
          instructions: 'Safe?',
          criteria: { true: 'ok', false: 'bad' },
        },
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).provider).toEqual({
      data_collection: 'allow',
    });
    expect(result.dataCollection).toBe('allow');
    expect(jevNoulTrue(result.answers, 'is_safe')).toBe(true);
    warn.mockRestore();
  });

  it('throws JevDecisionsError on non-routing failures', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      invokeJevDecisions({
        apiKey: 'bad',
        state: {},
        questions: {
          x: { type: 'choice', instructions: 'x', criteria: { a: 'a' } },
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(JevDecisionsError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
