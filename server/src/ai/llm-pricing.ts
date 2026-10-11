/**
 * Public list prices used for cost estimates (USD per 1M tokens).
 *
 * Sources (retrieved 2026-10-10):
 * - OpenAI: https://platform.openai.com/docs/pricing
 *   gpt-4o $2.50 / $10.00, gpt-4o-mini $0.15 / $0.60 (input / output).
 * - Mistral: https://docs.mistral.ai/inference/pricing
 *   mistral-large-latest (Large 4 sale) $0.68 / $2.09,
 *   mistral-medium-latest (Medium 3.5) $1.50 / $7.50,
 *   mistral-small-latest (Small 4) $0.15 / $0.60,
 *   mistral-embed $0.10 / $0.00.
 * - AWS Bedrock on-demand: https://aws.amazon.com/bedrock/pricing/
 *   (cross-checked 2026-10-10 via AWS Builder Center cheat sheet)
 *   Nova Micro $0.035 / $0.14, Nova Lite $0.06 / $0.24, Nova Pro $0.80 / $3.20,
 *   Claude 3 Haiku $0.25 / $1.25, Claude Haiku 4.5 $1 / $5,
 *   Claude 3.5 Sonnet $3 / $15, Titan Embed Text V2 ~$0.02 / $0,
 *   Cohere Embed Multilingual v3 $0.10 / $0.
 *
 * EE quota accounting historically used input-only $ / 1K. The comparison
 * harness uses split input/output rates below.
 */
export interface TokenRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const TOKEN_RATES_PER_MILLION: Record<string, TokenRate> = {
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4': { inputPerMillion: 30, outputPerMillion: 60 },
  'gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  'mistral-large-latest': { inputPerMillion: 0.68, outputPerMillion: 2.09 },
  'mistral-large-2411': { inputPerMillion: 2, outputPerMillion: 6 },
  'mistral-large-2512': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  'mistral-medium-latest': { inputPerMillion: 1.5, outputPerMillion: 7.5 },
  'mistral-small-latest': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'mistral-embed': { inputPerMillion: 0.1, outputPerMillion: 0 },
  'amazon.nova-micro-v1:0': { inputPerMillion: 0.035, outputPerMillion: 0.14 },
  'amazon.nova-lite-v1:0': { inputPerMillion: 0.06, outputPerMillion: 0.24 },
  'amazon.nova-pro-v1:0': { inputPerMillion: 0.8, outputPerMillion: 3.2 },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    inputPerMillion: 3,
    outputPerMillion: 15,
  },
  'amazon.titan-embed-text-v2:0': { inputPerMillion: 0.02, outputPerMillion: 0 },
  'cohere.embed-multilingual-v3': { inputPerMillion: 0.1, outputPerMillion: 0 },
};

/** Longest prefix first so gpt-4o-mini-2024-07-18 does not match gpt-4o. */
const PREFIX_RATES: Array<[string, TokenRate]> = [
  ['mistral-large', TOKEN_RATES_PER_MILLION['mistral-large-latest']],
  ['mistral-medium', TOKEN_RATES_PER_MILLION['mistral-medium-latest']],
  ['mistral-small', TOKEN_RATES_PER_MILLION['mistral-small-latest']],
  ['gpt-4o-mini', TOKEN_RATES_PER_MILLION['gpt-4o-mini']],
  ['gpt-4o', TOKEN_RATES_PER_MILLION['gpt-4o']],
  ['gpt-3.5-turbo', TOKEN_RATES_PER_MILLION['gpt-3.5-turbo']],
  ['gpt-4', TOKEN_RATES_PER_MILLION['gpt-4']],
  ['nova-micro', TOKEN_RATES_PER_MILLION['amazon.nova-micro-v1:0']],
  ['nova-lite', TOKEN_RATES_PER_MILLION['amazon.nova-lite-v1:0']],
  ['nova-pro', TOKEN_RATES_PER_MILLION['amazon.nova-pro-v1:0']],
  ['claude-3-5-sonnet', TOKEN_RATES_PER_MILLION['anthropic.claude-3-5-sonnet-20240620-v1:0']],
  ['claude-3-haiku', TOKEN_RATES_PER_MILLION['anthropic.claude-3-haiku-20240307-v1:0']],
  ['claude-haiku', TOKEN_RATES_PER_MILLION['anthropic.claude-3-haiku-20240307-v1:0']],
  ['titan-embed', TOKEN_RATES_PER_MILLION['amazon.titan-embed-text-v2:0']],
  ['cohere.embed', TOKEN_RATES_PER_MILLION['cohere.embed-multilingual-v3']],
];

function lastIdSegment(model: string): string {
  const parts = model.split('.');
  return parts[parts.length - 1] ?? model;
}

export function resolveTokenRate(model: string): TokenRate {
  if (TOKEN_RATES_PER_MILLION[model]) {
    return TOKEN_RATES_PER_MILLION[model];
  }
  const stripped = model.replace(/^(eu|us|apac|global)\./, '');
  if (TOKEN_RATES_PER_MILLION[stripped]) {
    return TOKEN_RATES_PER_MILLION[stripped];
  }
  const match = PREFIX_RATES.find(([prefix]) => {
    return (
      model.startsWith(prefix) ||
      stripped.startsWith(prefix) ||
      lastIdSegment(stripped).startsWith(prefix)
    );
  });
  return match?.[1] ?? TOKEN_RATES_PER_MILLION['gpt-4o-mini'];
}

/** Input-only $ per 1K tokens — matches historical EE UsageQuota accounting. */
export function tokenCostPer1kInput(model: string): number {
  return resolveTokenRate(model).inputPerMillion / 1000;
}

export function estimateUsdCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = resolveTokenRate(model);
  return (
    (promptTokens / 1_000_000) * rate.inputPerMillion +
    (completionTokens / 1_000_000) * rate.outputPerMillion
  );
}

export const PRICING_CITATION = {
  retrievedAt: '2026-10-10',
  openai: 'https://platform.openai.com/docs/pricing',
  mistral: 'https://docs.mistral.ai/inference/pricing',
  bedrock: 'https://aws.amazon.com/bedrock/pricing/',
};
