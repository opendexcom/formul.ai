import { Global, Module } from '@nestjs/common';
import { FlowsConfigService } from './flows.config';
import { MlflowPromptService } from './mlflow-prompt.service';
import { PromptSandboxService } from './prompt-sandbox.service';

@Global()
@Module({
  providers: [FlowsConfigService, PromptSandboxService, MlflowPromptService],
  exports: [FlowsConfigService, PromptSandboxService, MlflowPromptService],
})
export class MlflowModule {}
