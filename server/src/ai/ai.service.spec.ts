import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { GuardianService } from './guardian.service';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';

const validForm = {
  title: 'Test Form',
  description: 'Test description',
  questions: [
    { id: 'q1', title: 'Question 1', type: 'text', required: true, order: 0 },
  ],
};

const mockUsage = {
  prompt_tokens: 10,
  completion_tokens: 20,
  total_tokens: 30,
};

const mockGuardianService = {
  validatePrompt: jest.fn().mockResolvedValue({ isSafe: true }),
};

const createMockChatModel = () => ({
  invoke: jest.fn().mockResolvedValue({
    content: JSON.stringify(validForm),
    response_metadata: { usage: mockUsage },
  }),
  withStructuredOutput: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({
      parsed: validForm,
      raw: {
        response_metadata: { usage: mockUsage },
      },
    }),
  }),
});

describe('AiService', () => {
  let aiService: AiService;
  let mockChatModel: ReturnType<typeof createMockChatModel>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockChatModel = createMockChatModel();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        AiService,
        { provide: GuardianService, useValue: mockGuardianService },
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    (aiService as any).chatModel = mockChatModel;
    (aiService as any).provider = 'openai';
  });

  describe('generate', () => {
    it('returns form with usage when LLM provides usage metadata', async () => {
      const dto: GenerateAIFormDto = { prompt: 'Create a feedback form', mode: 'generate' };

      const result = await aiService.generate(dto);

      expect(result).toMatchObject({
        title: validForm.title,
        description: validForm.description,
        questions: expect.any(Array),
      });
      expect(result.usage).toEqual({
        model: 'unknown',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
      expect(mockChatModel.withStructuredOutput).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ includeRaw: true }),
      );
    });
  });

  describe('generateWithSteps', () => {
    it('yields final step with usage when LLM provides usage metadata', async () => {
      const strategyJson = { purpose: 'test', audience: 'users', dataPoints: [], questionTypes: {}, considerations: [] };
      const questionsJson = [{ id: 'q1', title: 'Q', type: 'text', required: true, order: 0 }];

      mockChatModel.invoke
        .mockResolvedValueOnce({ content: JSON.stringify(strategyJson), response_metadata: { usage: { prompt_tokens: 5, completion_tokens: 5 } } })
        .mockResolvedValueOnce({ content: JSON.stringify(questionsJson), response_metadata: { usage: { prompt_tokens: 5, completion_tokens: 5 } } })
        .mockResolvedValueOnce({ content: JSON.stringify(questionsJson), response_metadata: { usage: { prompt_tokens: 5, completion_tokens: 5 } } });

      mockChatModel.withStructuredOutput.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          parsed: validForm,
          raw: {
            response_metadata: {
              usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            },
          },
        }),
      });

      const dto: GenerateAIFormDto = { prompt: 'Create a form', mode: 'generate' };
      const steps: any[] = [];
      for await (const step of aiService.generateWithSteps(dto)) {
        steps.push(step);
      }

      const finalStep = steps.find((s) => s.step === 'generate' && s.status === 'completed');
      expect(finalStep).toBeDefined();
      expect(finalStep.usage).toEqual({
        model: 'unknown',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it('extracts usage from raw metadata when structured output returns parsed payload only', async () => {
      const dto: GenerateAIFormDto = { prompt: 'Create a feedback form', mode: 'generate' };
      mockChatModel.withStructuredOutput.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          parsed: validForm,
          raw: {
            response_metadata: {
              tokenUsage: {
                promptTokens: 12,
                completionTokens: 8,
                totalTokens: 20,
              },
            },
          },
        }),
      });

      const result = await aiService.generate(dto);

      expect(result.usage).toEqual({
        model: 'unknown',
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
      });
    });
  });

  describe('analyzeTextWithUsage', () => {
    it('returns content and usage when LLM provides usage metadata', async () => {
      mockChatModel.invoke.mockResolvedValueOnce({
        content: JSON.stringify({ analysis: 'ok' }),
        response_metadata: { usage: mockUsage },
      });

      const result = await aiService.analyzeTextWithUsage('Analyze this', true);

      expect(result.content).toBe(JSON.stringify({ analysis: 'ok' }));
      expect(result.usage).toEqual({
        model: 'unknown',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });
  });

  describe('invokeModelRawWithUsage (via analyzeTextWithUsage)', () => {
    it('handles response with snake_case usage', async () => {
      mockChatModel.invoke.mockResolvedValueOnce({
        content: '{"result":"ok"}',
        response_metadata: { usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } },
      });

      const result = await aiService.analyzeTextWithUsage('test', true);

      expect(result.usage?.promptTokens).toBe(100);
      expect(result.usage?.completionTokens).toBe(50);
      expect(result.usage?.totalTokens).toBe(150);
    });

    it('computes totalTokens from prompt+completion when total_tokens missing', async () => {
      mockChatModel.invoke.mockResolvedValueOnce({
        content: '{}',
        response_metadata: { usage: { prompt_tokens: 5, completion_tokens: 3 } },
      });

      const result = await aiService.analyzeTextWithUsage('test', true);

      expect(result.usage?.totalTokens).toBe(8);
    });

    it('returns undefined usage when LLM provides no usage (e.g. Ollama)', async () => {
      mockChatModel.invoke.mockResolvedValueOnce({
        content: '{"result":"ok"}',
      });

      const result = await aiService.analyzeTextWithUsage('test', true);

      expect(result.usage).toBeUndefined();
    });
  });
});
