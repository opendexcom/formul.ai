import {
  estimateAnalysisCostPer100,
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

  it('matches dated OpenAI snapshot ids by longest prefix', () => {
    expect(resolveTokenRate('gpt-4o-mini-2024-07-18')).toEqual(
      resolveTokenRate('gpt-4o-mini'),
    );
    expect(resolveTokenRate('gpt-4o-2024-08-06')).toEqual(
      resolveTokenRate('gpt-4o'),
    );
  });

  it('uses published GPT-5 family rates and does not collapse mini to gpt-5', () => {
    expect(resolveTokenRate('gpt-5-mini')).toEqual({
      inputPerMillion: 0.25,
      outputPerMillion: 2,
    });
    expect(resolveTokenRate('gpt-5-nano')).toEqual({
      inputPerMillion: 0.05,
      outputPerMillion: 0.4,
    });
    expect(resolveTokenRate('gpt-5')).toEqual({
      inputPerMillion: 1.25,
      outputPerMillion: 10,
    });
    expect(resolveTokenRate('gpt-5-mini-2025-08-07')).toEqual(
      resolveTokenRate('gpt-5-mini'),
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

  it('uses OpenRouter jev input-only pricing ($0.042 / $0 per 1M)', () => {
    expect(resolveTokenRate('typesafe/jev-1.13')).toEqual({
      inputPerMillion: 0.042,
      outputPerMillion: 0,
    });
    expect(estimateUsdCost('typesafe/jev-1.13', 1_000_000, 1_000_000)).toBeCloseTo(
      0.042,
    );
  });

  it('estimates 100-response combined vs jev-split cost', () => {
    const gpt4oMini = estimateAnalysisCostPer100({
      analysisModel: 'gpt-4o-mini',
    });
    expect(gpt4oMini.classificationModel).toBe('typesafe/jev-1.13');
    expect(gpt4oMini.currentUsd).toBeGreaterThan(gpt4oMini.splitUsd);
    expect(gpt4oMini.splitClassificationUsd).toBeGreaterThan(0);
    expect(gpt4oMini.splitClassificationUsd).toBeLessThan(0.01);

    const gpt5Mini = estimateAnalysisCostPer100({
      analysisModel: 'gpt-5-mini',
    });
    expect(gpt5Mini.currentUsd).toBeGreaterThan(gpt4oMini.currentUsd);
    expect(gpt5Mini.splitUsd).toBeLessThan(gpt5Mini.currentUsd);
  });
});
