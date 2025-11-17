import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { QueueName } from './queue.names';
import type { DeadLetterJobData } from './queue.names';

@Processor(QueueName.DEAD_LETTER)
export class DeadLetterConsumer {
  @Process('failed-job')
  async handleFailed(job: Job<DeadLetterJobData>) {
    const data = job.data;
    // For now we only log; in the future this can persist to Mongo for audit/alerts
    // eslint-disable-next-line no-console
    console.error(
      `[DLQ] from=${data.originalQueue} name=${data.jobName} jobId=${data.jobId} attempts=${data.attemptsMade}/${data.maxAttempts} reason=${data.failedReason}`,
    );
    return { acknowledged: true };
  }
}
