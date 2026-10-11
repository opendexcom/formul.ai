import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { getCoreSchemaOrThrow } from '../schemas/core-schema-registry';
import { Form } from '../schemas/form.schema';
import { Project } from '../schemas/project.schema';
import { Response } from '../schemas/response.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ResearchContextService } from './research-context.service';
import { VariantQuestionDiffService } from './variant-question-diff.service';
import { ComparativeReportService } from './comparative-report.service';
import { StudyAnalysisService } from './study-analysis.service';
import { StudyAnalysisGenerator } from './study-analysis.generator';
import { CrossVariantOrchestrator } from '../analytics/cross-variant/cross-variant.orchestrator';
import { CrossVariantTopicAligner } from '../analytics/cross-variant/cross-variant-topic-aligner';
import { CrossVariantMetricsService } from '../analytics/cross-variant/cross-variant-metrics.service';
import { CrossVariantCorrelationsService } from '../analytics/cross-variant/cross-variant-correlations.service';
import { CrossVariantReportGenerator } from '../analytics/cross-variant/cross-variant-report.generator';
import { PromptBuilder } from '../analytics/utils/prompt.builder';
import { AnalyticsQueueModule } from '../analytics/queues/analytics-queue.module';
import { AiCoreModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: getCoreSchemaOrThrow(Project.name) },
      { name: Form.name, schema: getCoreSchemaOrThrow(Form.name) },
      { name: Response.name, schema: getCoreSchemaOrThrow(Response.name) },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' },
    }),
    forwardRef(() => AiCoreModule),
    forwardRef(() => AnalyticsQueueModule),
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ResearchContextService,
    VariantQuestionDiffService,
    ComparativeReportService,
    CrossVariantOrchestrator,
    CrossVariantTopicAligner,
    CrossVariantMetricsService,
    CrossVariantCorrelationsService,
    CrossVariantReportGenerator,
    PromptBuilder,
    StudyAnalysisService,
    StudyAnalysisGenerator,
  ],
  exports: [ProjectsService, ResearchContextService, ComparativeReportService, StudyAnalysisService],
})
export class ProjectsModule {}
