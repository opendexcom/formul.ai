import { Schema, model, HydratedDocument } from 'mongoose';

export interface FormLock {
  formId: string;
  taskId: string;
  ownerId: string; // orchestrator instance id
  expiresAt: Date; // TTL absolute expiry
  createdAt?: Date;
  updatedAt?: Date;
}

export type FormLockDocument = HydratedDocument<FormLock>;

export const FormLockSchema = new Schema<FormLock>(
  {
    formId: { type: String, required: true, index: true, unique: true },
    taskId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true }, // TTL index added below
  },
  { timestamps: true, collection: 'form_locks' }
);

// TTL: expire at expiresAt (absolute)
// Note: Mongoose supports TTL via index with expireAfterSeconds: 0
FormLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });

export const FormLockModel = model<FormLock>('FormLock', FormLockSchema);
