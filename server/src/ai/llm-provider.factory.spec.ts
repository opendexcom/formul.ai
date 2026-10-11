import { createChatModel, createEmbeddingModel } from './llm-provider.factory';
import type { LlmProviderConfig } from './llm-provider.types';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((opts) => ({ provider: 'openai', opts })),
  OpenAIEmbeddings: jest.fn().mockImplementation((opts) => ({
    provider: 'openai-embed',
    opts,
    embedQuery: jest.fn(),
  })),
}));

jest.mock('@langchain/mistralai', () => ({
  ChatMistralAI: jest.fn().mockImplementation((opts) => ({ provider: 'mistral', opts })),
  MistralAIEmbeddings: jest.fn().mockImplementation((opts) => ({
    provider: 'mistral-embed',
    opts,
    embedQuery: jest.fn(),
  })),
}));

jest.mock(
  '@langchain/community/chat_models/ollama',
  () => ({
    ChatOllama: jest.fn().mockImplementation((opts) => ({ provider: 'ollama', opts })),
  }),
  { virtual: true },
);

jest.mock('@langchain/aws', () => ({
  ChatBedrockConverse: jest.fn().mockImplementation((opts) => ({
    provider: 'bedrock',
    opts,
  })),
  BedrockEmbeddings: jest.fn().mockImplementation((opts) => ({
    provider: 'bedrock-embed',
    opts,
    embedQuery: jest.fn(),
  })),
}));

const openaiConfig: LlmProviderConfig = {
  provider: 'openai',
  models: {
    chat: 'gpt-4o-mini',
    analysis: 'gpt-4o',
    guardian: 'gpt-4o-mini',
    classification: 'gpt-4o-mini',
    embedding: 'text-embedding-3-small',
  },
  apiKey: 'sk-test',
  temperature: 0.7,
};

const mistralConfig: LlmProviderConfig = {
  provider: 'mistral',
  models: {
    chat: 'mistral-small-latest',
    analysis: 'mistral-medium-latest',
    guardian: 'mistral-small-latest',
    classification: 'mistral-small-latest',
    embedding: 'mistral-embed',
  },
  apiKey: 'mst-test',
  baseUrl: 'https://api.mistral.ai',
  temperature: 0.4,
};

