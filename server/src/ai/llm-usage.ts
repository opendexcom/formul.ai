import type { LlmUsage } from './llm.types';

/**
 * Matches @langchain/openai isReasoningModel: o1/o3/o4… and gpt-5*
 * except gpt-5-chat. These models reject temperature != 1 (or ignore it).
 */
export function isOpenAiReasoningModel(model: string | undefined): boolean {
  if (!model) return false;
  if (/^o\d/.test(model)) return true;
  return model.startsWith('gpt-5') && !model.startsWith('gpt-5-chat');
}

export function extractReasoningTokens(usage: Record<string, unknown> | undefined): number | undefined {
  if (!usage) return undefined;
  const details =
    (usage.completion_tokens_details as Record<string, unknown> | undefined) ??
    (usage.completionTokensDetails as Record<string, unknown> | undefined) ??
    (usage.output_token_details as Record<string, unknown> | undefined) ??
    (usage.outputTokenDetails as Record<string, unknown> | undefined);
  const value =
    details?.reasoning_tokens ??
    details?.reasoningTokens ??
    details?.reasoning ??
    usage.reasoning_tokens ??
    usage.reasoningTokens;
  return typeof value === 'number' ? value : undefined;
}

/**
 * OpenAI bills reasoning tokens as output. completion_tokens usually already
 * includes them; add them only when total = prompt + completion + reasoning.
 */
export function billableOutputTokens(
  promptTokens: number | undefined,
  completionTokens: number | undefined,
  totalTokens: number | undefined,
  reasoningTokens: number | undefined,
): number {
  const completion = completionTokens ?? 0;
  const reasoning = reasoningTokens ?? 0;
  if (
    reasoning > 0 &&
    promptTokens != null &&
    completionTokens != null &&
    totalTokens != null &&
    totalTokens === promptTokens + completionTokens + reasoning
  ) {
    return completion + reasoning;
  }
  return completion;
}

export function extractLlmUsage(raw: any): LlmUsage | undefined {
  const usage =
    raw?.usage ??
    raw?.usage_metadata ??
    raw?.response_metadata?.usage ??
    raw?.response_metadata?.tokenUsage;
  if (!usage) return undefined;

  const promptTokens =
    usage.prompt_tokens ??
    usage.promptTokens ??
    usage.input_tokens ??
    usage.inputTokens;
  const completionTokens =
    usage.completion_tokens ??
    usage.completionTokens ??
    usage.output_tokens ??
    usage.outputTokens;
  const totalTokens = usage.total_tokens ?? usage.totalTokens;
  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return undefined;
  }

  const reasoningTokens = extractReasoningTokens(usage);
  const resolvedTotal =
    totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0);

  const result: LlmUsage = {
    model:
      raw?.model ??
      raw?.response_metadata?.model_name ??
      raw?.response_metadata?.model ??
      usage?.model ??
      'unknown',
    promptTokens,
    completionTokens,
    totalTokens: resolvedTotal,
  };
  if (reasoningTokens != null) {
    result.reasoningTokens = reasoningTokens;
  }
  return result;
}
