import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

export type ProjectStatus =
  | 'draft'
  | 'designing'
  | 'published'
  | 'collecting'
  | 'analyzing'
  | 'analyzed'
  | 'reported'
  | 'completed'
  | 'archived';

@Schema({ _id: false })
export class ProjectVariantTargetGroup {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;
}

@Schema({ _id: false })
export class ProjectVariant {
  @Prop({ required: true, enum: ['main', 'A', 'B'] })
  key: 'main' | 'A' | 'B';

  @Prop({ type: Types.ObjectId, ref: 'Form', required: true })
  formId: Types.ObjectId;

  @Prop({ type: ProjectVariantTargetGroup, default: { name: 'General' } })
  targetGroup?: ProjectVariantTargetGroup;

  @Prop()
  internalDescription?: string;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop()
  publishUrl?: string;
}

export const ProjectVariantSchema = SchemaFactory.createForClass(ProjectVariant);

@Schema({ _id: false })
export class SplitQuestionnaireVariantDesign {
  @Prop({ type: [String], default: [] })
  modifiedQuestionIds: string[];

  @Prop({ type: [String], default: [] })
  excludedQuestionIds: string[];

  @Prop({ type: [String], default: [] })
  polarityFlippedQuestionIds: string[];

  /** Maps variant question ID → original question ID on the source variant (usually main). */
  @Prop({ type: Object, default: {} })
  polarityPairs: Record<string, string>;
}

export const SplitQuestionnaireVariantDesignSchema = SchemaFactory.createForClass(
  SplitQuestionnaireVariantDesign,
);

@Schema({ _id: false })
export class SplitQuestionnaireDesign {
  @Prop({ type: [String], default: [] })
  coreQuestionIds: string[];

  @Prop({ type: Object, default: {} })
  perVariant: Partial<
    Record<'main' | 'A' | 'B', SplitQuestionnaireVariantDesign>
  >;
}

export const SplitQuestionnaireDesignSchema =
  SchemaFactory.createForClass(SplitQuestionnaireDesign);

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true })
  name: string;

  @Prop()
  hypothesis?: string;

  @Prop({ type: [String], default: [] })
  hypotheses: string[];

  @Prop()
  researchNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, enum: ['single', 'ab_test'], default: 'single' })
  type: 'single' | 'ab_test';

  @Prop({ enum: ['standard_ab', 'split_questionnaire'], default: 'standard_ab' })
  researchDesignType?: 'standard_ab' | 'split_questionnaire';

  @Prop({ type: SplitQuestionnaireDesignSchema })
  splitQuestionnaireDesign?: SplitQuestionnaireDesign;

  @Prop({
    required: true,
    enum: [
      'draft',
      'designing',
      'published',
      'collecting',
      'analyzing',
      'analyzed',
      'reported',
      'completed',
      'archived',
    ],
    default: 'draft',
  })
  status: ProjectStatus;

  @Prop({ type: [ProjectVariantSchema], default: [] })
  variants: ProjectVariant[];

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ type: Object })
  analytics?: Record<string, unknown>;

  @Prop({ type: Object })
  report?: {
    generatedAt: Date;
    summary?: string;
  };

  @Prop({ type: Object })
  comparativeReport?: Record<string, unknown>;

  @Prop({ type: Object })
  decisions?: {
    notes?: string;
    completedAt?: Date;
  };

  @Prop({ type: Types.ObjectId, ref: 'Form' })
  migratedFromFormId?: Types.ObjectId;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ ownerId: 1, createdAt: -1 });
ProjectSchema.index({ ownerId: 1, status: 1 });
