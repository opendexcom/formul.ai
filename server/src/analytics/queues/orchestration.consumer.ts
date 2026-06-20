import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { QueueName } from './queue.names';
import type {
  OrchestrationJobData,
  ResponseProcessingJobData,
  TopicClusteringJobData,
  AggregationJobData,
  AIGenerationJobData,
} from './queue.names';
import { ProgressService } from './progress.service';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Response } from '../../schemas/response.schema';
import type { ResponseDocument } from '../../schemas/response.schema';
import { Form } from '../../schemas/form.schema';
import type { FormDocument } from '../../schemas/form.schema';
import { DeadLetterService } from './dead-letter.service';
import { TopicVectorStore } from '../stores/topic-vector.store';
import { ResponseProcessor } from '../processors/response.processor';
import { SpanType, withSpan } from '@mlflow/core';
import {
  runWithMlflowTraceContextAsync,
  buildWorkerTraceContext,
  applyMlflowTraceMetadata,
  withOrchestrationStageSpan,
} from '../../mlflow/mlflow-trace-context';
import { flushMlflowTraces } from '../../mlflow/mlflow-langchain-tracing';

@Processor(QueueName.ORCHESTRATION)
export class OrchestrationConsumer {
  private readonly RESPONSE_BATCH_SIZE = parseInt(
    process.env.ANALYTICS_BATCH_SIZE ?? '50',
    10,
  );

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
    private readonly topicVectorStore: TopicVectorStore,
    private readonly responseProcessor: ResponseProcessor,
    @InjectModel(Response.name)
    private responseModel: Model<ResponseDocument>,
    @InjectModel(Form.name) 
    private formModel: Model<FormDocument>,
  ) {}

  @Process('orchestrate-analytics')
  async handleOrchestration(job: Job<OrchestrationJobData>) {
    const { taskId, formId, forceRefresh = false, userId: jobUserId } = job.data;
    const userId = await this.resolveTraceUserId(formId, jobUserId);
    const traceCtx = buildWorkerTraceContext({
      sessionId: taskId,
      userId,
      tags: { worker: 'orchestration', formId, taskId },
    });

    return runWithMlflowTraceContextAsync(traceCtx, async () =>
      withSpan(
        async () => {
          applyMlflowTraceMetadata(traceCtx);
          try {
            return await this.handleOrchestrationInner(
              taskId,
              formId,
              forceRefresh,
              userId,
            );
          } finally {
            await flushMlflowTraces();
          }
        },
        {
          name: 'formulai.orchestration.analytics',
          spanType: SpanType.CHAIN,
          inputs: { taskId, formId, forceRefresh, userId },
        },
      ),
    );
  }

  private async handleOrchestrationInner(
    taskId: string,
    formId: string,
    forceRefresh: boolean,
    userId?: string,
  ) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Starting analytics pipeline...',
      progress: 0,
    });
    try {
      await withOrchestrationStageSpan(
        'response_processing',
        { taskId, formId, forceRefresh },
        () => this.stageResponseProcessing(taskId, formId, forceRefresh, userId),
      );
      await withOrchestrationStageSpan(
        'topic_clustering',
        { taskId, formId },
        () => this.stageTopicClustering(taskId, formId, userId),
      );
      await withOrchestrationStageSpan(
        'aggregation',
        { taskId, formId },
        () => this.stageAggregation(taskId, formId, userId),
      );
      await withOrchestrationStageSpan(
        'ai_generation',
        { taskId, formId },
        () => this.stageAIGeneration(taskId, formId, userId),
      );
      await withOrchestrationStageSpan(
        'save_results',
        { taskId, formId },
        () => this.stageSaveResults(taskId, formId),
      );
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

  private async resolveTraceUserId(
    formId: string,
    userId?: string,
  ): Promise<string | undefined> {
    if (userId) return userId;
    const form = await this.formModel
      .findById(formId)
      .select('createdBy')
      .lean()
      .exec();
    return form?.createdBy?.toString();
  }

  private async stageResponseProcessing(
    taskId: string,
    formId: string,
    forceRefresh: boolean,
    userId?: string,
  ) {
    console.log(`[Orchestrator][${taskId}] Starting response processing stage (forceRefresh: ${forceRefresh})`);
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Preparing response processing jobs...',
      progress: 2,
    });
    
    const formObjectId = new Types.ObjectId(formId);
    const matchQuery: Record<string, unknown> = {
      formId: formObjectId,
      ...(forceRefresh ? {} : { 'metadata.processedForAnalytics': { $ne: true } }),
    };

    const responseCount = await this.responseModel.countDocuments(matchQuery).exec();

    console.log(`[Orchestrator][${taskId}] Found ${responseCount} responses to process`);

    if (responseCount === 0) {
      console.log(`[Orchestrator][${taskId}] No responses to process, skipping response processing stage`);
      return;
    }

    if (forceRefresh) {
      await this.topicVectorStore.clearForm(formId);
    }

    // Reset and mark all matched responses as pending (no full-document load)
    await this.responseModel.updateMany(matchQuery, {
      $unset: { 'metadata.processingTaskId': '' },
      $set: { 'metadata.processedForAnalytics': false },
    }).exec();

    await this.responseModel.updateMany(matchQuery, {
      $set: {
        'metadata.processingTaskId': taskId,
        'metadata.processingStartedAt': new Date(),
      },
    }).exec();

    await this.progressService.publishProgress({
      taskId,
      type: 'responses_processing',
      message: `Processing ${responseCount} responses...`,
      progress: 3,
      processedResponseIds: [],
    });

    const estimatedTotalBatches = Math.ceil(responseCount / this.RESPONSE_BATCH_SIZE);
    const batchJobs: Job[] = [];
    let batchIndex = 0;
    let currentBatch: string[] = [];

    const cursor = this.responseModel
      .find(matchQuery)
      .select('_id')
      .lean()
      .cursor();

    for await (const doc of cursor) {
      currentBatch.push(String((doc as { _id: Types.ObjectId })._id));
      if (currentBatch.length >= this.RESPONSE_BATCH_SIZE) {
        console.log(`[Orchestrator][${taskId}] Adding batch ${batchIndex} with ${currentBatch.length} response IDs`);
        const job = await this.responseProcessingQueue.add('process-batch', {
          taskId,
          formId,
          userId,
          responseIds: [...currentBatch],
          batchIndex,
          totalBatches: estimatedTotalBatches,
        });
        batchJobs.push(job);
        batchIndex += 1;
        currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
      console.log(`[Orchestrator][${taskId}] Adding batch ${batchIndex} with ${currentBatch.length} response IDs`);
      const job = await this.responseProcessingQueue.add('process-batch', {
        taskId,
        formId,
        userId,
        responseIds: currentBatch,
        batchIndex,
        totalBatches: estimatedTotalBatches,
      });
      batchJobs.push(job);
    }

    console.log(`[Orchestrator][${taskId}] All ${batchJobs.length} batch jobs queued, waiting for completion...`);
    
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

    await this.responseProcessor.clearStrandedClaims(
      taskId,
      new Types.ObjectId(formId),
    );
  }

  private async stageTopicClustering(
    taskId: string,
    formId: string,
    userId?: string,
  ) {
    console.log(`[Orchestrator][${taskId}] Starting topic clustering stage`);
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Clustering topics...',
      progress: 45,
    });
    const job = await this.topicClusteringQueue.add('cluster-topics', {
      taskId,
      formId,
      userId,
    });
    console.log(`[Orchestrator][${taskId}] Topic clustering job added to queue, waiting...`);
    await this.waitForJobs([job], taskId, 45, 55, { label: 'Topic clustering', unit: 'task' });
    console.log(`[Orchestrator][${taskId}] Topic clustering stage completed`);
  }

  private async stageAggregation(
    taskId: string,
    formId: string,
    userId?: string,
  ) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Calculating statistics and correlations...',
      progress: 55,
    });
    const job = await this.aggregationQueue.add('aggregate-analytics', {
      taskId,
      formId,
      userId,
    });
    await this.waitForJobs([job], taskId, 55, 75, { label: 'Analytics aggregation', unit: 'task' });
  }

  private async stageAIGeneration(
    taskId: string,
    formId: string,
    userId?: string,
  ) {
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Generating AI insights...',
      progress: 75,
    });
    
    // AI generation jobs now load data directly from form.analytics
    // No need to pass inputData - they fetch from MongoDB
    const jobs = await Promise.all([
      this.aiGenerationQueue.add('generate-insights', {
        taskId,
        formId,
        userId,
        generationType: 'insights',
        inputData: {},
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
