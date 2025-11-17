import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FormLock, FormLockDocument } from '../../schemas/form-lock.schema';

export interface LockToken {
  formId: string;
  taskId: string;
  ownerId: string;
  expiresAt: Date;
}

@Injectable()
export class FormLockStore {
  constructor(
    @InjectModel('FormLock') private readonly formLockModel: Model<FormLockDocument>,
  ) {}

  /**
   * Try to acquire a lease for a form. Returns the lock token if successful, else null.
   */
  async acquire(formId: string, taskId: string, ownerId: string, ttlMs: number): Promise<LockToken | null> {
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs);
    try {
      // Attempt to insert a new lock (unique on formId). If exists, try to "steal" only if expired.
      const inserted = await this.formLockModel.create({ formId, taskId, ownerId, expiresAt });
      return { formId, taskId, ownerId, expiresAt };
    } catch (e: any) {
      // Existing lock: try conditional update if expired
      const res = await this.formLockModel.findOneAndUpdate(
        { formId, expiresAt: { $lte: new Date(now) } },
        { taskId, ownerId, expiresAt },
        { new: true }
      ).lean();
      if (res) return { formId, taskId, ownerId, expiresAt };
      return null;
    }
  }

  /**
   * Extend an existing lease owned by this ownerId.
   */
  async extend(formId: string, taskId: string, ownerId: string, ttlMs: number): Promise<LockToken | null> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const res = await this.formLockModel.findOneAndUpdate(
      { formId, taskId, ownerId },
      { expiresAt },
      { new: true }
    ).lean();
    return res ? { formId, taskId, ownerId, expiresAt } : null;
  }

  /**
   * Release a lease if owned by caller.
   */
  async release(formId: string, taskId: string, ownerId: string): Promise<void> {
    await this.formLockModel.deleteOne({ formId, taskId, ownerId }).exec();
  }
}
