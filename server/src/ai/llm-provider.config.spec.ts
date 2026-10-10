import {
  buildChatInvokeOptions,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_PROVIDER_MODELS,
  MISTRAL_DEFAULT_BASE_URL,
  resolveEmbeddingDimension,
  resolveEmbeddingModelName,
  resolveEmbeddingProvider,
  resolveLlmProviderConfig,
  resolveLlmProviderName,
  resolveTaskForFlow,
} from './llm-provider.config';

describe('llm-provider.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_MODEL;
    delete process.env.MISTRAL_BASE_URL;
    delete process.env.LLM_MODEL_CHAT;
    delete process.env.LLM_MODEL_ANALYSIS;
    delete process.env.LLM_MODEL_GUARDIAN;
    delete process.env.LLM_MODEL_EMBEDDING;
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.LLM_EMBEDDING_DIMENSION;
    delete process.env.OPENAI_EMBEDDING_MODEL;
    delete process.env.MISTRAL_EMBEDDING_MODEL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.LLM_TEMPERATURE;
    delete process.env.BEDROCK_MODEL;
    delete process.env.BEDROCK_REGION;
    delete process.env.BEDROCK_EMBEDDING_MODEL;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to openai so production behavior is unchanged', () => {
    expect(resolveLlmProviderName({})).toBe('openai');
    const config = resolveLlmProviderConfig({});
    expect(config.provider).toBe('openai');
    expect(config.models).toEqual(DEFAULT_PROVIDER_MODELS.openai);
  });

  it('treats unknown LLM_PROVIDER as openai', () => {
    expect(resolveLlmProviderName({ LLM_PROVIDER: 'anthropic' })).toBe('openai');
  });

  it('keeps a single OpenAI model when only OPENAI_MODEL is set', () => {
    const config = resolveLlmProviderConfig({
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-4o',
    });
    expect(config.models.chat).toBe('gpt-4o');
    expect(config.models.analysis).toBe('gpt-4o');
    expect(config.models.guardian).toBe('gpt-4o');
    expect(config.models.embedding).toBe('text-embedding-3-small');
    expect(config.apiKey).toBe('sk-test');
  });

  it('does not apply OPENAI_MODEL to embeddings', () => {
    const config = resolveLlmProviderConfig({
      OPENAI_MODEL: 'gpt-4o-mini',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large',
    });
    expect(config.models.embedding).toBe('text-embedding-3-large');
  });

  it('resolves Mistral defaults and EU endpoint', () => {
    const config = resolveLlmProviderConfig({
      LLM_PROVIDER: 'mistral',
      MISTRAL_API_KEY: 'mst-test',
    });
    expect(config.provider).toBe('mistral');
    expect(config.models.chat).toBe('mistral-small-latest');
    expect(config.models.analysis).toBe('mistral-medium-latest');
    expect(config.models.guardian).toBe('mistral-small-latest');
    expect(config.models.embedding).toBe('mistral-embed');
    expect(config.apiKey).toBe('mst-test');
    expect(config.baseUrl).toBe(MISTRAL_DEFAULT_BASE_URL);
    expect(MISTRAL_DEFAULT_BASE_URL).toBe('https://api.eu.mistral.ai');
  });

  it('resolves Bedrock EU region and inference-profile defaults', () => {
    const config = resolveLlmProviderConfig({
      LLM_PROVIDER: 'bedrock',
    });
    expect(config.provider).toBe('bedrock');
    expect(config.region).toBe('eu-central-1');
    expect(config.models.chat).toBe('eu.amazon.nova-lite-v1:0');
    expect(config.models.analysis).toBe('eu.amazon.nova-pro-v1:0');
    expect(config.models.guardian).toBe('eu.amazon.nova-micro-v1:0');
    expect(config.models.embedding).toBe('amazon.titan-embed-text-v2:0');
  });

  it('honors BEDROCK_REGION over AWS_REGION', () => {
    const config = resolveLlmProviderConfig({
      LLM_PROVIDER: 'bedrock',
      AWS_REGION: 'eu-west-1',
      BEDROCK_REGION: 'eu-central-1',
      BEDROCK_MODEL: 'eu.anthropic.claude-3-haiku-20240307-v1:0',
    });
    expect(config.region).toBe('eu-central-1');
    expect(config.models.chat).toBe('eu.anthropic.claude-3-haiku-20240307-v1:0');
    expect(config.models.analysis).toBe(
      'eu.anthropic.claude-3-haiku-20240307-v1:0',
    );
  });

  it('honors per-task model overrides over provider-wide model', () => {
    const config = resolveLlmProviderConfig({
      LLM_PROVIDER: 'mistral',
      MISTRAL_MODEL: 'mistral-small-latest',
      LLM_MODEL_ANALYSIS: 'mistral-large-latest',
      LLM_MODEL_CHAT: 'mistral-small-latest',
      MISTRAL_BASE_URL: 'https://api.mistral.ai',
    });
    expect(config.models.analysis).toBe('mistral-large-latest');
    expect(config.models.chat).toBe('mistral-small-latest');
    expect(config.baseUrl).toBe('https://api.mistral.ai');
  });

  it('maps flow keys to task slots', () => {
    expect(resolveTaskForFlow('analytics.combined_analysis')).toBe('analysis');
    expect(resolveTaskForFlow('analytics.summary')).toBe('analysis');
    expect(resolveTaskForFlow('document_form.map')).toBe('analysis');
    expect(resolveTaskForFlow('form_generation.strategy')).toBe('chat');
    expect(resolveTaskForFlow('security.guardian')).toBe('guardian');
  });

  it('builds provider-specific JSON invoke options', () => {
    expect(
      buildChatInvokeOptions('openai', { useJsonFormat: true, maxTokens: 100 }),
    ).toEqual({
      response_format: { type: 'json_object' },
      max_tokens: 100,
      maxTokens: 100,
    });
    expect(
      buildChatInvokeOptions('mistral', { useJsonFormat: true, maxTokens: 50 }),
    ).toEqual({
      responseFormat: { type: 'json_object' },
      max_tokens: 50,
      maxTokens: 50,
    });
    expect(buildChatInvokeOptions('ollama', { useJsonFormat: false })).toEqual({});
    expect(
      buildChatInvokeOptions('bedrock', { useJsonFormat: true, maxTokens: 80 }),
    ).toEqual({
      max_tokens: 80,
      maxTokens: 80,
    });
  });

  it('resolves embedding provider and dimensions independently of LLM_PROVIDER', () => {
    expect(resolveEmbeddingProvider({ LLM_PROVIDER: 'mistral' })).toBe('local');
    expect(resolveEmbeddingDimension({})).toBe(DEFAULT_EMBEDDING_DIMENSIONS.local);
    expect(
      resolveEmbeddingDimension({ EMBEDDING_PROVIDER: 'mistral' }),
    ).toBe(1024);
    expect(
      resolveEmbeddingDimension({
        EMBEDDING_PROVIDER: 'openai',
        LLM_EMBEDDING_DIMENSION: '3072',
      }),
    ).toBe(3072);
    expect(resolveEmbeddingModelName({ EMBEDDING_PROVIDER: 'mistral' })).toBe(
      'mistral-embed',
    );
    expect(
      resolveEmbeddingDimension({ EMBEDDING_PROVIDER: 'bedrock' }),
    ).toBe(1024);
    expect(resolveEmbeddingModelName({ EMBEDDING_PROVIDER: 'bedrock' })).toBe(
      'amazon.titan-embed-text-v2:0',
    );
  });
});
