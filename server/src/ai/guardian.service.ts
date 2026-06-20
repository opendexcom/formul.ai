import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { MlflowPromptService } from '../mlflow/mlflow-prompt.service';
import { PromptSandboxService } from '../mlflow/prompt-sandbox.service';
import {
  runWithActiveMlflowTraceContextAsync,
  buildPromptTraceInputs,
  buildRequestPreview,
} from '../mlflow/mlflow-trace-context';

export interface ValidationResult {
    isSafe: boolean;
    reason?: string;
    riskType: 'injection' | 'malicious' | 'leakage' | 'none';
}

@Injectable()
export class GuardianService {
    private readonly logger = new Logger(GuardianService.name);
    private chatModel: ChatOpenAI;

    constructor(
        private readonly mlflowPrompts: MlflowPromptService,
        private readonly sandbox: PromptSandboxService,
    ) {
        this.chatModel = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            model: 'gpt-4o-mini',
            temperature: 0,
        });
    }

    async validatePrompt(userPrompt: string): Promise<ValidationResult> {
        try {
            const { prompt: systemPrompt, loaded } = await this.mlflowPrompts.formatFlow(
                'security.guardian',
                { userInput: this.sandbox.escapeUserInput(userPrompt) },
            );

            const response = await runWithActiveMlflowTraceContextAsync(
                        () => this.chatModel.invoke(systemPrompt),
                        {
                            inputs: buildPromptTraceInputs(systemPrompt),
                            spanName: 'formulai.security.guardian',
                            requestPreview: buildRequestPreview(systemPrompt),
                        },
                    );

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
