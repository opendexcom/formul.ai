import { Test, TestingModule } from '@nestjs/testing';
import { SummaryGenerator } from './summary.generator';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';

describe('SummaryGenerator', () => {
  let generator: SummaryGenerator;
  let aiService: jest.Mocked<Pick<AiService, 'analyzeTextWithUsage'>>;
  let promptBuilder: jest.Mocked<
    Pick<PromptBuilder, 'buildAnalyticsSummaryPrompt'>
  >;

  const mockForm = { _id: 'form1', title: 'Test Form', questions: [] } as any;
  const mockResponses: any[] = [];
  const mockPrompt = 'mock-analytics-summary-prompt';

  beforeEach(async () => {
    const mockAnalyzeTextWithUsage = jest.fn().mockResolvedValue({
      content: 'Generated executive summary.',
    });
    const mockBuildAnalyticsSummaryPrompt = jest
      .fn()
      .mockReturnValue(mockPrompt);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryGenerator,
        {
          provide: AiService,
          useValue: { analyzeTextWithUsage: mockAnalyzeTextWithUsage },
        },
        {
          provide: PromptBuilder,
          useValue: {
            buildAnalyticsSummaryPrompt: mockBuildAnalyticsSummaryPrompt,
          },
        },
      ],
    }).compile();

    generator = module.get<SummaryGenerator>(SummaryGenerator);
    aiService = module.get(AiService);
    promptBuilder = module.get(PromptBuilder);
  });

  describe('generateAnalyticsSummary', () => {
    it('calls analyzeTextWithUsage with skipValidation=false and useJsonFormat=false so prompt is validated and response is plain text', async () => {
      await generator.generateAnalyticsSummary(
        mockForm,
        mockResponses,
        [],
        {},
        [],
        [],
        [],
        [],
      );

      expect(aiService.analyzeTextWithUsage).toHaveBeenCalledTimes(1);
      expect(aiService.analyzeTextWithUsage).toHaveBeenCalledWith(
        mockPrompt,
        false, // skipValidation: must validate analytics prompt
        false, // useJsonFormat: plain text summary
      );
    });
  });
});
