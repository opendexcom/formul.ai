import { Schema, model, HydratedDocument } from 'mongoose';

export type TaskState = 'new' | 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

export interface AnalyticsTaskEntity {
  taskId: string;
  formId: string;
  state: TaskState;
  progress: number;
  message?: string;
  ownerId: string; // orchestrator instance id
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date; // set only at terminal state to enable TTL cleanup
}

export type AnalyticsTaskDocument = HydratedDocument<AnalyticsTaskEntity>;

export const AnalyticsTaskSchema = new Schema<AnalyticsTaskEntity>(
  {
    taskId: { type: String, required: true, unique: true, index: true },
    formId: { type: String, required: true, index: true },
    state: { type: String, required: true, enum: ['new','pending','running','completed','failed','canceled'], index: true },
    progress: { type: Number, required: true, min: 0, max: 100, default: 0 },
    message: { type: String },
    ownerId: { type: String, required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
    startedAt: { type: Date },
    completedAt: { type: Date },
    expiresAt: { type: Date, index: true }, // TTL index below
  },
  { timestamps: false, collection: 'analytics_tasks' }
);

// TTL: when expiresAt is set (terminal states), auto-remove after it elapses
AnalyticsTaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });

export const AnalyticsTaskModel = model<AnalyticsTaskEntity>('AnalyticsTask', AnalyticsTaskSchema);
