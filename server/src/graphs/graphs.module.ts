import { Module, forwardRef } from '@nestjs/common';
import { GraphRunnerService } from './graph-runner.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [forwardRef(() => AiModule)],
  providers: [GraphRunnerService],
  exports: [GraphRunnerService],
})
export class GraphsModule {}
