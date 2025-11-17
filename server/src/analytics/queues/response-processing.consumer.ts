import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { QueueName } from './queue.names';
import type { ResponseProcessingJobData } from './queue.names';
import { ResponseProcessor } from '../processors/response.processor';
import { ProgressService } from './progress.service';
import { DeadLetterService } from './dead-letter.service';
import { InjectModel } from '@nestjs/mongoose';
import { Form } from '../../schemas/form.schema';
import type { Model } from 'mongoose';
import type { FormDocument } from '../../schemas/form.schema';

@Processor(QueueName.RESPONSE_PROCESSING)
export class ResponseProcessingConsumer {
  constructor(
    private readonly responseProcessor: ResponseProcessor,
    private readonly progressService: ProgressService,
    private readonly deadLetterService: DeadLetterService,
    @InjectModel(Form.name)
    private readonly formModel: Model<FormDocument>,
  ) {}

  @Process({ name: 'process-batch', concurrency: 5 })
  async handleBatch(job: Job<ResponseProcessingJobData>) {
    const { taskId, formId, responseIds, batchIndex, totalBatches } = job.data;
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: `Processing batch ${batchIndex + 1}/${totalBatches}`,
      progress: Math.round(((batchIndex + 1) / totalBatches) * 40),
    });
    // Fetch the form document using formId
    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error('Form document not found for response processing');
    }
    await this.responseProcessor.processResponses(
      form,
      taskId,
      (update) => this.progressService.publishProgress({
        taskId,
        type: update.type, // Pass through all event types (progress, responses_processing, responses_processed, etc.)
        message: update.message,
        progress: update.progress,
        stats: update.stats,
        processedResponseIds: update.processedResponseIds,
      }),
      responseIds
    );
    job.progress(100);
    return { success: true, batchIndex, processedCount: responseIds.length };
  }

  @OnQueueFailed()
  onFailed(job: Job<ResponseProcessingJobData>, error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[ResponseProcessing] Job ${job.id} failed:`, error.message);
    this.deadLetterService.forwardWhenExhausted(QueueName.RESPONSE_PROCESSING, job, error);
  }
}
