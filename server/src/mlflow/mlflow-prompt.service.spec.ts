import { Test, TestingModule } from '@nestjs/testing';
import { FlowsConfigService } from '../mlflow/flows.config';
import { MlflowPromptService } from '../mlflow/mlflow-prompt.service';
import { PromptSandboxService } from '../mlflow/prompt-sandbox.service';

describe('MlflowPromptService', () => {
  let service: MlflowPromptService;
  let sandbox: PromptSandboxService;

  beforeEach(async () => {
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
});
