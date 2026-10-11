import { Module, NestModule, MiddlewareConsumer, OnModuleInit } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { QueueName } from '../analytics/queues/queue.names';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from '../schemas/user.schema';
import { getCoreSchemaOrThrow } from '../schemas/core-schema-registry';
import {
  AdminAuthMiddleware,
  adminQueuesAuthMiddleware,
  bindAdminAuthMiddleware,
} from './middlewares/admin-auth.middleware';
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
      middleware: adminQueuesAuthMiddleware,
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
  providers: [AdminAuthMiddleware],
})
export class MonitoringModule implements NestModule, OnModuleInit {
  constructor(private readonly adminAuth: AdminAuthMiddleware) {}

  onModuleInit() {
    bindAdminAuthMiddleware(this.adminAuth);
  }

  configure(consumer: MiddlewareConsumer) {
    // String path → Nest uses app.use (prefix). Also attached via
    // BullBoardModule.forRoot({ middleware }) so auth runs before the board.
    consumer.apply(AdminAuthMiddleware).forRoutes('admin/queues');
  }
}
