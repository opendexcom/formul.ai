import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsTaskDocument, AnalyticsTaskEntity } from '../../schemas/analytics-task.schema';

export type TaskState = AnalyticsTaskEntity['state'];

@Injectable()
export class TaskStore {
  constructor(
    @InjectModel('AnalyticsTask') private readonly taskModel: Model<AnalyticsTaskDocument>,
  ) {}

  async createTask(taskId: string, formId: string, ownerId: string): Promise<AnalyticsTaskEntity> {
    return await this.taskModel.create({ taskId, formId, ownerId, state: 'new', progress: 0 });
  }

  async setPending(taskId: string): Promise<void> {
    await this.taskModel.updateOne({ taskId }, { $set: { state: 'pending' } }).exec();
  }

  async setRunning(taskId: string): Promise<void> {
    await this.taskModel.updateOne({ taskId }, { $set: { state: 'running', startedAt: new Date() } }).exec();
  }

  async setProgress(taskId: string, progress: number, message?: string): Promise<void> {
    const update: any = { progress };
    if (message) update.message = message;
    await this.taskModel.updateOne({ taskId }, { $set: update }).exec();
  }

  async setCompleted(taskId: string, retentionMs: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionMs);
    await this.taskModel.updateOne(
      { taskId },
      { $set: { state: 'completed', completedAt: now, expiresAt } }
    ).exec();
  }

  async setFailed(taskId: string, error: string, retentionMs: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionMs);
    await this.taskModel.updateOne(
      { taskId },
      { $set: { state: 'failed', message: error, completedAt: now, expiresAt } }
    ).exec();
  }

  async cancel(taskId: string, retentionMs: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionMs);
    await this.taskModel.updateOne(
      { taskId },
      { $set: { state: 'canceled', completedAt: now, expiresAt } }
    ).exec();
  }

  async findActiveByForm(formId: string): Promise<AnalyticsTaskEntity | null> {
    return this.taskModel
      .findOne({ formId, state: { $in: ['new', 'pending', 'running'] } })
      .sort({ createdAt: -1 })
      .lean<AnalyticsTaskEntity | null>()
      .exec();
  }

  async getById(taskId: string): Promise<AnalyticsTaskEntity | null> {
    return this.taskModel.findOne({ taskId }).lean<AnalyticsTaskEntity | null>().exec();
  }
}
