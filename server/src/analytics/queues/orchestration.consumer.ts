import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { QueueName } from './queue.names';
import type { OrchestrationJobData, ResponseProcessingJobData, TopicClusteringJobData, AggregationJobData, AIGenerationJobData } from './queue.names';
import { ProgressService } from './progress.service';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Response } from '../../schemas/response.schema';
import type { ResponseDocument } from '../../schemas/response.schema';
import { Form } from '../../schemas/form.schema';
import type { FormDocument } from '../../schemas/form.schema';
import { DeadLetterService } from './dead-letter.service';

@Processor(QueueName.ORCHESTRATION)
export class OrchestrationConsumer {
  private readonly RESPONSE_BATCH_SIZE = 10; // Process 20 responses per worker job

  constructor(
    @InjectQueue(QueueName.RESPONSE_PROCESSING)
    private responseProcessingQueue: Queue<ResponseProcessingJobData>,
    @InjectQueue(QueueName.TOPIC_CLUSTERING)
    private topicClusteringQueue: Queue<TopicClusteringJobData>,
    @InjectQueue(QueueName.AGGREGATION)
    private aggregationQueue: Queue<AggregationJobData>,
    @InjectQueue(QueueName.AI_GENERATION)
    private aiGenerationQueue: Queue<AIGenerationJobData>,
    private readonly progressService: ProgressService,
  private readonly deadLetterService: DeadLetterService,
    @InjectModel(Response.name) 
    private responseModel: Model<ResponseDocument>,
    @InjectModel(Form.name) 
    private formModel: Model<FormDocument>,
  ) {}

