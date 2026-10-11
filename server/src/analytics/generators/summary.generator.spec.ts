import { Test, TestingModule } from '@nestjs/testing';
import { SummaryGenerator } from './summary.generator';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';
import { AnalyticsUsageTrackerService } from '../services/analytics-usage-tracker.service';
import { ResearchContextService } from '../../projects/research-context.service';

describe('SummaryGenerator', () => {
  let generator: SummaryGenerator;
  let aiService: jest.Mocked<Pick<AiService, 'invokeFlow'>>;
  let promptBuilder: jest.Mocked<
    Pick<PromptBuilder, 'buildAnalyticsSummaryVariables'>
  >;

  const mockForm = { _id: 'form1', title: 'Test Form', questions: [] } as any;
  const mockResponses: any[] = [];
  const mockVariables = { summaryContext: 'mock-analytics-summary-context' };

  beforeEach(async () => {
    const mockInvokeFlow = jest.fn().mockResolvedValue({
      content: 'Generated executive summary.',
    });
    const mockBuildAnalyticsSummaryVariables = jest
      .fn()
      .mockReturnValue(mockVariables);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryGenerator,
        {
          provide: AiService,
          useValue: { invokeFlow: mockInvokeFlow },
        },
        {
          provide: PromptBuilder,
          useValue: {
            buildAnalyticsSummaryVariables: mockBuildAnalyticsSummaryVariables,
          },
        },
        {
          provide: AnalyticsUsageTrackerService,
          useValue: { recordUsage: jest.fn() },
        },
        {
          provide: ResearchContextService,
          useValue: { resolveForForm: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    generator = module.get<SummaryGenerator>(SummaryGenerator);
    aiService = module.get(AiService);
    promptBuilder = module.get(PromptBuilder);
  });

  describe('generateAnalyticsSummary', () => {
    it('calls invokeFlow for analytics.summary with skipValidation and plain text output', async () => {
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

      expect(promptBuilder.buildAnalyticsSummaryVariables).toHaveBeenCalledTimes(1);
      expect(aiService.invokeFlow).toHaveBeenCalledTimes(1);
      expect(aiService.invokeFlow).toHaveBeenCalledWith(
        'analytics.summary',
        mockVariables,
        {
          skipValidation: true,
          useJsonFormat: false,
          formId: 'form1',
        },
      );
    });
  });
});
