import { Test, TestingModule } from '@nestjs/testing';
import { buildFormGenerationGraph } from './form-generation.graph';
import type { FormGenerationHints } from './form-generation.helpers';

const hints: FormGenerationHints = {
  currentFormContext: '\n\nThis is a new form being created from scratch.',
  modificationsHint: '',
  modificationsShape: '',
  refineHint: '',
  preserveHint: '',
};

describe('FormGenerationGraph', () => {
  let mockAiService: {
    invokeFlow: jest.Mock;
    sanitizeAiFormOutput: jest.Mock;
  };
  let mockGuardianService: { validatePrompt: jest.Mock };

  beforeEach(() => {
    mockAiService = {
      invokeFlow: jest.fn(),
      sanitizeAiFormOutput: jest.fn((form) => form),
    };
    mockGuardianService = {
      validatePrompt: jest.fn().mockResolvedValue({ isSafe: true }),
    };
  });

  it('stops after guardianCheck when prompt is unsafe', async () => {
    mockGuardianService.validatePrompt.mockResolvedValueOnce({
      isSafe: false,
      reason: 'Unsafe',
    });

    const graph = buildFormGenerationGraph({
      aiService: mockAiService as any,
      guardianService: mockGuardianService as any,
    });

    const steps: unknown[] = [];
    const result = await graph.invoke(
      { prompt: 'bad', hints, steps: [] },
      {
        configurable: {
          onStep: (step: unknown) => steps.push(step),
        },
      },
    );

    expect(mockAiService.invokeFlow).not.toHaveBeenCalled();
    expect(result.guardianFailed).toBe(true);
    expect(steps).toEqual([
      expect.objectContaining({ step: 'error', status: 'error' }),
    ]);
  });

  it('runs strategy through final nodes in order', async () => {
    const strategy = { purpose: 'Feedback' };
    const questions = [{ id: 'q1' }];
    const optimized = [{ id: 'q1', type: 'text' }];
    const finalForm = { title: 'T', description: 'D', questions: optimized };

    mockAiService.invokeFlow
      .mockResolvedValueOnce({ content: JSON.stringify(strategy), usage: { totalTokens: 1 } })
      .mockResolvedValueOnce({ content: JSON.stringify(questions), usage: { totalTokens: 2 } })
      .mockResolvedValueOnce({ content: JSON.stringify(optimized), usage: { totalTokens: 3 } })
      .mockResolvedValueOnce({ content: JSON.stringify(finalForm), usage: { totalTokens: 4 } });
    mockAiService.sanitizeAiFormOutput.mockReturnValue(finalForm);

    const graph = buildFormGenerationGraph({
      aiService: mockAiService as any,
      guardianService: mockGuardianService as any,
    });

    const result = await graph.invoke(
      { prompt: 'Create feedback form', hints, steps: [] },
      { configurable: {} },
    );

    expect(mockAiService.invokeFlow).toHaveBeenCalledTimes(4);
    expect(mockAiService.invokeFlow.mock.calls[0][0]).toBe('form_generation.strategy');
    expect(mockAiService.invokeFlow.mock.calls[1][0]).toBe('form_generation.questions');
    expect(mockAiService.invokeFlow.mock.calls[2][0]).toBe('form_generation.optimize');
    expect(mockAiService.invokeFlow.mock.calls[3][0]).toBe('form_generation.final');
    expect(result.finalForm).toEqual(finalForm);
  });
});
