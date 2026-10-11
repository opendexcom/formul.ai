import { Module, forwardRef } from '@nestjs/common';
import { GraphRunnerService } from './graph-runner.service';
import { AiCoreModule } from '../ai/ai.module';

@Module({
  imports: [forwardRef(() => AiCoreModule)],
  providers: [GraphRunnerService],
  exports: [GraphRunnerService],
})
export class GraphsModule {}
