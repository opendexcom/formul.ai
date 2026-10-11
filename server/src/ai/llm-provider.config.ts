import {
  LLM_PROVIDERS,
  LLM_TASKS,
  OPENAI_REASONING_EFFORTS,
  type ChatInvokeOptions,
  type EmbeddingProviderName,
  type LlmProviderConfig,
  type LlmProviderName,
  type LlmTask,
  type LlmTaskModels,
  type OpenAiReasoningEffort,
} from './llm-provider.types';
import { isOpenAiReasoningModel } from './llm-usage';

/** Defaults preserve current OpenAI production behavior (single gpt-4o-mini). */
export const DEFAULT_PROVIDER_MODELS: Record<LlmProviderName, LlmTaskModels> = {
  openai: {
    chat: 'gpt-4o-mini',
    analysis: 'gpt-4o-mini',
    guardian: 'gpt-4o-mini',
    classification: 'gpt-4o-mini',
    embedding: 'text-embedding-3-small',
  },
  mistral: {
    chat: 'mistral-small-latest',
    // Small is the cost default. Medium 3.5 is ~11x gpt-4o-mini on a
    // 100-response analysis. Set LLM_MODEL_ANALYSIS=mistral-large-latest
    // when quality matters more than price.
    analysis: 'mistral-small-latest',
    guardian: 'mistral-small-latest',
    classification: 'mistral-small-latest',
    embedding: 'mistral-embed',
  },
  bedrock: {
    // EU geo inference profiles keep prompts/completions inside the EU.
    chat: 'eu.amazon.nova-lite-v1:0',
    // Nova Lite is the cost default. Set LLM_MODEL_ANALYSIS to
    // eu.amazon.nova-pro-v1:0 for higher-quality analysis.
    analysis: 'eu.amazon.nova-lite-v1:0',
    guardian: 'eu.amazon.nova-micro-v1:0',
    classification: 'eu.amazon.nova-micro-v1:0',
    embedding: 'amazon.titan-embed-text-v2:0',
  },
  ollama: {
    chat: 'llama2',
    analysis: 'llama2',
    guardian: 'llama2',
    classification: 'llama2',
    embedding: 'nomic-embed-text',
  },
  openrouter: {
    chat: 'openai/gpt-4o-mini',
    analysis: 'openai/gpt-4o-mini',
    guardian: 'typesafe/jev-1.13',
    classification: 'typesafe/jev-1.13',
    embedding: 'openai/text-embedding-3-small',
  },
};

export const DEFAULT_EMBEDDING_DIMENSIONS: Record<EmbeddingProviderName, number> =
  {
    openai: 1536,
    mistral: 1024,
    bedrock: 1024,
    ollama: 768,
    local: 384,
  };

/** EU-only Mistral endpoint. api.mistral.ai does NOT guarantee EU processing. */
export const MISTRAL_DEFAULT_BASE_URL = 'https://api.eu.mistral.ai';

export const BEDROCK_DEFAULT_REGION = 'eu-central-1';

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_DEFAULT_MODEL = 'typesafe/jev-1.13';

const JEV_DEFAULT_TASKS: readonly LlmTask[] = ['guardian', 'classification'];

function readEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

