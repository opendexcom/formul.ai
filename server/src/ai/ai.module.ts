import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from '../auth/auth.module';
import { GuardianService } from './guardian.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AiController],
  providers: [AiService, GuardianService],
  exports: [AiService],
})
export class AiModule { }
