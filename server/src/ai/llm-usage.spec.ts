import {
  billableOutputTokens,
  extractLlmUsage,
  isOpenAiReasoningModel,
} from './llm-usage';

describe('llm-usage', () => {
  it('treats gpt-5* and o* as reasoning models, not gpt-5-chat or gpt-4o', () => {
    expect(isOpenAiReasoningModel('gpt-5-mini')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-5')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-5-nano')).toBe(true);
    expect(isOpenAiReasoningModel('o3-mini')).toBe(true);
    expect(isOpenAiReasoningModel('gpt-5-chat-latest')).toBe(false);
    expect(isOpenAiReasoningModel('gpt-4o-mini')).toBe(false);
  });

  it('records reasoning tokens from OpenAI completion_tokens_details', () => {
    const usage = extractLlmUsage({
      response_metadata: {
        model: 'gpt-5-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 80,
          total_tokens: 180,
          completion_tokens_details: { reasoning_tokens: 40 },
        },
      },
    });
    expect(usage).toEqual({
      model: 'gpt-5-mini',
      promptTokens: 100,
      completionTokens: 80,
      totalTokens: 180,
      reasoningTokens: 40,
    });
  });

  it('records reasoning tokens from LangChain output_token_details', () => {
    const usage = extractLlmUsage({
      usage_metadata: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        output_token_details: { reasoning: 8 },
      },
    });
    expect(usage?.reasoningTokens).toBe(8);
    expect(usage?.completionTokens).toBe(20);
  });

  it('bills reasoning as extra output only when total excludes it from completion', () => {
    expect(billableOutputTokens(100, 80, 180, 40)).toBe(80);
    expect(billableOutputTokens(100, 40, 180, 40)).toBe(80);
  });
});
