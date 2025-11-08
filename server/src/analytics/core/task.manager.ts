import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TaskStore } from '../stores/task.store';
import { FormLockStore, LockToken } from '../stores/form-lock.store';
import { AnalyticsTask } from './analytics.types';

/**
 * Task Manager
 * 
 * Orchestrates task lifecycle and coordinates with stores:
 * - Creates and tracks analytics tasks
 * - Acquires/extends/releases form locks (lease-based)
 * - Manages task state transitions (new → pending → running → completed/failed)
 * - Provides task status queries
 * 
 * Design:
 * - Uses TaskStore for persistent task state (MongoDB)
 * - Uses FormLockStore for distributed form locking with TTL
 * - Generates unique instanceId for distributed orchestrator instances
 */
@Injectable()
export class TaskManager implements OnModuleInit {
  private readonly instanceId: string;
  private readonly LOCK_TTL_MS = 60 * 1000; // 60 seconds
  private readonly TASK_RETENTION_MS = 60 * 60 * 1000; // 1 hour for completed/failed tasks

  constructor(
    private readonly taskStore: TaskStore,
    private readonly formLockStore: FormLockStore,
  ) {
    this.instanceId = `orchestrator-${randomUUID()}`;
  }

  onModuleInit() {
    console.log(`[TaskManager] Initialized with instanceId: ${this.instanceId}`);
  }

  /**
   * Get orchestrator instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Create a new analytics task
   */
  async createTask(formId: string): Promise<string> {
    const taskId = randomUUID();
    await this.taskStore.createTask(taskId, formId, this.instanceId);
    console.log(`[TaskManager] Created task ${taskId} for form ${formId}`);
    return taskId;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<AnalyticsTask | null> {
    const task = await this.taskStore.getById(taskId);
    if (!task) return null;

    // Map TaskEntity to AnalyticsTask
    return {
      taskId: task.taskId,
      formId: task.formId,
      status: task.state === 'running' ? 'running' : task.state === 'completed' ? 'completed' : 'failed',
      progress: task.progress,
      message: task.message || '',
      startedAt: task.startedAt || task.createdAt,
      completedAt: task.completedAt,
      error: task.state === 'failed' ? task.message : undefined,
    };
  }

  /**
   * Find existing running task for a form
   */
  async findRunningTaskForForm(formId: string): Promise<AnalyticsTask | null> {
    const task = await this.taskStore.findActiveByForm(formId);
    if (!task) return null;

    return {
      taskId: task.taskId,
      formId: task.formId,
      status: 'running',
      progress: task.progress,
      message: task.message || '',
      startedAt: task.startedAt || task.createdAt,
    };
  }

  /**
   * Acquire form lock (lease-based with TTL)
   * Returns lock token if successful, null if locked by another task
   */
  async acquireFormLock(formId: string, taskId: string): Promise<LockToken | null> {
    console.log(`[TaskManager] Attempting to acquire lock for form ${formId}, task ${taskId}`);
    const lockToken = await this.formLockStore.acquire(formId, taskId, this.instanceId, this.LOCK_TTL_MS);
    
    if (lockToken) {
      console.log(`[TaskManager] Lock acquired for form ${formId}`);
      await this.taskStore.setRunning(taskId);
    } else {
      console.warn(`[TaskManager] Failed to acquire lock for form ${formId} (already locked)`);
    }
    
    return lockToken;
  }

  /**
   * Extend form lock (heartbeat to keep lease alive)
   */
  async extendFormLock(lockToken: LockToken): Promise<LockToken | null> {
    console.log(`[TaskManager] Extending lock for form ${lockToken.formId}`);
    return await this.formLockStore.extend(lockToken.formId, lockToken.taskId, lockToken.ownerId, this.LOCK_TTL_MS);
  }

  /**
   * Release form lock
   */
  async releaseFormLock(lockToken: LockToken): Promise<void> {
    console.log(`[TaskManager] Releasing lock for form ${lockToken.formId}`);
    await this.formLockStore.release(lockToken.formId, lockToken.taskId, lockToken.ownerId);
  }

  /**
   * Set task to pending state
   */
  async setPending(taskId: string): Promise<void> {
    await this.taskStore.setPending(taskId);
  }

  /**
   * Set task to running state
   */
  async setRunning(taskId: string): Promise<void> {
    await this.taskStore.setRunning(taskId);
  }

  /**
   * Update task progress
   */
  async updateProgress(taskId: string, progress: number, message?: string): Promise<void> {
    await this.taskStore.setProgress(taskId, progress, message);
  }

  /**
   * Mark task as completed
   */
  async completeTask(taskId: string, success: boolean = true): Promise<void> {
    if (success) {
      console.log(`[TaskManager] Task ${taskId} completed successfully`);
      await this.taskStore.setCompleted(taskId, this.TASK_RETENTION_MS);
    } else {
      console.log(`[TaskManager] Task ${taskId} failed`);
      await this.taskStore.setFailed(taskId, 'Task failed', this.TASK_RETENTION_MS);
    }
  }

  /**
   * Mark task as failed with error
   */
  async failTask(taskId: string, error: string): Promise<void> {
    console.error(`[TaskManager] Task ${taskId} failed: ${error}`);
    await this.taskStore.setFailed(taskId, error, this.TASK_RETENTION_MS);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    console.log(`[TaskManager] Task ${taskId} cancelled`);
    await this.taskStore.cancel(taskId, this.TASK_RETENTION_MS);
  }
}