export function isLlmProviderName(value: string | undefined): value is LlmProviderName {
  return !!value && (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function isJevDecisionModel(model: string | undefined): boolean {
  if (!model) return false;
  const id = model.toLowerCase();
  return id.includes('jev') || id.startsWith('typesafe/jev');
}

export function resolveLlmProviderName(
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderName {
  const configured = readEnv(env, 'LLM_PROVIDER');
  if (isLlmProviderName(configured)) {
    return configured;
  }
  return 'openai';
}

function providerWideModel(
  provider: LlmProviderName,
  env: NodeJS.ProcessEnv,
): string | undefined {
  switch (provider) {
    case 'mistral':
      return readEnv(env, 'MISTRAL_MODEL');
    case 'bedrock':
      return readEnv(env, 'BEDROCK_MODEL');
    case 'ollama':
      return readEnv(env, 'OLLAMA_MODEL');
    case 'openrouter':
      return readEnv(env, 'OPENROUTER_MODEL');
    default:
      return readEnv(env, 'OPENAI_MODEL');
  }
}

function perTaskModelKey(task: keyof LlmTaskModels): string {
  return `LLM_MODEL_${task.toUpperCase()}`;
}

function perTaskProviderKey(task: LlmTask): string {
  return `LLM_PROVIDER_${task.toUpperCase()}`;
}

/**
 * Per-task provider.
 * `LLM_PROVIDER_<TASK>` wins. When `OPENROUTER_API_KEY` is set, guardian and
 * classification default to OpenRouter (jev) unless the operator set a
 * non-jev `LLM_MODEL_<TASK>` (keep that model on the global provider).
 * Without the key, defaults are unchanged.
 */
export function resolveTaskProvider(
  task: LlmTask,
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderName {
  const explicit = readEnv(env, perTaskProviderKey(task));
  if (isLlmProviderName(explicit)) {
    return explicit;
  }

  const modelOverride = readEnv(env, perTaskModelKey(task));
  if (
    JEV_DEFAULT_TASKS.includes(task) &&
    readEnv(env, 'OPENROUTER_API_KEY') &&
    (!modelOverride || isJevDecisionModel(modelOverride))
  ) {
    return 'openrouter';
  }

  return resolveLlmProviderName(env);
}

function resolveTaskModel(
  provider: LlmProviderName,
  task: keyof LlmTaskModels,
  env: NodeJS.ProcessEnv,
): string {
  if (task === 'embedding') {
    return (
      readEnv(env, perTaskModelKey('embedding')) ||
      embeddingModelOverride(provider, env) ||
      DEFAULT_PROVIDER_MODELS[provider].embedding
    );
  }

  const perTask = readEnv(env, perTaskModelKey(task));
  if (perTask) {
    return perTask;
  }

  if (provider === 'openrouter' && (task === 'guardian' || task === 'classification')) {
    return (
      readEnv(env, 'OPENROUTER_MODEL') ||
      DEFAULT_PROVIDER_MODELS.openrouter[task]
    );
  }

  // Guardian stays on the cheap non-reasoning default unless explicitly
  // overridden. OPENAI_MODEL=gpt-5-mini must not take over guardian.
  if (task === 'guardian') {
    return DEFAULT_PROVIDER_MODELS[provider].guardian;
  }

  // Classification without OpenRouter stays on the analysis model so the
  // combined-analysis path does not change.
  if (task === 'classification') {
    return (
      readEnv(env, perTaskModelKey('analysis')) ||
      providerWideModel(provider, env) ||
      DEFAULT_PROVIDER_MODELS[provider].classification
    );
  }

  return (
    providerWideModel(provider, env) ||
    DEFAULT_PROVIDER_MODELS[provider][task]
  );
}

function embeddingModelOverride(
  provider: LlmProviderName,
  env: NodeJS.ProcessEnv,
): string | undefined {
  switch (provider) {
    case 'mistral':
      return readEnv(env, 'MISTRAL_EMBEDDING_MODEL');
    case 'bedrock':
      return readEnv(env, 'BEDROCK_EMBEDDING_MODEL');
    case 'ollama':
      return readEnv(env, 'OLLAMA_EMBEDDING_MODEL');
    case 'openrouter':
      return readEnv(env, 'OPENROUTER_EMBEDDING_MODEL');
    default:
      return readEnv(env, 'OPENAI_EMBEDDING_MODEL');
  }
}

function parseReasoningEffort(
  value: string | undefined,
): OpenAiReasoningEffort | undefined {
  if (!value) return undefined;
  return (OPENAI_REASONING_EFFORTS as readonly string[]).includes(value)
    ? (value as OpenAiReasoningEffort)
    : undefined;
}

/**
 * Reasoning effort for gpt-5* / o* only.
 * Per-task `LLM_REASONING_EFFORT_<TASK>` overrides `OPENAI_REASONING_EFFORT`.
 * Default is `low` (enough for most form-generation / analysis tasks).
 */
export function resolveOpenAiReasoningEffort(
  env: NodeJS.ProcessEnv = process.env,
  task?: LlmTask,
): OpenAiReasoningEffort {
  if (task) {
    const perTask = parseReasoningEffort(
      readEnv(env, `LLM_REASONING_EFFORT_${task.toUpperCase()}`),
    );
    if (perTask) {
      return perTask;
    }
  }
  return parseReasoningEffort(readEnv(env, 'OPENAI_REASONING_EFFORT')) ?? 'low';
}

export function resolveBedrockRegion(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    readEnv(env, 'BEDROCK_REGION') ||
    readEnv(env, 'AWS_REGION') ||
    readEnv(env, 'AWS_DEFAULT_REGION') ||
    BEDROCK_DEFAULT_REGION
  );
}

function credentialsForProvider(
  provider: LlmProviderName,
  env: NodeJS.ProcessEnv,
  temperature: number,
): Pick<
  LlmProviderConfig,
  'apiKey' | 'baseUrl' | 'region' | 'httpReferer' | 'appTitle' | 'reasoningEffort' | 'reasoningEfforts'
> {
  if (provider === 'mistral') {
    return {
      apiKey: readEnv(env, 'MISTRAL_API_KEY'),
      baseUrl: readEnv(env, 'MISTRAL_BASE_URL') || MISTRAL_DEFAULT_BASE_URL,
    };
  }
  if (provider === 'bedrock') {
    return {
      region: resolveBedrockRegion(env),
    };
  }
  if (provider === 'ollama') {
    return {
      baseUrl: readEnv(env, 'OLLAMA_BASE_URL') || 'http://localhost:11434',
    };
  }
  if (provider === 'openrouter') {
    return {
      apiKey: readEnv(env, 'OPENROUTER_API_KEY'),
      baseUrl: readEnv(env, 'OPENROUTER_BASE_URL') || OPENROUTER_DEFAULT_BASE_URL,
      httpReferer: readEnv(env, 'OPENROUTER_HTTP_REFERER') || 'https://formulai.cloud',
      appTitle: readEnv(env, 'OPENROUTER_APP_TITLE') || 'FormulAI',
    };
  }
  return {
    apiKey: readEnv(env, 'OPENAI_API_KEY'),
    reasoningEffort: resolveOpenAiReasoningEffort(env),
    reasoningEfforts: Object.fromEntries(
      LLM_TASKS.map((task) => [task, resolveOpenAiReasoningEffort(env, task)]),
    ) as LlmProviderConfig['reasoningEfforts'],
  };
}

function modelsForProvider(
  provider: LlmProviderName,
  env: NodeJS.ProcessEnv,
): LlmTaskModels {
  return {
    chat: resolveTaskModel(provider, 'chat', env),
    analysis: resolveTaskModel(provider, 'analysis', env),
    guardian: resolveTaskModel(provider, 'guardian', env),
    classification: resolveTaskModel(provider, 'classification', env),
    embedding: resolveTaskModel(provider, 'embedding', env),
  };
}

/**
 * Config for one task — use this with `createChatModel(task, config)`.
 * Guardian / classification may resolve to OpenRouter while chat stays OpenAI.
 */
export function resolveLlmTaskConfig(
  task: LlmTask,
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig {
  const provider = resolveTaskProvider(task, env);
  const temperature = parseFloat(readEnv(env, 'LLM_TEMPERATURE') || '0.7');
  const safeTemperature = Number.isFinite(temperature) ? temperature : 0.7;
  const models = modelsForProvider(provider, env);
  return {
    provider,
    models,
    taskProviders: { [task]: provider },
    temperature: safeTemperature,
    ...credentialsForProvider(provider, env, safeTemperature),
  };
}

export function resolveLlmProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig {
  const provider = resolveLlmProviderName(env);
  const temperature = parseFloat(readEnv(env, 'LLM_TEMPERATURE') || '0.7');
  const safeTemperature = Number.isFinite(temperature) ? temperature : 0.7;

  const taskProviders = Object.fromEntries(
    LLM_TASKS.map((task) => [task, resolveTaskProvider(task, env)]),
  ) as Record<LlmTask, LlmProviderName>;

  // Record the model that will actually serve each task (may be jev).
  const models: LlmTaskModels = {
    chat: resolveTaskModel(taskProviders.chat, 'chat', env),
    analysis: resolveTaskModel(taskProviders.analysis, 'analysis', env),
    guardian: resolveTaskModel(taskProviders.guardian, 'guardian', env),
    classification: resolveTaskModel(
      taskProviders.classification,
      'classification',
      env,
    ),
    embedding: resolveTaskModel(provider, 'embedding', env),
  };

  return {
    provider,
    models,
    taskProviders,
    temperature: safeTemperature,
    ...credentialsForProvider(provider, env, safeTemperature),
  };
}

export function usesJevDecisions(
  task: LlmTask,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const config = resolveLlmTaskConfig(task, env);
  return (
    config.provider === 'openrouter' &&
    isJevDecisionModel(config.models[task]) &&
    Boolean(config.apiKey)
  );
}

/** True when classification is routed to jev — split combined analysis. */
export function shouldSplitCombinedAnalysis(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return usesJevDecisions('classification', env);
}

export function resolveEmbeddingProvider(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProviderName {
  const configured = readEnv(env, 'EMBEDDING_PROVIDER');
  if (
    configured === 'local' ||
    configured === 'ollama' ||
    configured === 'openai' ||
    configured === 'mistral' ||
    configured === 'bedrock'
  ) {
    return configured;
  }
  return 'local';
}

export function resolveEmbeddingDimension(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = parseInt(readEnv(env, 'LLM_EMBEDDING_DIMENSION') || '', 10);
  if (!Number.isNaN(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_EMBEDDING_DIMENSIONS[resolveEmbeddingProvider(env)];
}

export function resolveEmbeddingModelName(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const provider = resolveEmbeddingProvider(env);
  switch (provider) {
    case 'openai':
      return readEnv(env, 'OPENAI_EMBEDDING_MODEL') || DEFAULT_PROVIDER_MODELS.openai.embedding;
    case 'mistral':
      return (
        readEnv(env, 'MISTRAL_EMBEDDING_MODEL') ||
        readEnv(env, 'LLM_MODEL_EMBEDDING') ||
        DEFAULT_PROVIDER_MODELS.mistral.embedding
      );
    case 'bedrock':
      return (
        readEnv(env, 'BEDROCK_EMBEDDING_MODEL') ||
        readEnv(env, 'LLM_MODEL_EMBEDDING') ||
        DEFAULT_PROVIDER_MODELS.bedrock.embedding
      );
    case 'ollama':
      return readEnv(env, 'OLLAMA_EMBEDDING_MODEL') || DEFAULT_PROVIDER_MODELS.ollama.embedding;
    default:
      return readEnv(env, 'LOCAL_EMBEDDING_MODEL') || 'Xenova/all-MiniLM-L6-v2';
  }
}

/**
 * Map an MLflow flow key to the task model that should serve it.
 * Analytics + document extraction use the analysis model; form chat / guardian
 * use their dedicated slots. Combined-analysis classification overlay is jev
 * and does not go through invokeFlow.
 */
export function resolveTaskForFlow(flowKey: string): LlmTask {
  if (flowKey.startsWith('analytics.') || flowKey.startsWith('document_form.')) {
    return 'analysis';
  }
  if (flowKey.startsWith('security.')) {
    return 'guardian';
  }
  return 'chat';
}

export function buildChatInvokeOptions(
  provider: LlmProviderName,
  options: ChatInvokeOptions & { model?: string; temperature?: number } = {},
): Record<string, unknown> {
  const invoke: Record<string, unknown> = {};
  if (
    options.temperature != null &&
    !isOpenAiReasoningModel(options.model)
  ) {
    invoke.temperature = options.temperature;
  }
  if (options.useJsonFormat) {
    if (provider === 'mistral') {
      invoke.responseFormat = { type: 'json_object' };
    } else if (provider === 'bedrock') {
      // Converse API has no OpenAI json_object mode. JSON is enforced by the
      // prompt contract + parse; withStructuredOutput uses Converse toolConfig.
    } else if (provider !== 'ollama') {
      invoke.response_format = { type: 'json_object' };
    }
  }
  if (options.maxTokens) {
    invoke.max_tokens = options.maxTokens;
    invoke.maxTokens = options.maxTokens;
  }
  return invoke;
}
