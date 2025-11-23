import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response, ResponseDocument } from '../schemas/response.schema';
import { Form, FormDocument } from '../schemas/form.schema';
import { AnalyticsOrchestrator } from '../analytics/core/analytics.orchestrator';
import { TaskManager } from '../analytics/core/task.manager';
import { randomUUID } from 'crypto';
import { OrchestrationProducer } from '../analytics/queues/orchestration.producer';
import { ProgressService } from '../analytics/queues/progress.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QueueName } from '../analytics/queues/queue.names';

export interface AnalyticsTask {
  taskId: string;
  formId: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
    private analyticsOrchestrator: AnalyticsOrchestrator,
    private taskManager: TaskManager,
    private readonly orchestrationProducer: OrchestrationProducer,
    private readonly progressService: ProgressService,
    @InjectQueue(QueueName.ORCHESTRATION) private orchestrationQueue: Queue,
  ) { }

  private getTaskKey(taskId: string): string {
    return `analytics:task:${taskId}`;
  }

  private async saveTaskState(task: AnalyticsTask): Promise<void> {
    await this.orchestrationQueue.client.set(
      this.getTaskKey(task.taskId),
      JSON.stringify(task),
      'EX',
      3600 // 1 hour expiration
    );
  }

  private async getTaskState(taskId: string): Promise<AnalyticsTask | null> {
    const data = await this.orchestrationQueue.client.get(this.getTaskKey(taskId));
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get or create analytics task for a form
   * Creates a NEW task every time to allow parallel processing
   */
  /**
   * Get or create analytics task for a form
   * Creates a NEW task every time to allow parallel processing
   */
  async getOrCreateAnalyticsTask(formId: string, forceNew: boolean = false): Promise<{ taskId: string; existing: boolean; task?: AnalyticsTask }> {
    // Always create a new task for parallel processing
    const taskId = randomUUID();
    const task: AnalyticsTask = {
      taskId,
      formId,
      status: 'running',
      progress: 0,
      message: 'Initializing...',
      startedAt: new Date(),
    };

    await this.saveTaskState(task);

    return {
      taskId,
      existing: false,
      task,
    };
  }

  /**
   * Get task status
   */
  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<AnalyticsTask | null> {
    return this.getTaskState(taskId);
  }

  /**
   * Update task progress
   */
  /**
   * Update task progress
   */
  private async updateTaskProgress(taskId: string, progress: number, message: string): Promise<void> {
    const task = await this.getTaskState(taskId);
    if (task) {
      task.progress = progress;
      task.message = message;
      await this.saveTaskState(task);
    }
  }

  /**
   * Complete task
   */
  private async completeTask(taskId: string, success: boolean, error?: string): Promise<void> {
    const task = await this.getTaskState(taskId);
    if (task) {
      task.status = success ? 'completed' : 'failed';
      task.completedAt = new Date();
      task.progress = success ? 100 : task.progress;
      if (error) {
        task.error = error;
      }
      await this.saveTaskState(task);
    }
  }

  /**
   * Get form analytics (cached version)
   */
  async getFormAnalytics(formId: string): Promise<any> {
    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error('Form not found');
    }

    const totalResponses = await this.responseModel.countDocuments({
      formId: new Types.ObjectId(formId)
    }).exec();

    return {
      formId,
      analytics: form.analytics,
      meta: {
        lastUpdated: form.analytics?.lastUpdated,
        responsesAnalyzed: form.analytics?.totalResponsesAnalyzed,
        totalResponses,
        cacheHit: true,
      },
    };
  }

  /**
   * Get form analytics with progress updates via callback
   * Delegates all analytics generation to AnalyticsOrchestrator
   */
  async getFormAnalyticsWithProgress(
    formId: string,
    forceRefresh: boolean = false,
    progressCallback: (update: any) => void,
    taskId?: string
  ): Promise<any> {
    if (!taskId) {
      throw new Error('taskId is required for analytics generation');
    }

    console.log(`[Analytics][${taskId}] Starting analytics generation for form: ${formId}`);

    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error('Form not found');
    }

    const totalResponses = await this.responseModel.countDocuments({
      formId: new Types.ObjectId(formId)
    }).exec();

    console.log(`[Analytics][${taskId}] Total responses found: ${totalResponses}`);

    if (totalResponses < 10) {
      throw new Error('At least 10 responses required to generate analytics');
    }

    // Update task in Redis for backward compatibility
    await this.updateTaskProgress(taskId, 0, 'Starting analytics generation...');
    progressCallback({
      type: 'start',
      message: 'Starting analytics generation...',
      progress: 0,
      taskId
    });

    try {
      // Queue-based orchestration via Redis/Bull
      const startTime = Date.now();

      await this.orchestrationProducer.enqueueOrchestration(formId, taskId, forceRefresh);

      // Subscribe and wait until completion for controller compatibility
      const result = await new Promise<any>((resolve, reject) => {
        const onUpdate = (update: any) => {
          if (update.taskId !== taskId) return; // filter other tasks
          // Update task progress in Redis
          if (update.type === 'progress' || update.type === 'start') {
            this.updateTaskProgress(taskId, update.progress ?? 0, update.message ?? '');
          }
          // Forward to SSE callback
          progressCallback({ ...update, taskId });

          if (update.type === 'complete') {
            const processingTime = Date.now() - startTime;
            this.updateTaskProgress(taskId, 100, 'Analytics generation complete!');
            this.completeTask(taskId, true);
            this.progressService.onProgress(() => { }); // no-op to keep subscriber active
            resolve({ processingTime });
          } else if (update.type === 'error') {
            this.completeTask(taskId, false, update.message);
            reject(new Error(update.message || 'Analytics generation failed'));
          }
        };
        this.progressService.onProgress(onUpdate);
      });

      // Refresh form to get updated analytics
      const updatedForm = await this.formModel.findById(formId).exec();

      return {
        formId,
        taskId,
        analytics: updatedForm?.analytics,
        meta: {
          lastUpdated: updatedForm?.analytics?.lastUpdated,
          responsesAnalyzed: updatedForm?.analytics?.totalResponsesAnalyzed,
          totalResponses,
          cacheHit: false,
          processingTime: `${result.processingTime}ms`,
        },
      };
    } catch (error) {
      console.error(`[Analytics][${taskId}] Error during generation:`, error);
      await this.completeTask(taskId, false, error.message);
      throw error;
    }
  }

  /**
   * Reprocess a single response to regenerate its analytics metadata
   */
  async reprocessSingleResponse(formId: string, responseId: string): Promise<any> {
    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error('Form not found');
    }

    const response = await this.responseModel.findOne({
      _id: new Types.ObjectId(responseId),
      formId: new Types.ObjectId(formId),
    }).exec();

    if (!response) {
      throw new Error('Response not found');
    }

    if (!response.metadata.hasTextContent) {
      return {
        success: false,
        message: 'Response has no text content to analyze',
        responseId,
      };
    }

    // Reset metadata to mark for reprocessing
    response.metadata.processedForAnalytics = false;
    response.metadata.topics = undefined;
    response.metadata.sentiment = undefined;
    response.metadata.discourse = undefined;
    response.metadata.quotes = undefined;
    response.metadata.extractedKeywords = [];
    await response.save();

    return {
      success: true,
      message: 'Response marked for reprocessing. Run analytics generation to reprocess.',
      responseId,
    };
  }

  /**
   * Reprocess all responses to regenerate their analytics metadata
   */
  async reprocessAllResponses(formId: string, onlyFailed: boolean = false): Promise<any> {
    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error('Form not found');
    }

    const query: any = {
      formId: new Types.ObjectId(formId),
    };

    if (onlyFailed) {
      // Only reprocess responses that were never processed or failed
      query['metadata.processedForAnalytics'] = { $ne: true };
    }

    const responses = await this.responseModel.find(query).exec();

    if (responses.length === 0) {
      return {
        success: true,
        message: 'No responses to reprocess',
        totalReprocessed: 0,
      };
    }

    // Filter to only responses that have text content
    const responsesWithText = responses.filter(response => {
      return response.answers.some(answer =>
        answer.value && typeof answer.value === 'string' && answer.value.trim().length > 0
      );
    });

    if (responsesWithText.length === 0) {
      return {
        success: true,
        message: 'No responses with text content to reprocess',
        totalReprocessed: 0,
      };
    }

    console.log(`[Analytics] Marking ${responsesWithText.length} responses for reprocessing...`);

    // Reset metadata flags - actual processing happens during analytics generation
    const result = await this.responseModel.updateMany(
      { formId: new Types.ObjectId(formId) },
      {
        $set: {
          'metadata.processedForAnalytics': false,
          'metadata.hasTextContent': true // Keep this if already calculated
        },
        $unset: {
          'metadata.topics': '',
          'metadata.sentiment': '',
          'metadata.discourse': '',
          'metadata.quotes': '',
          'metadata.extractedKeywords': '',
          'metadata.processingTaskId': '',
          'metadata.processingStartedAt': ''
        }
      }
    ).exec();

    console.log(`[Analytics] Marked ${result.modifiedCount} responses for reprocessing`);

    return {
      success: true,
      message: `Marked ${result.modifiedCount} responses for reprocessing. Run analytics generation to reprocess.`,
      totalReprocessed: result.modifiedCount,
    };
  }
}
