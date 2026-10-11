import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { QueueName } from '../analytics/queues/queue.names';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from '../schemas/user.schema';
import { getCoreSchemaOrThrow } from '../schemas/core-schema-registry';
import { AdminAuthMiddleware } from './middlewares/admin-auth.middleware';
import { getJwtSecret } from '../auth/jwt-secret';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: getCoreSchemaOrThrow(User.name) },
    ]),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.ORCHESTRATION,
      adapter: BullAdapter,
      options: { readOnlyMode: true },
    }),
    BullBoardModule.forFeature({
      name: QueueName.RESPONSE_PROCESSING,
      adapter: BullAdapter,
      options: { readOnlyMode: true },
    }),
    BullBoardModule.forFeature({
      name: QueueName.TOPIC_CLUSTERING,
      adapter: BullAdapter,
      options: { readOnlyMode: true },
    }),
    BullBoardModule.forFeature({
      name: QueueName.AGGREGATION,
      adapter: BullAdapter,
      options: { readOnlyMode: true },
    }),
    BullBoardModule.forFeature({
      name: QueueName.AI_GENERATION,
      adapter: BullAdapter,
      options: { readOnlyMode: true },
    }),
    BullBoardModule.forFeature({
      name: QueueName.DEAD_LETTER,
      adapter: BullAdapter,
      options: { readOnlyMode: true },
    }),
  ],
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AdminAuthMiddleware)
      .forRoutes(
        { path: 'admin/queues', method: RequestMethod.ALL },
        { path: 'admin/queues/{*path}', method: RequestMethod.ALL },
        { path: 'admin/queues{/*path}', method: RequestMethod.ALL },
      );
  }
}
