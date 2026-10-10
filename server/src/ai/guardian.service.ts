import { Injectable, Logger } from '@nestjs/common';
import { MlflowPromptService } from '../mlflow/mlflow-prompt.service';
import { PromptSandboxService } from '../mlflow/prompt-sandbox.service';
import {
  runWithActiveMlflowTraceContextAsync,
  buildPromptTraceInputs,
  buildRequestPreview,
} from '../mlflow/mlflow-trace-context';
import { resolveLlmProviderConfig } from './llm-provider.config';
import { createChatModel } from './llm-provider.factory';
import type { ChatModelLike } from './llm-provider.factory';

export interface ValidationResult {
    isSafe: boolean;
    reason?: string;
    riskType: 'injection' | 'malicious' | 'leakage' | 'none';
}

@Injectable()
export class GuardianService {
    private readonly logger = new Logger(GuardianService.name);
    private chatModel: ChatModelLike | null;

    constructor(
        private readonly mlflowPrompts: MlflowPromptService,
        private readonly sandbox: PromptSandboxService,
    ) {
        this.chatModel = createChatModel('guardian', resolveLlmProviderConfig());
    }

    async validatePrompt(userPrompt: string): Promise<ValidationResult> {
        try {
            if (!this.chatModel) {
                throw new Error('Guardian LLM is not configured');
            }

            const { prompt: systemPrompt } = await this.mlflowPrompts.formatFlow(
                'security.guardian',
                { userInput: this.sandbox.escapeUserInput(userPrompt) },
            );

            const response = await runWithActiveMlflowTraceContextAsync(
                        () => this.chatModel!.invoke(systemPrompt),
                        {
                            inputs: buildPromptTraceInputs(systemPrompt),
                            spanName: 'formulai.security.guardian',
                            requestPreview: buildRequestPreview(systemPrompt),
                        },
                    ) as { content?: unknown };

            const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

            const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

            const result = JSON.parse(jsonStr) as ValidationResult;

            if (!result.isSafe) {
                this.logger.warn(`Blocked unsafe prompt. Risk: ${result.riskType}, Reason: ${result.reason}`);
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to validate prompt', error);
            return {
                isSafe: false,
                reason: 'Security validation failed due to internal error',
                riskType: 'none'
            };
        }
    }
}