  @Process('orchestrate-analytics')
  async handleOrchestration(job: Job<OrchestrationJobData>) {
    const { taskId, formId, forceRefresh = false } = job.data;
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Starting analytics pipeline...',
      progress: 0,
    });
    try {
      await this.stageResponseProcessing(taskId, formId, forceRefresh);
      await this.stageTopicClustering(taskId, formId);
      await this.stageAggregation(taskId, formId);
      await this.stageAIGeneration(taskId, formId);
      await this.stageSaveResults(taskId, formId);
      await this.progressService.publishProgress({
        taskId,
        type: 'complete',
        message: 'Analytics generation completed successfully',
        progress: 100,
      });
      return { success: true, taskId, formId };
    } catch (error: any) {
      await this.progressService.publishProgress({
        taskId,
        type: 'error',
        message: `Pipeline failed: ${error?.message ?? 'Unknown error'}`,
        progress: 0,
      });
      throw error;
    }
  }

  private async stageResponseProcessing(taskId: string, formId: string, forceRefresh: boolean) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Preparing response processing jobs...',
      progress: 2,
    });
    
    const responses = await this.responseModel.find({
      formId: new Types.ObjectId(formId),
      ...(forceRefresh ? {} : { 'metadata.processedForAnalytics': { $ne: true } }),
    }).exec();
    
    if (!responses || responses.length === 0) return;
    
    const responseIds = responses.map(r => (typeof r._id === 'string' ? r._id : r._id?.toString?.() ?? ''));
    
    // Reset all responses to "Not started" state (clear processingTaskId and processedForAnalytics)
    await this.responseModel.updateMany(
      { _id: { $in: responseIds.map(id => new Types.ObjectId(id)) } },
      { 
        $unset: { 'metadata.processingTaskId': '' },
        $set: { 'metadata.processedForAnalytics': false }
      }
    ).exec();
    
    // Notify frontend: responses claimed (reset to "Not started")
    await this.progressService.publishProgress({
      taskId,
      type: 'responses_claimed',
      message: `Claimed ${responseIds.length} responses for processing`,
      progress: 3,
      processedResponseIds: responseIds,
    });
    
    const batches = this.chunkArray(responseIds, this.RESPONSE_BATCH_SIZE);
    const batchJobs = await Promise.all(
      batches.map((batch, index) =>
        this.responseProcessingQueue.add('process-batch', {
          taskId,
          formId,
          responseIds: batch,
          batchIndex: index,
          totalBatches: batches.length,
        })
      )
    );
    // Wait for ALL response-analysis batches to finish before moving on
    await this.waitForJobs(batchJobs, taskId, 5, 45, { label: 'Response analysis', unit: 'batches' });

    // Safety check: ensure no responses remain unprocessed before proceeding
    const remainingUnprocessed = await this.responseModel.countDocuments({
      formId: new Types.ObjectId(formId),
      'metadata.processedForAnalytics': { $ne: true }
    }).exec();
    if (remainingUnprocessed > 0) {
      await this.progressService.publishProgress({
        taskId,
        type: 'progress',
        message: `Waiting for remaining analyses to finish (${remainingUnprocessed} pending)...`,
        progress: 45,
      });
    }
    // Poll up to 10 times (5s total) in case of slight delays
    let attempts = 0;
    while (attempts < 10) {
      const pending = await this.responseModel.countDocuments({
        formId: new Types.ObjectId(formId),
        'metadata.processedForAnalytics': { $ne: true }
      }).exec();
      if (pending === 0) break;
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }
  }

  private async stageTopicClustering(taskId: string, formId: string) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Clustering topics...',
      progress: 45,
    });
    const job = await this.topicClusteringQueue.add('cluster-topics', { taskId, formId });
    await this.waitForJobs([job], taskId, 45, 55, { label: 'Topic clustering', unit: 'task' });
  }

  private async stageAggregation(taskId: string, formId: string) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Calculating statistics and correlations...',
      progress: 55,
    });
    const job = await this.aggregationQueue.add('aggregate-analytics', { taskId, formId });
    await this.waitForJobs([job], taskId, 55, 75, { label: 'Analytics aggregation', unit: 'task' });
  }

  private async stageAIGeneration(taskId: string, formId: string) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Generating AI insights...',
      progress: 75,
    });
    
    // AI generation jobs now load data directly from form.analytics
    // No need to pass inputData - they fetch from MongoDB
    const jobs = await Promise.all([
      this.aiGenerationQueue.add('generate-summary', {
        taskId,
        formId,
        generationType: 'summary',
        inputData: {}, // Empty - consumer loads from DB
      }),
      this.aiGenerationQueue.add('generate-findings', {
        taskId,
        formId,
        generationType: 'findings',
        inputData: {}, // Empty - consumer loads from DB
      }),
      this.aiGenerationQueue.add('generate-recommendations', {
        taskId,
        formId,
        generationType: 'recommendations',
        inputData: {}, // Empty - consumer loads from DB
      }),
    ]);
    await this.waitForJobs(jobs, taskId, 75, 95, { label: 'AI insights generation', unit: 'items' });
  }

  private async stageSaveResults(taskId: string, formId: string) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Saving final results...',
      progress: 95,
    });
    const form = await this.formModel.findById(formId).exec();
    if (form && form.analytics) {
      form.analytics.lastUpdated = new Date();
      await form.save();
    }
  }

  private async waitForJobs(
    jobs: Job[],
    taskId: string,
    startProgress: number,
    endProgress: number,
    options?: { label?: string; unit?: 'batches' | 'tasks' | 'items' | 'job' | 'task' }
  ): Promise<void> {
    const total = jobs.length;
    let completed = 0;
    await Promise.all(
      jobs.map(async (job) => {
        await job.finished();
        completed++;
        const progress = startProgress + ((completed / total) * (endProgress - startProgress));
        const label = options?.label ?? 'Analytics progress';
        const unit = options?.unit ?? (total === 1 ? 'task' : 'tasks');
        await this.progressService.publishProgress({
          taskId,
          type: 'progress',
          message: `${label}: ${completed}/${total} ${unit} completed`,
          progress: Math.round(progress),
        });
      })
    );
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  @OnQueueActive()
  onActive(job: Job<OrchestrationJobData>) {
    console.log(`[Orchestrator] Job ${job.id} started`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<OrchestrationJobData>, result: any) {
    console.log(`[Orchestrator] Job ${job.id} completed:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job<OrchestrationJobData>, error: Error) {
    console.error(`[Orchestrator] Job ${job.id} failed:`, error.message);
    // Forward to DLQ if attempts exhausted
    this.deadLetterService.forwardWhenExhausted(QueueName.ORCHESTRATION, job, error);
  }
}
