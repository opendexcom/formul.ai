/** First-class production providers. `ollama` remains for local/dev. */
export const LLM_PROVIDERS = ['openai', 'mistral', 'bedrock', 'ollama'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export const FIRST_CLASS_LLM_PROVIDERS = ['openai', 'mistral', 'bedrock'] as const;

export const LLM_TASKS = ['chat', 'analysis', 'guardian'] as const;
export type LlmTask = (typeof LLM_TASKS)[number];

export type EmbeddingProviderName =
  | 'local'
  | 'ollama'
  | 'openai'
  | 'mistral'
  | 'bedrock';

export interface LlmTaskModels {
  chat: string;
  analysis: string;
  guardian: string;
  embedding: string;
}

export const OPENAI_REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
] as const;
export type OpenAiReasoningEffort = (typeof OPENAI_REASONING_EFFORTS)[number];

export type LlmTaskReasoningEfforts = Record<LlmTask, OpenAiReasoningEffort>;

export interface LlmProviderConfig {
  provider: LlmProviderName;
  models: LlmTaskModels;
  apiKey?: string;
  baseUrl?: string;
  region?: string;
  temperature: number;
  /** Global default (`OPENAI_REASONING_EFFORT`, default `low`). */
  reasoningEffort?: OpenAiReasoningEffort;
  /** Per-task override from `LLM_REASONING_EFFORT_<TASK>`. */
  reasoningEfforts?: LlmTaskReasoningEfforts;
}

export interface ChatInvokeOptions {
  useJsonFormat?: boolean;
  maxTokens?: number;
}
