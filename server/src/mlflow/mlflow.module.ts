import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { FlowsConfigService } from './flows.config';
import { MlflowPromptService } from './mlflow-prompt.service';
import { PromptSandboxService } from './prompt-sandbox.service';
import { MlflowTraceMiddleware } from './mlflow-trace.middleware';

@Global()
@Module({
  providers: [FlowsConfigService, PromptSandboxService, MlflowPromptService],
  exports: [FlowsConfigService, PromptSandboxService, MlflowPromptService],
})
export class MlflowModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MlflowTraceMiddleware).forRoutes('*');
  }
}
