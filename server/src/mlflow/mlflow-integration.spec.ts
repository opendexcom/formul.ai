import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { FlowsConfigService } from './flows.config';
import { MlflowPromptService } from './mlflow-prompt.service';
import { PromptSandboxService } from './prompt-sandbox.service';
import { SemanticLlmCacheService } from '../ai/semantic-llm-cache.service';

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

    const miss = await cache.lookup('prompt text', policy, ctx);
    expect(miss).toBeNull();

    await cache.store('prompt text', 'cached response', policy, ctx);
    const hit = await cache.lookup('prompt text', policy, ctx);

    expect(hit).toEqual({ content: 'cached response', cacheMode: 'exact' });
  });

  it('isolates cache scope between users', async () => {
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

    const ctxA = {
      flowKey: 'form_generation.single_shot_create',
      scopeId: cache.resolveScopeId(policy, { userId: 'user-a' }),
      promptVersion: '1',
      model: 'gpt-4o-mini',
      useJsonFormat: false,
    };
    const ctxB = {
      ...ctxA,
      scopeId: cache.resolveScopeId(policy, { userId: 'user-b' }),
    };

    await cache.store('same prompt', 'user-a response', policy, ctxA);
    const hitA = await cache.lookup('same prompt', policy, ctxA);
    const hitB = await cache.lookup('same prompt', policy, ctxB);

    expect(hitA?.content).toBe('user-a response');
    expect(hitB).toBeNull();
  });
});
