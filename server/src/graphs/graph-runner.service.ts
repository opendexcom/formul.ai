import { Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { SpanType, withSpan } from '@mlflow/core';
import type { GenerateAIFormDto } from '../ai/dto/generate-ai-form.dto';
import type { GenerationStep } from '../ai/ai.service';
import { AiService } from '../ai/ai.service';
import { GuardianService } from '../ai/guardian.service';
import type { LlmUsage } from '../ai/llm.types';
import {
  runWithMlflowTraceContextAsync,
  getMlflowTraceContext,
  applyMlflowTraceMetadata,
  accumulateLlmUsage,
  applyTokenUsageToSpan,
  createEmptyLlmUsage,
} from '../mlflow/mlflow-trace-context';
import { flushMlflowTraces } from '../mlflow/mlflow-langchain-tracing';
import {
  buildFormGenerationGraph,
  type CompiledFormGenerationGraph,
} from './form-generation/form-generation.graph';
import { buildFormGenerationHints } from './form-generation/form-generation.helpers';
import type { GraphRunOptions, GraphStepEvent } from './types/graph-events';

@Injectable()
export class GraphRunnerService {
  private formGenerationGraph: CompiledFormGenerationGraph | null = null;

  constructor(
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly guardianService: GuardianService,
  ) {}

  private getFormGenerationGraph(): CompiledFormGenerationGraph {
    if (!this.formGenerationGraph) {
      this.formGenerationGraph = buildFormGenerationGraph({
        aiService: this.aiService,
        guardianService: this.guardianService,
      });
    }
    return this.formGenerationGraph;
  }

  private resolveTraceContext(
    graphId: string,
    options: GraphRunOptions = {},
  ) {
    const inherited = getMlflowTraceContext();
    return {
      sessionId: options.sessionId ?? inherited?.sessionId,
      user: options.userId ?? inherited?.user,
      tags: {
        graph: graphId,
        ...inherited?.tags,
        ...options.tags,
        ...(options.formId ? { formId: options.formId } : {}),
        ...(options.sessionId ? { taskId: options.sessionId } : {}),
        ...(options.userId ? { userId: options.userId } : {}),
      },
    };
  }

  private async runWithGraphTrace<T>(
    graphId: string,
    inputs: Record<string, unknown>,
    options: GraphRunOptions,
    fn: (usageAcc: LlmUsage) => Promise<T>,
  ): Promise<T> {
    const ctx = this.resolveTraceContext(graphId, options);
    const usageAcc = createEmptyLlmUsage();
    return runWithMlflowTraceContextAsync(ctx, async () =>
      withSpan(
        async (span) => {
          applyMlflowTraceMetadata(ctx);
          const result = await fn(usageAcc);
          applyTokenUsageToSpan(span, usageAcc);
          return result;
        },
        {
          name: `formulai.graph.${graphId}`,
          spanType: SpanType.CHAIN,
          inputs,
        },
      ),
    );
  }

  async *streamFormGeneration(
    dto: GenerateAIFormDto,
    options: GraphRunOptions = {},
  ): AsyncGenerator<GenerationStep> {
    if (!(this.aiService as unknown as { chatModel?: unknown }).chatModel) {
      throw new InternalServerErrorException(
        'AI provider is not configured. Check your environment variables.',
      );
    }

    const graph = this.getFormGenerationGraph();
    const hints = buildFormGenerationHints(dto);
    const userId = (dto as GenerateAIFormDto & { userId?: string }).userId;
    const stepQueue: GraphStepEvent[] = [];
    let streamDone = false;
    let streamError: unknown = null;
    let notify: (() => void) | null = null;

    const waitForStep = () =>
      new Promise<void>((resolve) => {
        notify = resolve;
      });

    const onStep = (step: GraphStepEvent) => {
      stepQueue.push(step);
      notify?.();
      notify = null;
    };

    const initialState = {
      prompt: dto.prompt,
      userId,
      hints,
      steps: [] as GraphStepEvent[],
    };

    const runPromise = this.runWithGraphTrace(
      'form_generation',
      { prompt: dto.prompt, mode: dto.mode ?? 'generate' },
      { ...options, userId },
      async (usageAcc) => {
        const onStepWithUsage = (step: GraphStepEvent) => {
          accumulateLlmUsage(usageAcc, step.usage);
          onStep(step);
        };
        const stream = await graph.stream(initialState, {
          streamMode: 'updates',
          configurable: { onStep: onStepWithUsage },
        });
        for await (const _update of stream) {
          // steps emitted via onStep
        }
      },
    )
      .catch((err) => {
        streamError = err;
      })
      .finally(async () => {
        streamDone = true;
        notify?.();
        await flushMlflowTraces();
      });

    while (!streamDone || stepQueue.length > 0) {
      if (stepQueue.length === 0) {
        if (streamDone) break;
        await waitForStep();
        continue;
      }
      yield stepQueue.shift()! as GenerationStep;
    }

    await runPromise;
    if (streamError) {
      throw streamError;
    }
  }
}
