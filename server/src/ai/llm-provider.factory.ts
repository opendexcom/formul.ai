import type { LlmProviderConfig, LlmTask } from './llm-provider.types';
import {
  BEDROCK_DEFAULT_REGION,
  resolveLlmProviderConfig,
} from './llm-provider.config';
import { isOpenAiReasoningModel } from './llm-usage';

export type ChatModelLike = {
  invoke: (...args: unknown[]) => Promise<unknown>;
  withStructuredOutput?: (schema: unknown, options?: unknown) => unknown;
};

export type EmbeddingModelLike = {
  embedQuery: (text: string) => Promise<number[]>;
};

export function createChatModel(
  task: LlmTask = 'chat',
  config: LlmProviderConfig = resolveLlmProviderConfig(),
): ChatModelLike | null {
  const model = config.models[task];
  const temperature = task === 'guardian' ? 0 : config.temperature;

  if (config.provider === 'mistral') {
    if (!config.apiKey) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ChatMistralAI } = require('@langchain/mistralai');
    return new ChatMistralAI({
      apiKey: config.apiKey,
      model,
      temperature,
      serverURL: config.baseUrl,
      endpoint: config.baseUrl,
    });
  }

  if (config.provider === 'bedrock') {
    // Credentials come from the default AWS SDK chain (env keys, shared
    // config, instance/task role). Do not require AWS_ACCESS_KEY_ID here.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ChatBedrockConverse } = require('@langchain/aws');
    return new ChatBedrockConverse({
      model,
      region: config.region || BEDROCK_DEFAULT_REGION,
      temperature,
    });
  }

  if (config.provider === 'ollama') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ChatOllama } = require('@langchain/community/chat_models/ollama');
    return new ChatOllama({
      baseUrl: config.baseUrl,
      model,
      temperature,
    });
  }

  if (!config.apiKey) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ChatOpenAI } = require('@langchain/openai');
  const fields: Record<string, unknown> = {
    apiKey: config.apiKey,
    model,
  };
  if (isOpenAiReasoningModel(model)) {
    // gpt-5* / o* reject temperature != 1; @langchain/openai still sends it.
    // Omit the field. Effort is per-task, default `low`.
    const effort =
      config.reasoningEfforts?.[task] ?? config.reasoningEffort ?? 'low';
    fields.reasoning = { effort };
  } else {
    fields.temperature = temperature;
  }
  return new ChatOpenAI(fields);
}

export function createEmbeddingModel(
  config: LlmProviderConfig = resolveLlmProviderConfig(),
): EmbeddingModelLike | null {
  if (config.provider === 'mistral') {
    if (!config.apiKey) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MistralAIEmbeddings } = require('@langchain/mistralai');
    return new MistralAIEmbeddings({
      apiKey: config.apiKey,
      model: config.models.embedding,
      serverURL: config.baseUrl,
      endpoint: config.baseUrl,
    });
  }

  if (config.provider === 'bedrock') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BedrockEmbeddings } = require('@langchain/aws');
    return new BedrockEmbeddings({
      model: config.models.embedding,
      region: config.region || BEDROCK_DEFAULT_REGION,
    });
  }

  if (config.provider === 'openai') {
    if (!config.apiKey) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OpenAIEmbeddings } = require('@langchain/openai');
    return new OpenAIEmbeddings({
      apiKey: config.apiKey,
      model: config.models.embedding,
    });
  }

  return null;
}
