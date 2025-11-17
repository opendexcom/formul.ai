import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { QueueName } from './queue.names';
import type { OrchestrationJobData } from './queue.names';

@Injectable()
export class OrchestrationProducer {
  constructor(
    @InjectQueue(QueueName.ORCHESTRATION)
    private orchestrationQueue: Queue<OrchestrationJobData>,
  ) {}

  /**
   * Enqueue main orchestration job (triggered by user request)
   */
  async enqueueOrchestration(
    formId: string,
    taskId: string,
    forceRefresh = false,
  ): Promise<Job<OrchestrationJobData>> {
    return await this.orchestrationQueue.add(
      'orchestrate-analytics',
      {
        taskId,
        formId,
        forceRefresh,
      },
      {
        jobId: taskId, // Use taskId as jobId for easy lookup
        priority: forceRefresh ? 1 : 10,
        removeOnComplete: 100,
        removeOnFail: false,
        timeout: 600000, // 10 minutes max
      },
    );
  }

  async getJob(jobId: string): Promise<Job<OrchestrationJobData> | null> {
    return await this.orchestrationQueue.getJob(jobId);
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) await job.remove();
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) await job.retry();
  }
}
