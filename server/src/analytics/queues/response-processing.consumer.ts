import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Types } from 'mongoose';
import { QueueName } from './queue.names';
import type { ResponseProcessingJobData } from './queue.names';
import { ResponseProcessor } from '../processors/response.processor';
import { ProgressService } from './progress.service';
import { DeadLetterService } from './dead-letter.service';
import { InjectModel } from '@nestjs/mongoose';
import { Form } from '../../schemas/form.schema';
import { Response } from '../../schemas/response.schema';
import type { Model } from 'mongoose';
import type { FormDocument } from '../../schemas/form.schema';
import type { ResponseDocument } from '../../schemas/response.schema';

@Processor(QueueName.RESPONSE_PROCESSING)
export class ResponseProcessingConsumer {
  constructor(
    private readonly responseProcessor: ResponseProcessor,
    private readonly progressService: ProgressService,
    private readonly deadLetterService: DeadLetterService,
    @InjectModel(Form.name)
    private readonly formModel: Model<FormDocument>,
    @InjectModel(Response.name)
    private readonly responseModel: Model<ResponseDocument>,
  ) {}

  @Process({ name: 'process-batch', concurrency: 5 })
  async handleBatch(job: Job<ResponseProcessingJobData>) {
    const { taskId, formId, responseIds, batchIndex, totalBatches } = job.data;
    console.log(`[ResponseProcessingConsumer][${taskId}] Starting batch ${batchIndex + 1}/${totalBatches} with ${responseIds.length} responses`);
    
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
  async onFailed(job: Job<ResponseProcessingJobData>, error: Error) {
    const { taskId, formId, responseIds } = job.data;
    // eslint-disable-next-line no-console
    console.error(`[ResponseProcessing] Job ${job.id} failed:`, error.message);
    
    // Clear processingTaskId from responses that were being processed
    // This prevents them from being stuck in "pending" state
    try {
      const result = await this.responseModel.updateMany(
        { 
          _id: { $in: responseIds.map(id => new Types.ObjectId(id)) },
          'metadata.processingTaskId': taskId 
        },
        { 
          $unset: { 'metadata.processingTaskId': '', 'metadata.processingStartedAt': '' } 
        }
      ).exec();
      console.log(`[ResponseProcessing] Cleared processingTaskId from ${result.modifiedCount} responses after failure`);
    } catch (cleanupError) {
      console.error(`[ResponseProcessing] Failed to cleanup responses:`, cleanupError);
    }
    
    this.deadLetterService.forwardWhenExhausted(QueueName.RESPONSE_PROCESSING, job, error);
  }
}
