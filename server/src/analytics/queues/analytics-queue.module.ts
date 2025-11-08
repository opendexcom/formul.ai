import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueName } from './queue.names';
import { OrchestrationProducer } from './orchestration.producer';
import { OrchestrationConsumer } from './orchestration.consumer';
import { ResponseProcessingConsumer } from './response-processing.consumer';
import { TopicClusteringConsumer } from './topic-clustering.consumer';
import { AggregationConsumer } from './aggregation.consumer';
import { AIGenerationConsumer } from './ai-generation.consumer';
import { ProgressService } from './progress.service';
import { Form, FormSchema } from '../../schemas/form.schema';
import { Response, ResponseSchema } from '../../schemas/response.schema';
import { AiModule } from '../../ai/ai.module';
// Analytics providers
import { ResponseProcessor } from '../processors/response.processor';
import { TopicClusterer } from '../processors/topic.clusterer';
import { StatisticsCalculator } from '../calculators/statistics.calculator';
import { CorrelationCalculator } from '../calculators/correlation.calculator';
import { SentimentCalculator } from '../calculators/sentiment.calculator';
import { SummaryGenerator } from '../generators/summary.generator';
import { FindingsGenerator } from '../generators/findings.generator';
import { RecommendationsGenerator } from '../generators/recommendations.generator';
import { BatchProcessor } from '../utils/batch.processor';
import { PromptBuilder } from '../utils/prompt.builder';
import { DeadLetterService } from './dead-letter.service';
import { DeadLetterConsumer } from './dead-letter.consumer';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.ORCHESTRATION,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
      },
      {
        name: QueueName.RESPONSE_PROCESSING,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
      },
      {
        name: QueueName.TOPIC_CLUSTERING,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
      },
      {
        name: QueueName.AGGREGATION,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
      },
      {
        name: QueueName.AI_GENERATION,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
      },
      {
        name: QueueName.DEAD_LETTER,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
    ),
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: Response.name, schema: ResponseSchema },
    ]),
    AiModule,
  ],
  providers: [
    // Queue producers/consumers
    OrchestrationProducer,
    OrchestrationConsumer,
    ResponseProcessingConsumer,
    TopicClusteringConsumer,
    AggregationConsumer,
    AIGenerationConsumer,
    ProgressService,
    // DLQ helpers
    DeadLetterService,
    DeadLetterConsumer,
    // Analytics providers
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
  exports: [OrchestrationProducer, ProgressService],
})
export class AnalyticsQueueModule {}
