import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { FormsService } from './forms.service';
import { ResponseService } from './response.service';
import { EmailService } from './email.service';
import { AnalyticsService } from './analytics.service';
import { FormsController, PublicFormsController } from './forms.controller';
import { Form, FormSchema } from '../schemas/form.schema';
import { Response, ResponseSchema } from '../schemas/response.schema';
import { AnalyticsTaskEntity, AnalyticsTaskSchema } from '../schemas/analytics-task.schema';
import { FormLockSchema } from '../schemas/form-lock.schema';
import { AiModule } from '../ai/ai.module';
import { BullConfigModule } from '../bull/bull.module';
import { AnalyticsQueueModule } from '../analytics/queues/analytics-queue.module';

// Analytics modules
import { AnalyticsOrchestrator } from '../analytics/core/analytics.orchestrator';
import { TaskManager } from '../analytics/core/task.manager';
import { ResponseProcessor } from '../analytics/processors/response.processor';
import { TopicClusterer } from '../analytics/processors/topic.clusterer';
import { StatisticsCalculator } from '../analytics/calculators/statistics.calculator';
import { CorrelationCalculator } from '../analytics/calculators/correlation.calculator';
import { SentimentCalculator } from '../analytics/calculators/sentiment.calculator';
import { SummaryGenerator } from '../analytics/generators/summary.generator';
import { FindingsGenerator } from '../analytics/generators/findings.generator';
import { RecommendationsGenerator } from '../analytics/generators/recommendations.generator';
import { BatchProcessor } from '../analytics/utils/batch.processor';
import { PromptBuilder } from '../analytics/utils/prompt.builder';
import { TaskStore } from '../analytics/stores/task.store';
import { FormLockStore } from '../analytics/stores/form-lock.store';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: Response.name, schema: ResponseSchema },
      { name: 'AnalyticsTask', schema: AnalyticsTaskSchema },
      { name: 'FormLock', schema: FormLockSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' },
    }),
    AiModule,
    BullConfigModule,
    AnalyticsQueueModule,
  ],
  controllers: [FormsController, PublicFormsController],
  providers: [
    FormsService, 
    ResponseService, 
    EmailService, 
    AnalyticsService,
    // Analytics core
    AnalyticsOrchestrator,
    TaskManager,
    // Analytics processors
    ResponseProcessor,
    TopicClusterer,
    // Analytics calculators
    StatisticsCalculator,
    CorrelationCalculator,
    SentimentCalculator,
    // Analytics generators
    SummaryGenerator,
    FindingsGenerator,
    RecommendationsGenerator,
    // Analytics utilities
    BatchProcessor,
    PromptBuilder,
    // Analytics stores
    TaskStore,
    FormLockStore,
  ],
  exports: [FormsService, ResponseService, EmailService, AnalyticsService],
})
export class FormsModule {}