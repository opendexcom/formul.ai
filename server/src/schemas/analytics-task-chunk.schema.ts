import { Schema, model, HydratedDocument } from 'mongoose';

export interface AnalyticsTaskChunk {
  taskId: string;
  chunkSeq: number;
  appliedAt: Date; // TTL relative expiry, e.g., 7 days
}

export type AnalyticsTaskChunkDocument = HydratedDocument<AnalyticsTaskChunk>;

const AnalyticsTaskChunkSchema = new Schema<AnalyticsTaskChunk>(
  {
    taskId: { type: String, required: true, index: true },
    chunkSeq: { type: Number, required: true, index: true },
    appliedAt: { type: Date, default: () => new Date(), expires: '7d' }, // TTL: auto-delete after 7 days
  },
  { timestamps: false, collection: 'analytics_task_chunks' }
);

// Idempotency uniqueness: prevent duplicate application of the same chunk
AnalyticsTaskChunkSchema.index({ taskId: 1, chunkSeq: 1 }, { unique: true, name: 'uniq_task_chunk' });

export const AnalyticsTaskChunkModel = model<AnalyticsTaskChunk>('AnalyticsTaskChunk', AnalyticsTaskChunkSchema);
