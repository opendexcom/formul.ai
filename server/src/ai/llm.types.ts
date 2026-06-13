/**
 * Generic LLM usage metadata exposed by OSS.
 * EE consumes this for billing/quotas; OSS remains billing-agnostic.
 */
export interface LlmUsage {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cached?: boolean;
  cacheMode?: 'exact' | 'semantic';
  similarity?: number;
}
