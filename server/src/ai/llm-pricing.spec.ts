import {
  estimateUsdCost,
  resolveTokenRate,
  tokenCostPer1kInput,
} from './llm-pricing';

describe('llm-pricing', () => {
  it('uses published OpenAI and Mistral list rates', () => {
    expect(resolveTokenRate('gpt-4o-mini')).toEqual({
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
    });
    expect(resolveTokenRate('mistral-medium-latest')).toEqual({
      inputPerMillion: 1.5,
      outputPerMillion: 7.5,
    });
    expect(resolveTokenRate('mistral-small-latest').inputPerMillion).toBe(0.15);
  });

  it('matches versioned Mistral Large ids via prefix', () => {
    expect(resolveTokenRate('mistral-large-2601')).toEqual(
      resolveTokenRate('mistral-large-latest'),
    );
  });

  it('estimates split input/output cost', () => {
    const cost = estimateUsdCost('mistral-small-latest', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.75);
  });

  it('exposes EE-compatible input-only $ / 1K', () => {
    expect(tokenCostPer1kInput('gpt-4o')).toBeCloseTo(0.0025);
    expect(tokenCostPer1kInput('mistral-small-latest')).toBeCloseTo(0.00015);
  });

  it('strips Bedrock EU inference-profile prefixes', () => {
    expect(resolveTokenRate('eu.amazon.nova-lite-v1:0')).toEqual({
      inputPerMillion: 0.06,
      outputPerMillion: 0.24,
    });
    expect(resolveTokenRate('eu.anthropic.claude-3-haiku-20240307-v1:0').inputPerMillion).toBe(
      0.25,
    );
  });
});
