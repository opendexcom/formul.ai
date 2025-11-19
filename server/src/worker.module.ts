import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullConfigModule } from './bull/bull.module';
import { AnalyticsQueueModule } from './analytics/queues/analytics-queue.module';
import { AiModule } from './ai/ai.module';
import { Form, FormSchema } from './schemas/form.schema';
import { Response, ResponseSchema } from './schemas/response.schema';
// Analytics providers used by consumers
import { ResponseProcessor } from './analytics/processors/response.processor';
import { TopicClusterer } from './analytics/processors/topic.clusterer';
import { StatisticsCalculator } from './analytics/calculators/statistics.calculator';
import { CorrelationCalculator } from './analytics/calculators/correlation.calculator';
import { SentimentCalculator } from './analytics/calculators/sentiment.calculator';
import { SummaryGenerator } from './analytics/generators/summary.generator';
import { FindingsGenerator } from './analytics/generators/findings.generator';
import { RecommendationsGenerator } from './analytics/generators/recommendations.generator';
import { BatchProcessor } from './analytics/utils/batch.processor';
import { PromptBuilder } from './analytics/utils/prompt.builder';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/formulai'),
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: Response.name, schema: ResponseSchema },
    ]),
    BullConfigModule,
    AnalyticsQueueModule,
    AiModule,
  ],
  providers: [
    // Analytics providers consumed by workers
    ResponseProcessor,
    TopicClusterer,
    StatisticsCalculator,
    CorrelationCalculator,
    SentimentCalculator,
    SummaryGenerator,
    FindingsGenerator,
    RecommendationsGenerator,
    BatchProcessor,
    PromptBuilder,
  ],
})
export class WorkerModule {}
