import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  // Create a standalone application context (no HTTP server, no routes)
  const appContext = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  console.log('Analytics Worker started');
  console.log('Redis:', process.env.REDIS_HOST || 'localhost');
  // Keep the context alive; queues and processors are active via decorators
  // Optional: handle graceful shutdown
  const shutdown = async () => {
    await appContext.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
