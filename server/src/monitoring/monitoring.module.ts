import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { QueueName } from '../analytics/queues/queue.names';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import { AdminAuthMiddleware } from './middlewares/admin-auth.middleware';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.ORCHESTRATION,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.RESPONSE_PROCESSING,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.TOPIC_CLUSTERING,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.AGGREGATION,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.AI_GENERATION,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: QueueName.DEAD_LETTER,
      adapter: BullAdapter,
    }),
  ],
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AdminAuthMiddleware)
      .forRoutes({ path: 'admin/queues', method: RequestMethod.ALL });
  }
}