describe('llm-provider.factory', () => {
  it('returns null when the cloud provider has no API key', () => {
    expect(
      createChatModel('chat', { ...openaiConfig, apiKey: undefined }),
    ).toBeNull();
    expect(
      createChatModel('chat', { ...mistralConfig, apiKey: undefined }),
    ).toBeNull();
    expect(
      createEmbeddingModel({ ...mistralConfig, apiKey: undefined }),
    ).toBeNull();
  });

  it('creates OpenAI chat models with the task-specific model name', () => {
    const { ChatOpenAI } = require('@langchain/openai');
    const model = createChatModel('analysis', openaiConfig) as { opts: Record<string, unknown> };
    expect(ChatOpenAI).toHaveBeenCalled();
    expect(model.opts.model).toBe('gpt-4o');
    expect(model.opts.apiKey).toBe('sk-test');
  });

  it('creates Mistral chat models against the EU endpoint', () => {
    const { ChatMistralAI } = require('@langchain/mistralai');
    const model = createChatModel('chat', mistralConfig) as { opts: Record<string, unknown> };
    expect(ChatMistralAI).toHaveBeenCalled();
    expect(model.opts.model).toBe('mistral-small-latest');
    expect(model.opts.apiKey).toBe('mst-test');
    expect(model.opts.serverURL).toBe('https://api.mistral.ai');
    expect(model.opts.endpoint).toBe('https://api.mistral.ai');
    expect(model.opts.temperature).toBe(0.4);
  });

  it('forces guardian temperature to 0', () => {
    const model = createChatModel('guardian', mistralConfig) as { opts: Record<string, unknown> };
    expect(model.opts.temperature).toBe(0);
  });

  it('omits temperature and passes per-task reasoning effort for gpt-5*', () => {
    const { ChatOpenAI } = require('@langchain/openai');
    ChatOpenAI.mockClear();
    const model = createChatModel('analysis', {
      ...openaiConfig,
      models: {
        ...openaiConfig.models,
        analysis: 'gpt-5-mini',
      },
      reasoningEffort: 'low',
      reasoningEfforts: {
        chat: 'low',
        analysis: 'high',
        guardian: 'minimal',
        classification: 'low',
      },
    }) as { opts: Record<string, unknown> };
    expect(model.opts.model).toBe('gpt-5-mini');
    expect(model.opts.temperature).toBeUndefined();
    expect(model.opts.reasoning).toEqual({ effort: 'high' });
  });

  it('keeps temperature on non-reasoning OpenAI models', () => {
    const model = createChatModel('chat', openaiConfig) as {
      opts: Record<string, unknown>;
    };
    expect(model.opts.model).toBe('gpt-4o-mini');
    expect(model.opts.temperature).toBe(0.7);
    expect(model.opts.reasoning).toBeUndefined();
  });

  it('omits guardian temperature when guardian is an explicit gpt-5 model', () => {
    const model = createChatModel('guardian', {
      ...openaiConfig,
      models: { ...openaiConfig.models, guardian: 'gpt-5-mini' },
      reasoningEffort: 'low',
    }) as { opts: Record<string, unknown> };
    expect(model.opts.temperature).toBeUndefined();
    expect(model.opts.reasoning).toEqual({ effort: 'low' });
  });

  it('creates Mistral embeddings with mistral-embed', () => {
    const { MistralAIEmbeddings } = require('@langchain/mistralai');
    const model = createEmbeddingModel(mistralConfig) as { opts: Record<string, unknown> };
    expect(MistralAIEmbeddings).toHaveBeenCalled();
    expect(model.opts.model).toBe('mistral-embed');
    expect(model.opts.serverURL).toBe('https://api.mistral.ai');
    expect(model.opts.endpoint).toBe('https://api.mistral.ai');
  });

  it('creates Bedrock Converse models without static AWS keys', () => {
    const { ChatBedrockConverse } = require('@langchain/aws');
    const model = createChatModel('analysis', {
      provider: 'bedrock',
      models: {
        chat: 'eu.amazon.nova-lite-v1:0',
        analysis: 'eu.amazon.nova-pro-v1:0',
        guardian: 'eu.amazon.nova-micro-v1:0',
        classification: 'eu.amazon.nova-micro-v1:0',
        embedding: 'amazon.titan-embed-text-v2:0',
      },
      region: 'eu-central-1',
      temperature: 0.3,
    }) as { opts: Record<string, unknown> };
    expect(ChatBedrockConverse).toHaveBeenCalled();
    expect(model.opts.model).toBe('eu.amazon.nova-pro-v1:0');
    expect(model.opts.region).toBe('eu-central-1');
  });

  it('creates Bedrock embeddings with Titan V2 in the EU region', () => {
    const { BedrockEmbeddings } = require('@langchain/aws');
    const model = createEmbeddingModel({
      provider: 'bedrock',
      models: {
        chat: 'eu.amazon.nova-lite-v1:0',
        analysis: 'eu.amazon.nova-pro-v1:0',
        guardian: 'eu.amazon.nova-micro-v1:0',
        classification: 'eu.amazon.nova-micro-v1:0',
        embedding: 'amazon.titan-embed-text-v2:0',
      },
      region: 'eu-central-1',
      temperature: 0.3,
    }) as { opts: Record<string, unknown> };
    expect(BedrockEmbeddings).toHaveBeenCalled();
    expect(model.opts.model).toBe('amazon.titan-embed-text-v2:0');
    expect(model.opts.region).toBe('eu-central-1');
  });

  it('creates Ollama chat models without an API key', () => {
    const model = createChatModel('chat', {
      provider: 'ollama',
      models: {
        chat: 'llama2',
        analysis: 'llama2',
        guardian: 'llama2',
        classification: 'llama2',
        embedding: 'nomic-embed-text',
      },
      baseUrl: 'http://localhost:11434',
      temperature: 0.2,
    }) as { opts: Record<string, unknown> };
    expect(model.opts.model).toBe('llama2');
    expect(model.opts.baseUrl).toBe('http://localhost:11434');
  });

  it('creates OpenRouter chat models against the OpenAI-compatible base URL', () => {
    const { ChatOpenAI } = require('@langchain/openai');
    ChatOpenAI.mockClear();
    const model = createChatModel('chat', {
      provider: 'openrouter',
      models: {
        chat: 'openai/gpt-4o-mini',
        analysis: 'openai/gpt-4o-mini',
        guardian: 'typesafe/jev-1.13',
        classification: 'typesafe/jev-1.13',
        embedding: 'openai/text-embedding-3-small',
      },
      apiKey: 'or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      temperature: 0.2,
      httpReferer: 'https://formulai.cloud',
      appTitle: 'FormulAI',
    }) as { opts: Record<string, unknown> };
    expect(model.opts.model).toBe('openai/gpt-4o-mini');
    expect(model.opts.configuration).toEqual({
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://formulai.cloud',
        'X-Title': 'FormulAI',
      },
    });
    expect(model.opts.modelKwargs).toEqual({
      provider: { data_collection: 'deny' },
    });
  });

  it('returns null for jev decision models (not chat completions)', () => {
    expect(
      createChatModel('guardian', {
        provider: 'openrouter',
        models: {
          chat: 'openai/gpt-4o-mini',
          analysis: 'openai/gpt-4o-mini',
          guardian: 'typesafe/jev-1.13',
          classification: 'typesafe/jev-1.13',
          embedding: 'openai/text-embedding-3-small',
        },
        apiKey: 'or-test',
        temperature: 0,
      }),
    ).toBeNull();
  });
});
