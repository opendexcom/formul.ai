import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ResponseDocument = Response & Document;

// Analytics metadata for individual answers
@Schema({ _id: false })
export class AnswerMetadata {
  @Prop({ type: [String] })
  extractedTopics?: string[];

  @Prop({ type: Number })
  topicConfidence?: number;

  @Prop({ type: Object })
  sentiment?: {
    label: 'positive' | 'neutral' | 'negative' | 'ambivalent';
    score: number; // -1 to 1
    intensity?: number; // 0 to 1
    confidence: number; // 0 to 1
    targets?: Array<{
      target: string;
      sentiment: 'positive' | 'neutral' | 'negative';
    }>;
  };

  @Prop({ type: Number })
  textLength?: number;

  @Prop({ type: String })
  normalizedValue?: string;
}

export const AnswerMetadataSchema = SchemaFactory.createForClass(AnswerMetadata);

@Schema()
export class Answer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: any; // Can be string, number, boolean, array, etc.

  @Prop({ type: AnswerMetadataSchema })
  metadata?: AnswerMetadata;
}

export const AnswerSchema = SchemaFactory.createForClass(Answer);

// Response-level metadata for analytics
@Schema({ _id: false })
export class ResponseMetadata {
  @Prop({ default: false })
  hasTextContent: boolean;

  @Prop({ type: [String], default: [] })
  extractedKeywords: string[];

  @Prop({ default: false })
  processedForAnalytics: boolean;

  @Prop({ type: Date })
  lastAnalyzed?: Date;

  @Prop({ type: String })
  processingTaskId?: string; // Task ID currently processing this response

  @Prop({ type: Date })
  processingStartedAt?: Date; // When processing started

  @Prop({ type: Object })
  overallSentiment?: {
    label: 'positive' | 'neutral' | 'negative' | 'ambivalent';
    score: number; // -1 to 1
    emotionalTone?: string; // e.g., 'frustrated', 'satisfied', 'neutral'
    emotionalRange?: 'narrow' | 'moderate' | 'wide';
    confidence: number;
  };

  @Prop({ type: [String] })
  allTopics?: string[];

  @Prop({ type: [String] })
  canonicalTopics?: string[]; // Clustered canonical topic names for easy aggregation

  @Prop({ type: [String] })
  primaryTopics?: string[]; // Primary/most important topics

  @Prop({ type: Object })
  topicMapping?: Record<string, string>; // Maps raw topics to canonical topics

  @Prop({ type: Number })
  qualityScore?: number;

  // From chain prompting stages
  @Prop({ type: [Object] })
  topics?: Array<{
    topic: string;
    inVivoCode?: string;
    confidence: number;
    isPrimary: boolean;
    sourceQuestions: string[];
    relatedPhrases?: string[];
  }>;

  @Prop({ type: Object })
  sentiment?: {
    questionSentiments: Array<{
      questionId: string;
      sentiment: 'positive' | 'neutral' | 'negative' | 'ambivalent';
      score: number;
      intensity: number;
      targets?: Array<{
        target: string;
        sentiment: string;
      }>;
      confidence: number;
    }>;
    overallSentiment: {
      sentiment: 'positive' | 'neutral' | 'negative' | 'ambivalent';
      score: number;
      emotionalTone: string;
      confidence: number;
    };
  };

  @Prop({ type: Object })
  discourse?: {
    frames: Array<{
      type: 'problem' | 'solution' | 'complaint' | 'praise' | 'narrative';
      description: string;
      evidence: string;
      implicitValues?: string[];
    }>;
    narrativeStructure?: {
      hasArc: boolean;
      type: 'linear' | 'episodic' | 'argumentative' | 'evaluative';
      keyMoments?: string[];
    };
    powerDynamics?: string;
  };

  @Prop({ type: Object })
  quotes?: {
    keyQuotes: Array<{
      quote: string;
      significance: string;
      questionId: string;
      relatedTopics: string[];
    }>;
    representativeness: 'typical' | 'deviant' | 'mixed';
    responseQuality: {
      depth: 'superficial' | 'moderate' | 'deep';
      completeness: number;
      coherence: number;
    };
  };

  @Prop({ type: Boolean, default: true })
  fullTextPreserved?: boolean;
}

export const ResponseMetadataSchema = SchemaFactory.createForClass(ResponseMetadata);

@Schema({ timestamps: true })
export class Response {
  @Prop({ type: Types.ObjectId, ref: 'Form', required: true })
  formId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  respondentId?: Types.ObjectId;

  @Prop()
  respondentEmail?: string;

  @Prop({ type: [AnswerSchema], required: true })
  answers: Answer[];

  @Prop({ default: Date.now })
  submittedAt: Date;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: ResponseMetadataSchema, default: () => ({ hasTextContent: false, processedForAnalytics: false, extractedKeywords: [] }) })
  metadata: ResponseMetadata;
}

export const ResponseSchema = SchemaFactory.createForClass(Response);