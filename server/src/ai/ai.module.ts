import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from '../auth/auth.module';
import { GuardianService } from './guardian.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AiController],
  providers: [AiService, GuardianService],
  exports: [AiService, GuardianService],
})
export class AiModule { }

/**
 * Minimal AI module for worker processes that don't need HTTP controllers or auth
 * This avoids circular dependencies with FormsModule/AuthModule
 */
@Module({
  providers: [AiService, GuardianService],
  exports: [AiService, GuardianService],
})
export class AiCoreModule { }
