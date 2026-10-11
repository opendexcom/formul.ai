import * as mlflowCore from '@mlflow/core';
import type { LiveSpan } from '@mlflow/core';
import * as mlflowTracing from './mlflow-langchain-tracing';
import {
  applyTokenUsageToSpan,
  recordDlqFailureToMlflow,
  withEmbeddingSpan,
  withGraphNodeSpan,
} from './mlflow-trace-context';

describe('mlflow-trace-context helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applyTokenUsageToSpan sets token usage attributes', () => {
    const setAttribute = jest.fn();
    const span = { setAttribute } as unknown as LiveSpan;

    applyTokenUsageToSpan(span, {
      model: 'gpt-4o',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });

    expect(setAttribute).toHaveBeenCalledWith(
      mlflowCore.SpanAttributeKey.TOKEN_USAGE,
      {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
    );
  });

  it('withEmbeddingSpan is a no-op when tracing is disabled', async () => {
    jest.spyOn(mlflowTracing, 'isMlflowTracingEnabled').mockReturnValue(false);
    const withSpanSpy = jest.spyOn(mlflowCore, 'withSpan');

    const result = await withEmbeddingSpan(
      { provider: 'local', model: 'test', textLength: 4 },
      async () => [0.1, 0.2],
    );

    expect(result).toEqual([0.1, 0.2]);
    expect(withSpanSpy).not.toHaveBeenCalled();
  });

  it('withGraphNodeSpan creates a node span when tracing is enabled', async () => {
    jest.spyOn(mlflowTracing, 'isMlflowTracingEnabled').mockReturnValue(true);
    const withSpanSpy = jest
      .spyOn(mlflowCore, 'withSpan')
      .mockImplementation((fn) => fn({ setOutputs: jest.fn() }) as never);

    const result = await withGraphNodeSpan(
      'form_generation',
      'runStrategy',
      { promptLength: 12 },
      async () => 'ok',
    );

    expect(result).toBe('ok');
    expect(withSpanSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        name: 'formulai.graph.form_generation.node.runStrategy',
        spanType: mlflowCore.SpanType.CHAIN,
      }),
    );
  });

  it('recordDlqFailureToMlflow records an error trace', async () => {
    jest.spyOn(mlflowTracing, 'isMlflowTracingEnabled').mockReturnValue(true);
    const setStatus = jest.fn();
    const setOutputs = jest.fn();
    const withSpanSpy = jest
      .spyOn(mlflowCore, 'withSpan')
      .mockImplementation((fn) =>
        fn({
          setOutputs,
          setStatus,
          setAttribute: jest.fn(),
        }) as never,
      );
    jest.spyOn(mlflowTracing, 'flushMlflowTraces').mockResolvedValue();

    await recordDlqFailureToMlflow({
      originalQueue: 'analytics-orchestration',
      jobName: 'orchestrate-analytics',
      jobId: 'job-1',
      taskId: 'task-1',
      formId: 'form-1',
      payload: { responseIds: ['a', 'b'] },
      failedReason: 'boom',
      attemptsMade: 3,
      maxAttempts: 3,
      failedAt: Date.now(),
      stacktrace: ['trace line'],
    });

    expect(withSpanSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ name: 'formulai.dlq.failed_job' }),
    );
    expect(setStatus).toHaveBeenCalledWith(
      mlflowCore.SpanStatusCode.ERROR,
      'boom',
    );
    expect(setOutputs).toHaveBeenCalledWith(
      expect.objectContaining({ failedReason: 'boom' }),
    );
  });
});
