import { Schema, model, HydratedDocument, Types } from 'mongoose';

export interface ResponseClaim {
  responseId: Types.ObjectId;
  formId: string;
  taskId: string;
  ownerId: string; // orchestrator instance id
  expiresAt: Date; // TTL absolute expiry
  createdAt?: Date;
  updatedAt?: Date;
}

export type ResponseClaimDocument = HydratedDocument<ResponseClaim>;

const ResponseClaimSchema = new Schema<ResponseClaim>(
  {
    responseId: { type: Schema.Types.ObjectId, required: true, index: true, unique: true },
    formId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true }, // TTL index added below
  },
  { timestamps: true, collection: 'response_claims' }
);

// TTL: expire at expiresAt (absolute)
ResponseClaimSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });

export const ResponseClaimModel = model<ResponseClaim>('ResponseClaim', ResponseClaimSchema);
