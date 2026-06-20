import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from '../auth/auth.module';
import { GuardianService } from './guardian.service';
import { SemanticLlmCacheService } from './semantic-llm-cache.service';
import { EmbeddingService } from './embedding.service';
import { MlflowModule } from '../mlflow/mlflow.module';
import { GraphsModule } from '../graphs/graphs.module';

@Module({
  imports: [MlflowModule, forwardRef(() => AuthModule), forwardRef(() => GraphsModule)],
  controllers: [AiController],
  providers: [AiService, GuardianService, SemanticLlmCacheService, EmbeddingService],
  exports: [AiService, GuardianService, SemanticLlmCacheService, EmbeddingService],
})
export class AiModule { }

/**
 * Minimal AI module for worker processes that don't need HTTP controllers or auth
 */
@Module({
  imports: [MlflowModule, forwardRef(() => GraphsModule)],
  providers: [AiService, GuardianService, SemanticLlmCacheService, EmbeddingService],
  exports: [AiService, GuardianService, SemanticLlmCacheService, EmbeddingService],
})
export class AiCoreModule { }
