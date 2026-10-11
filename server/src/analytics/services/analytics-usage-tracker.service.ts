import { Injectable, Logger } from '@nestjs/common';
import { LlmUsage } from '../../ai/llm.types';
import {
  accumulateLlmUsage,
  createEmptyLlmUsage,
} from '../../mlflow/mlflow-trace-context';

export interface AnalyticsUsageCompletionContext {
  taskId: string;
  formId: string;
  userId?: string;
  usage: LlmUsage;
}

export type AnalyticsUsageCompletionHandler = (
  ctx: AnalyticsUsageCompletionContext,
) => void | Promise<void>;

/**
 * Accumulates LLM usage across analytics pipeline stages (keyed by taskId).
 * EE plugins register completion handlers to persist billing events.
 */
@Injectable()
export class AnalyticsUsageTrackerService {
  private readonly logger = new Logger(AnalyticsUsageTrackerService.name);
  private readonly accumulators = new Map<string, LlmUsage>();
  private readonly handlers: AnalyticsUsageCompletionHandler[] = [];

  registerCompletionHandler(handler: AnalyticsUsageCompletionHandler): void {
    this.handlers.push(handler);
  }

  recordUsage(taskId: string, usage?: LlmUsage): void {
    if (!taskId || !usage) return;
    const total =
      usage.totalTokens ??
      (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
    if (total <= 0) return;

    let acc = this.accumulators.get(taskId);
    if (!acc) {
      acc = createEmptyLlmUsage(usage.model || 'aggregated');
      this.accumulators.set(taskId, acc);
    }
    accumulateLlmUsage(acc, usage);
  }

  getAndClear(taskId: string): LlmUsage {
    const acc = this.accumulators.get(taskId) ?? createEmptyLlmUsage();
    this.accumulators.delete(taskId);
    return acc;
  }

  async notifyCompletion(ctx: AnalyticsUsageCompletionContext): Promise<void> {
    const total = ctx.usage.totalTokens ?? 0;
    if (total <= 0 || !ctx.userId) return;

    for (const handler of this.handlers) {
      try {
        await handler(ctx);
      } catch (err) {
        this.logger.warn(
          `Analytics usage handler failed for task ${ctx.taskId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
