import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { QueueName } from './queue.names';
import type { DeadLetterJobData } from './queue.names';

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    @InjectQueue(QueueName.DEAD_LETTER)
    private readonly dlq: Queue<DeadLetterJobData>,
  ) {}

  /**
   * Forward a failed job to the DLQ when retries are exhausted.
   */
  async forwardWhenExhausted<T = any>(
    originalQueue: QueueName,
    job: Job<T> & { data: any },
    error: Error,
  ): Promise<void> {
    const maxAttempts = job.opts?.attempts ?? 0;
    const exhausted = maxAttempts > 0 && job.attemptsMade >= maxAttempts;
    if (!exhausted) return;

    const payload: DeadLetterJobData = {
      originalQueue,
      jobName: job.name,
      jobId: job.id,
      taskId: (job.data && job.data.taskId) || undefined,
      formId: (job.data && job.data.formId) || undefined,
      payload: job.data,
      failedReason: (error && error.message) || 'Unknown error',
      attemptsMade: job.attemptsMade,
      maxAttempts,
      stacktrace: job.stacktrace,
      failedAt: Date.now(),
    };

    try {
      await this.dlq.add('failed-job', payload, {
        removeOnComplete: false,
        removeOnFail: false,
      });
    } catch (e: any) {
      this.logger.error(`Failed to enqueue DLQ item for job ${job.id}: ${e?.message}`);
    }
  }
}
