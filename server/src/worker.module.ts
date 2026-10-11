import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullConfigModule } from './bull/bull.module';
import { AnalyticsQueueModule } from './analytics/queues/analytics-queue.module';
import { AiCoreModule } from './ai/ai.module';
import { Form } from './schemas/form.schema';
import { Response } from './schemas/response.schema';
import { getCoreSchemaOrThrow } from './schemas/core-schema-registry';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/formulai'),
    MongooseModule.forFeature([
      { name: Form.name, schema: getCoreSchemaOrThrow(Form.name) },
      { name: Response.name, schema: getCoreSchemaOrThrow(Response.name) },
    ]),
    BullConfigModule,
    AnalyticsQueueModule,
    AiCoreModule,
  ],
})
export class WorkerModule {}
