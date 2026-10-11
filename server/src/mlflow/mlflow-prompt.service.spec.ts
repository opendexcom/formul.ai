import { Test, TestingModule } from '@nestjs/testing';
import { FlowsConfigService } from '../mlflow/flows.config';
import { MlflowPromptService } from '../mlflow/mlflow-prompt.service';
import { PromptSandboxService } from '../mlflow/prompt-sandbox.service';

describe('MlflowPromptService', () => {
  let service: MlflowPromptService;
  let sandbox: PromptSandboxService;

  beforeEach(async () => {
    process.env.MLFLOW_TRACKING_URI = 'http://localhost:5000';
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlowsConfigService, PromptSandboxService, MlflowPromptService],
    }).compile();
    await module.init();

    service = module.get(MlflowPromptService);
    sandbox = module.get(PromptSandboxService);
  });

  it('formats templates with allowed variables', async () => {
    const formatted = sandbox.formatTemplate(
      'Hello {{userInput}}',
      { userInput: 'world' },
      ['userInput'],
    );
    expect(formatted).toBe('Hello world');
  });

  it('rejects disallowed variables', () => {
    expect(() =>
      sandbox.formatTemplate('Hello {{userInput}}', { bad: 'x' }, ['userInput']),
    ).toThrow();
  });

  it('exposes getPromptVersionsForFlows as a function', () => {
    expect(typeof service.getPromptVersionsForFlows).toBe('function');
  });

  it('formats analytics sentiment agent prompt as a single template', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const nameMatch = url.match(/name=([^&]+)/);
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : '';
      const templates: Record<string, string> = {
        'formulai-analytics-sentiment':
          'Agent rules. Task {{responseCount}} {{responsesData}}{{ratingContext}}',
      };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model_version: {
            version: '1',
            tags: [{ key: 'mlflow.prompt.text', value: templates[name] ?? 'missing' }],
          },
        }),
      };
    }) as typeof fetch;

    try {
      const formatted = await service.formatFlow('analytics.sentiment', {
        responseCount: '2',
        responsesData: '[]',
        ratingContext: '',
      });
      expect(formatted.systemPrompt).toBeUndefined();
      expect(formatted.prompt).toBe('Agent rules. Task 2 []');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
