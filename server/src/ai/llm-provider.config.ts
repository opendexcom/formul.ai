import {
  LLM_PROVIDERS,
  type ChatInvokeOptions,
  type EmbeddingProviderName,
  type LlmProviderConfig,
  type LlmProviderName,
  type LlmTask,
  type LlmTaskModels,
} from './llm-provider.types';

/** Defaults preserve current OpenAI production behavior (single gpt-4o-mini). */
export const DEFAULT_PROVIDER_MODELS: Record<LlmProviderName, LlmTaskModels> = {
  openai: {
    chat: 'gpt-4o-mini',
    analysis: 'gpt-4o-mini',
    guardian: 'gpt-4o-mini',
    embedding: 'text-embedding-3-small',
  },
  mistral: {
    chat: 'mistral-small-latest',
    // Small is the cost default. Medium 3.5 is ~11x gpt-4o-mini on a
    // 100-response analysis. Set LLM_MODEL_ANALYSIS=mistral-large-latest
    // when quality matters more than price.
    analysis: 'mistral-small-latest',
    guardian: 'mistral-small-latest',
    embedding: 'mistral-embed',
  },
  bedrock: {
    // EU geo inference profiles keep prompts/completions inside the EU.
    chat: 'eu.amazon.nova-lite-v1:0',
    // Nova Lite is the cost default. Set LLM_MODEL_ANALYSIS to
    // eu.amazon.nova-pro-v1:0 for higher-quality analysis.
    analysis: 'eu.amazon.nova-lite-v1:0',
    guardian: 'eu.amazon.nova-micro-v1:0',
    // Titan V2 is in-region in eu-central-1 (no geo profile). 1024-d default.
    embedding: 'amazon.titan-embed-text-v2:0',
  },
  ollama: {
    chat: 'llama2',
    analysis: 'llama2',
    guardian: 'llama2',
    embedding: 'nomic-embed-text',
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
    default:
      return readEnv(env, 'OPENAI_MODEL');
  }
}

function resolveTaskModel(
  provider: LlmProviderName,
  task: keyof LlmTaskModels,
  env: NodeJS.ProcessEnv,
): string {
  const perTaskKey: Record<keyof LlmTaskModels, string> = {
    chat: 'LLM_MODEL_CHAT',
    analysis: 'LLM_MODEL_ANALYSIS',
    guardian: 'LLM_MODEL_GUARDIAN',
    embedding: 'LLM_MODEL_EMBEDDING',
  };
  if (task === 'embedding') {
    return (
      readEnv(env, perTaskKey.embedding) ||
      embeddingModelOverride(provider, env) ||
      DEFAULT_PROVIDER_MODELS[provider].embedding
    );
  }
  return (
    readEnv(env, perTaskKey[task]) ||
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
    default:
      return readEnv(env, 'OPENAI_EMBEDDING_MODEL');
  }
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

export function resolveLlmProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): LlmProviderConfig {
  const provider = resolveLlmProviderName(env);
  const temperature = parseFloat(readEnv(env, 'LLM_TEMPERATURE') || '0.7');
  const safeTemperature = Number.isFinite(temperature) ? temperature : 0.7;

  const models: LlmTaskModels = {
    chat: resolveTaskModel(provider, 'chat', env),
    analysis: resolveTaskModel(provider, 'analysis', env),
    guardian: resolveTaskModel(provider, 'guardian', env),
    embedding: resolveTaskModel(provider, 'embedding', env),
  };

  if (provider === 'mistral') {
    return {
      provider,
      models,
      apiKey: readEnv(env, 'MISTRAL_API_KEY'),
      baseUrl: readEnv(env, 'MISTRAL_BASE_URL') || MISTRAL_DEFAULT_BASE_URL,
      temperature: safeTemperature,
    };
  }

  if (provider === 'bedrock') {
    return {
      provider,
      models,
      region: resolveBedrockRegion(env),
      temperature: safeTemperature,
    };
  }

  if (provider === 'ollama') {
    return {
      provider,
      models,
      baseUrl: readEnv(env, 'OLLAMA_BASE_URL') || 'http://localhost:11434',
      temperature: safeTemperature,
    };
  }

  return {
    provider: 'openai',
    models,
    apiKey: readEnv(env, 'OPENAI_API_KEY'),
    temperature: safeTemperature,
  };
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
 * use their dedicated slots.
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
  options: ChatInvokeOptions = {},
): Record<string, unknown> {
  const invoke: Record<string, unknown> = {};
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
