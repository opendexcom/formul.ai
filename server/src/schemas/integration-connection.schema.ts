import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntegrationProvider =
  | 'slack'
  | 'teams'
  | 'discord'
  | 'generic_webhook'
  | 'analysis_api';

export type IntegrationConnectionDocument = IntegrationConnection & Document;

@Schema({ timestamps: true })
export class IntegrationConnection {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['slack', 'teams', 'discord', 'generic_webhook', 'analysis_api'],
  })
  provider: IntegrationProvider;

  @Prop({ type: Object, default: {} })
  config: {
    hookId?: string;
    secretHash?: string;
    discordPublicKey?: string;
    signingSecret?: string;
    apiKeyPrefix?: string;
  };

  @Prop({ default: false })
  connected: boolean;

  @Prop()
  lastUsedAt?: Date;
}

export const IntegrationConnectionSchema =
  SchemaFactory.createForClass(IntegrationConnection);
IntegrationConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });
IntegrationConnectionSchema.index({ 'config.hookId': 1 }, { unique: true, sparse: true });
