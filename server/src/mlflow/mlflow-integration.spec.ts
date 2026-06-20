import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { FlowsConfigService } from './flows.config';
import { MlflowPromptService } from './mlflow-prompt.service';
import { PromptSandboxService } from './prompt-sandbox.service';
import { SemanticLlmCacheService } from '../ai/semantic-llm-cache.service';
import { EmbeddingService } from '../ai/embedding.service';
import { AiService } from '../ai/ai.service';
import { GuardianService } from '../ai/guardian.service';
import { GraphRunnerService } from '../graphs/graph-runner.service';
import * as mlflowCore from '@mlflow/core';
import * as mlflowTracing from './mlflow-langchain-tracing';

describe('MLflow prompt load + cache integration', () => {
  const flowsPath = join(__dirname, '../../../mlflow/flows.yml');

  beforeEach(() => {
    process.env.MLFLOW_TRACKING_URI = 'http://localhost:5000';
    process.env.MLFLOW_FLOWS_PATH = flowsPath;
    process.env.MLFLOW_PROMPT_CACHE_TTL_SECONDS = '60';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and formats a prompt from the registry REST API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model_version: {
          version: '2',
          tags: [
            {
              key: 'mlflow.prompt.text',
              value: 'Summarize: {{summaryContext}}',
            },
          ],
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [FlowsConfigService, PromptSandboxService, MlflowPromptService],
    }).compile();
    await module.init();

    const prompts = module.get(MlflowPromptService);
    const { prompt, loaded } = await prompts.formatFlow('analytics.summary', {
      summaryContext: 'test data',
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(loaded.version).toBe('2');
    expect(prompt).toBe('Summarize: test data');
  });

  it('serves exact cache hits after store', async () => {
    const kv = new Map<string, string>();
    const mockRedis = {
      get: jest.fn(async (key: string) => kv.get(key) ?? null),
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        kv.set(key, value);
        return 'OK';
      }),
      call: jest.fn(),
    };

    process.env.LLM_SEMANTIC_CACHE_ENABLED = 'true';
    const cache = new SemanticLlmCacheService();
    (cache as unknown as { redis: typeof mockRedis }).redis = mockRedis;

    const policy = {
      enabled: true,
      mode: 'exact' as const,
      scope: 'user' as const,
      ttl_seconds: 60,
    };
    const ctx = {
      flowKey: 'analytics.summary',
      scopeId: 'user-a',
      promptVersion: '1',
      model: 'gpt-4o-mini',
      useJsonFormat: false,
    };

    await cache.store('prompt-a', 'cached-response', policy, ctx);
    const hit = await cache.lookup('prompt-a', policy, ctx);

    expect(hit).toEqual(
      expect.objectContaining({
        content: 'cached-response',
        cacheMode: 'exact',
      }),
    );
  });

  it('records invokeFlow cache hits via MLflow spans with token usage', async () => {
    const setAttribute = jest.fn();
    const withSpanSpy = jest
      .spyOn(mlflowCore, 'withSpan')
      .mockImplementation((fn: (span: { setOutputs: jest.Mock; setAttribute: jest.Mock }) => unknown) =>
        fn({ setOutputs: jest.fn(), setAttribute }),
      );
    jest.spyOn(mlflowTracing, 'isMlflowTracingEnabled').mockReturnValue(true);

    const mockGuardian = { validatePrompt: jest.fn().mockResolvedValue({ isSafe: true }) };
    const mockSemanticCache = {
      lookup: jest.fn().mockResolvedValue({
        content: 'cached',
        cacheMode: 'exact',
      }),
      store: jest.fn(),
      resolveScopeId: jest.fn().mockReturnValue('scope'),
      isEnabled: jest.fn().mockReturnValue(true),
    };
    const mockMlflowPrompts = {
      formatFlow: jest.fn().mockResolvedValue({
        prompt: 'test prompt',
        loaded: { name: 'p', version: '3', template: '', alias: 'production' },
      }),
    };
    const mockFlowsConfig = {
      hasFlow: jest.fn().mockReturnValue(true),
      getCachePolicy: jest.fn().mockReturnValue({
        enabled: true,
        mode: 'exact',
        scope: 'user',
      }),
    };
    const mockEmbeddings = { isAvailable: jest.fn().mockReturnValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        GraphRunnerService,
        { provide: GuardianService, useValue: mockGuardian },
        { provide: MlflowPromptService, useValue: mockMlflowPrompts },
        { provide: FlowsConfigService, useValue: mockFlowsConfig },
        { provide: SemanticLlmCacheService, useValue: mockSemanticCache },
        { provide: EmbeddingService, useValue: mockEmbeddings },
      ],
    }).compile();

    const ai = module.get(AiService);
    const result = await ai.invokeFlow('analytics.summary', { summaryContext: 'x' });

    expect(result.content).toBe('cached');
    expect(withSpanSpy).toHaveBeenCalled();
    expect(setAttribute).toHaveBeenCalledWith(
      mlflowCore.SpanAttributeKey.TOKEN_USAGE,
      expect.objectContaining({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      }),
    );
    withSpanSpy.mockRestore();
  });
});
