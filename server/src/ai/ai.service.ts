import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';
import { GuardianService } from './guardian.service';
import { LlmUsage } from './llm.types';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { MlflowPromptService } from '../mlflow/mlflow-prompt.service';
import { FlowsConfigService } from '../mlflow/flows.config';
import { SemanticLlmCacheService } from './semantic-llm-cache.service';
import { EmbeddingService } from './embedding.service';
import { InvokeFlowOptions } from '../mlflow/mlflow.types';
import { FlowNotRegisteredException } from '../mlflow/mlflow.exceptions';
import {
  runWithActiveMlflowTraceContextAsync,
  runWithMlflowTraceContextAsync,
  buildInvokeFlowTraceContext,
  buildFlowPromptTraceInputs,
  buildFlowRequestPreview,
  combinePromptForCache,
} from '../mlflow/mlflow-trace-context';
import { flushMlflowTraces } from '../mlflow/mlflow-langchain-tracing';
import { GraphRunnerService } from '../graphs/graph-runner.service';

export interface GenerationStep {
  step: string;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  data?: any;
  usage?: LlmUsage;
}

function extractUsageFromResponse(raw: any): LlmUsage | undefined {
  const usage =
    raw?.usage ??
    raw?.usage_metadata ??
    raw?.response_metadata?.usage ??
    raw?.response_metadata?.tokenUsage;
  if (!usage) return undefined;

  const promptTokens =
    usage.prompt_tokens ??
    usage.promptTokens ??
    usage.input_tokens ??
    usage.inputTokens;
  const completionTokens =
    usage.completion_tokens ??
    usage.completionTokens ??
    usage.output_tokens ??
    usage.outputTokens;
  const totalTokens = usage.total_tokens ?? usage.totalTokens;
  if (promptTokens == null && completionTokens == null && totalTokens == null) {
    return undefined;
  }

  return {
    model:
      raw?.model ??
      raw?.response_metadata?.model_name ??
      raw?.response_metadata?.model ??
      usage?.model ??
      'unknown',
    promptTokens,
    completionTokens,
    totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
  };
}

@Injectable()
export class AiService {
  private chatModel: any | null = null;
  private provider: 'openai' | 'ollama' = 'openai';

  constructor(
    private readonly guardianService: GuardianService,
    private readonly mlflowPrompts: MlflowPromptService,
    private readonly flowsConfig: FlowsConfigService,
    private readonly semanticCache: SemanticLlmCacheService,
    private readonly embeddings: EmbeddingService,
    @Inject(forwardRef(() => GraphRunnerService))
    private readonly graphRunner: GraphRunnerService,
  ) {
    // Determine provider from environment
    this.provider =
      (process.env.LLM_PROVIDER as 'openai' | 'ollama') || 'openai';

    try {
      if (this.provider === 'ollama') {
        this.initializeOllama();
      } else {
        this.initializeOpenAI();
      }
    } catch (e) {
      console.error(`Failed to initialize LangChain with ${this.provider}:`, e);
      throw new InternalServerErrorException(
        'AI service initialization failed',
      );
    }
  }

  private initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn(
        'OPENAI_API_KEY not configured. AI service will not be available.',
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ChatOpenAI } = require('@langchain/openai');
    this.chatModel = new ChatOpenAI({
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    });
  }

  private initializeOllama() {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama2';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ChatOllama } = require('@langchain/community/chat_models/ollama');
    this.chatModel = new ChatOllama({
      baseUrl,
      model,
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    });
  }

  private async getSharedSnippet(flowKey: string): Promise<string> {
    const { prompt } = await this.mlflowPrompts.formatFlow(flowKey, {});
    return prompt;
  }

  async invokeFlow(
    flowKey: string,
    variables: Record<string, unknown>,
    options: InvokeFlowOptions = {},
  ): Promise<{ content: string; usage?: LlmUsage; promptVersion?: string }> {
    if (!this.flowsConfig.hasFlow(flowKey)) {
      throw new FlowNotRegisteredException(flowKey);
    }

    const { prompt, systemPrompt, loaded, systemLoaded } =
      await this.mlflowPrompts.formatFlow(flowKey, variables);
    const cachePrompt = combinePromptForCache(prompt, systemPrompt);
    const traceInputs = buildFlowPromptTraceInputs(prompt, systemPrompt);
    const requestPreview = buildFlowRequestPreview(prompt, systemPrompt);
    const cachePolicy = this.flowsConfig.getCachePolicy(flowKey);
    const model =
      process.env.OPENAI_MODEL || process.env.OLLAMA_MODEL || 'unknown';
    const useJsonFormat = options.useJsonFormat ?? true;
    const scopeId = this.semanticCache.resolveScopeId(cachePolicy, options);
    const cacheCtx = {
      flowKey,
      scopeId,
      promptVersion: loaded.version,
      model,
      useJsonFormat,
    };

    let embedding: number[] | undefined;
    if (
      cachePolicy.enabled &&
      cachePolicy.mode === 'semantic' &&
      this.embeddings.isAvailable()
    ) {
      try {
        embedding = await this.embeddings.embedQuery(cachePrompt);
      } catch {
        embedding = undefined;
      }
    }

    const cacheHit = await this.semanticCache.lookup(
      cachePrompt,
      cachePolicy,
      cacheCtx,
      embedding,
    );
    if (cacheHit) {
      const traceContext = buildInvokeFlowTraceContext(flowKey, loaded, {
        ...options,
        cached: true,
      });
      await runWithMlflowTraceContextAsync(traceContext, async () => {
        await runWithActiveMlflowTraceContextAsync(
          async () => ({
            content: cacheHit.content,
            cached: true,
            usage: {
              model,
              totalTokens: 0,
              promptTokens: 0,
              completionTokens: 0,
              cached: true,
              cacheMode: cacheHit.cacheMode,
              similarity: cacheHit.similarity,
            },
          }),
          {
            inputs: {
              ...traceInputs,
              cached: true,
              cacheMode: cacheHit.cacheMode,
              flowKey,
              promptName: loaded.name,
              promptVersion: loaded.version,
              ...(systemLoaded
                ? {
                    systemPromptName: systemLoaded.name,
                    systemPromptVersion: systemLoaded.version,
                  }
                : {}),
            },
            spanName: `formulai.${flowKey}`,
            requestPreview,
          },
        );
      });
      return {
        content: cacheHit.content,
        usage: {
          model,
          totalTokens: 0,
          cached: true,
          cacheMode: cacheHit.cacheMode,
          similarity: cacheHit.similarity,
        },
        promptVersion: loaded.version,
      };
    }

    if (!options.skipValidation) {
      const validation = await this.guardianService.validatePrompt(
        String(variables.userInput ?? prompt),
      );
      if (!validation.isSafe) {
        throw new BadRequestException(`Request rejected: ${validation.reason}`);
      }
    }

    const structured = options.structuredOutput ?? false;
    const traceContext = buildInvokeFlowTraceContext(flowKey, loaded, options);
    const result = await runWithMlflowTraceContextAsync(traceContext, async () => {
      return structured
        ? await this.invokeModelWithUsage(prompt, options.document, systemPrompt)
        : await this.invokeModelRawWithUsage(
            prompt,
            useJsonFormat,
            options.document,
            options.timeoutMs ?? 120000,
            options.maxTokens,
            systemPrompt,
          );
    });

    await this.semanticCache.store(
      cachePrompt,
      result.content,
      cachePolicy,
      cacheCtx,
      embedding,
    );

    return { ...result, promptVersion: loaded.version };
  }

  async generate(dto: GenerateAIFormDto) {
    if (!this.chatModel) {
      throw new InternalServerErrorException(
        `AI provider (${this.provider}) is not configured. Check your environment variables.`,
      );
    }

    const validation = await this.guardianService.validatePrompt(dto.prompt);
    if (!validation.isSafe) {
      throw new BadRequestException(`Request rejected: ${validation.reason}`);
    }

    const formRules = await this.getSharedSnippet('shared.form_other_rules');
    const flowKey =
      dto.mode === 'refine' && dto.currentForm
        ? 'form_generation.single_shot_refine'
        : 'form_generation.single_shot_create';

    const { content, usage } = await this.invokeFlow(
      flowKey,
      {
        userInput: dto.prompt,
        currentForm: dto.currentForm
          ? JSON.stringify(dto.currentForm, null, 2)
          : '',
        formRules,
      },
      { skipValidation: true, structuredOutput: true, userId: (dto as any).userId },
    );
    const parsed = JSON.parse(content);
    const form = this.validateAndSanitizeForm(parsed);
    return { form, usage };
  }

  /**
   * Generate form with streaming step-by-step RAG process
   */
  async *generateWithSteps(
    dto: GenerateAIFormDto,
    options: { userId?: string } = {},
  ): AsyncGenerator<GenerationStep> {
    yield* this.graphRunner.streamFormGeneration(dto, {
      userId: options.userId ?? (dto as GenerateAIFormDto & { userId?: string }).userId,
    });
  }

  private async invokeModelWithUsage(
    prompt: string,
    document?: { base64: string; mimetype: string; filename?: string },
    systemPrompt?: string,
  ): Promise<{ content: string; usage?: LlmUsage }> {
    if (!this.chatModel) {
      throw new InternalServerErrorException('AI provider not initialized');
    }

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              type: {
                type: 'string',
                enum: [
                  'text',
                  'textarea',
                  'multiple_choice',
                  'checkbox',
                  'dropdown',
                  'email',
                  'number',
                  'date',
                  'time',
                  'rating',
                  'comment',
                ],
              },
              canBeOther: {
                type: 'boolean',
                description:
                  'Whether the question can have a "Other" option instead of other option directly in options list',
              },
              required: { type: 'boolean' },
              options: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'List of options for the question, without "Other" option',
              },
              order: { type: 'number' },
            },
            required: ['id', 'title', 'type', 'required', 'order'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'description', 'questions'],
      additionalProperties: false,
    };

    const structuredModel = this.chatModel.withStructuredOutput(schema, {
      includeRaw: true,
    });
    const input = document
      ? this.buildMessagesWithDocument(prompt, document, systemPrompt)
      : this.buildLlmMessages(prompt, systemPrompt);
    const traceCall = {
      inputs: buildFlowPromptTraceInputs(prompt, systemPrompt),
      requestPreview: buildFlowRequestPreview(prompt, systemPrompt),
    };
    const res = (await runWithActiveMlflowTraceContextAsync(
      async () => {
        const raw = await structuredModel.invoke(input);
        const parsed = raw?.parsed ?? raw;
        const content = JSON.stringify(parsed);
        const usage =
          extractUsageFromResponse(raw?.raw) ?? extractUsageFromResponse(raw);
        return { content, usage };
      },
      traceCall,
    )) as { content: string; usage?: LlmUsage };
    await flushMlflowTraces();
    return res;
  }

  /**
   * Build LangChain message(s) with optional document attachment (multimodal).
   * When document is present, returns [SystemMessage?, HumanMessage] with content array (text + file block).
   */
  private buildMessagesWithDocument(
    prompt: string,
    document: { base64: string; mimetype: string; filename?: string },
    systemPrompt?: string,
  ): (SystemMessage | HumanMessage)[] {
    const filename = document.filename || 'document.pdf';
    const content = [
      { type: 'text', text: prompt },
      {
        type: 'file',
        source_type: 'base64',
        data: document.base64,
        mime_type: document.mimetype,
        filename,
        metadata: { filename, name: filename, title: filename },
      },
    ] as HumanMessage['content'];
    const messages: (SystemMessage | HumanMessage)[] = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(new HumanMessage({ content }));
    return messages;
  }

  private buildLlmMessages(
    prompt: string,
    systemPrompt?: string,
  ): (SystemMessage | HumanMessage)[] {
    const messages: (SystemMessage | HumanMessage)[] = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(new HumanMessage(prompt));
    return messages;
  }

  private async invokeModelRawWithUsage(
    prompt: string,
    useJsonFormat: boolean = true,
    document?: { base64: string; mimetype: string; filename?: string },
    timeoutMs: number = 120000,
    maxTokens?: number,
    systemPrompt?: string,
  ): Promise<{ content: string; usage?: LlmUsage }> {
    if (!this.chatModel) {
      throw new InternalServerErrorException('AI provider not initialized');
    }

    const options = {
      ...(useJsonFormat ? { response_format: { type: 'json_object' } } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    };
    const input = document
      ? this.buildMessagesWithDocument(prompt, document, systemPrompt)
      : this.buildLlmMessages(prompt, systemPrompt);
    const traceCall = {
      inputs: buildFlowPromptTraceInputs(prompt, systemPrompt),
      requestPreview: buildFlowRequestPreview(prompt, systemPrompt),
    };
    type ChatResponse = {
      content: string | unknown[];
      usage_metadata?: unknown;
      response_metadata?: unknown;
      raw?: unknown;
    };
    const model = this.chatModel as {
      invoke: (
        input: string | (SystemMessage | HumanMessage)[],
        options?: Record<string, unknown>,
      ) => Promise<ChatResponse>;
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await runWithActiveMlflowTraceContextAsync(
        async () => {
          const response = await model.invoke(input, {
            ...options,
            signal: controller.signal,
          });
          const content =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          const usage = extractUsageFromResponse(response);
          return { content, usage };
        },
        traceCall,
      );
      clearTimeout(timeoutId);
      await flushMlflowTraces();
      return res;
    } catch (error) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        throw new Error(`AI invoke timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  /**
   * Public method for generic text analysis with JSON response
   * Useful for analytics, topic clustering, etc.
   * @param prompt The prompt to analyze
   * @param skipValidation Set to true for internal/trusted calls (e.g., analytics processing)
   */
  async analyzeText(
    prompt: string,
    skipValidation: boolean = false,
  ): Promise<string> {
    // Security Check - skip for internal/trusted calls
    if (!skipValidation) {
      const validation = await this.guardianService.validatePrompt(prompt);
      if (!validation.isSafe) {
        throw new BadRequestException(`Request rejected: ${validation.reason}`);
      }
    }
    const { content } = await this.invokeModelRawWithUsage(prompt);
    return content;
  }

  /**
   * Analyze text with usage metadata. Use when EE needs to track tokens (e.g. analytics).
   * Defaults to JSON format, but can be disabled for plain-text generations.
   */
  async analyzeTextWithUsage(
    prompt: string,
    skipValidation: boolean = false,
    useJsonFormat: boolean = true,
    maxTokens?: number,
  ): Promise<{ content: string; usage?: LlmUsage }> {
    if (!skipValidation) {
      const validation = await this.guardianService.validatePrompt(prompt);
      if (!validation.isSafe) {
        throw new BadRequestException(`Request rejected: ${validation.reason}`);
      }
    }
    return this.invokeModelRawWithUsage(prompt, useJsonFormat, undefined, 120000, maxTokens);
  }

  /**
   * Batch analyze multiple prompts in parallel with structured JSON output
   * Includes validation and automatic retry for failed responses
   * Works with any LangChain model (OpenAI, Ollama, Anthropic, etc.)
   * @param prompts Array of prompts to analyze
   * @param options Analysis options including concurrency control and optional schema
   * @returns Array of analysis results in the same order as prompts
   */
  async batchAnalyze(
    prompts: string[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      maxConcurrency?: number;
      schema?: any; // JSON Schema for structured output
      maxRetries?: number; // Max retries per failed prompt
      skipValidation?: boolean; // Skip Guardian validation for internal/trusted calls
      timeoutMs?: number; // Max ms per prompt before aborting (default: 120000)
    },
  ): Promise<string[]> {
    if (!this.chatModel) {
      throw new InternalServerErrorException('AI provider not initialized');
    }

    try {
      const maxConcurrency = options?.maxConcurrency ?? 4;
      const maxRetries = options?.maxRetries ?? 2;
      const useStructuredOutput = !!options?.schema;

      // If schema is provided, use withStructuredOutput for better validation
      const modelToUse = useStructuredOutput
        ? this.chatModel.withStructuredOutput(options.schema)
        : this.chatModel;

      // Track results with their original indices
      const results: Array<{
        index: number;
        content: string | null;
        error?: any;
      }> = prompts.map((_, index) => ({ index, content: null }));

      const skipValidation = options?.skipValidation ?? false;

      // Process in waves with retry logic
      for (let i = 0; i < prompts.length; i += maxConcurrency) {
        const batch = prompts.slice(i, i + maxConcurrency);
        const batchIndices = Array.from(
          { length: batch.length },
          (_, idx) => i + idx,
        );

        let safePrompts: string[] = [];
        let safeIndices: number[] = [];

        if (skipValidation) {
          // Skip validation for internal/trusted calls (e.g., analytics processing)
          safePrompts = batch;
          safeIndices = batchIndices;
        } else {
          // Validate batch prompts first
          const validatedBatch = await Promise.all(
            batch.map(async (prompt, idx) => {
              const validation =
                await this.guardianService.validatePrompt(prompt);
              return { prompt, validation, originalIndex: batchIndices[idx] };
            }),
          );

          for (const item of validatedBatch) {
            if (!item.validation.isSafe) {
              // Mark unsafe prompts as handled with an error response
              results[item.originalIndex].content = JSON.stringify({
                error: 'unsafe_content',
                reason: item.validation.reason,
                riskType: item.validation.riskType,
              });
            } else {
              safePrompts.push(item.prompt);
              safeIndices.push(item.originalIndex);
            }
          }
        }

        if (safePrompts.length > 0) {
          await this.processBatchWithRetry(
            safePrompts,
            safeIndices,
            results,
            modelToUse,
            useStructuredOutput,
            options,
            maxRetries,
          );
        }
      }

      // Check if any prompts failed after all retries
      const failed = results.filter((r) => r.content === null);
      if (failed.length > 0) {
        console.error(
          `Failed to process ${failed.length}/${prompts.length} prompts after ${maxRetries} retries`,
        );
        throw new InternalServerErrorException(
          `Failed to process ${failed.length} prompts. First error: ${failed[0].error?.message || 'Unknown error'}`,
        );
      }

      await flushMlflowTraces();
      return results.map((r) => r.content!);
    } catch (error) {
      console.error('Error in batch analysis:', error);
      throw new InternalServerErrorException(
        'Failed to batch analyze text with AI',
      );
    }
  }

  private async processBatchWithRetry(
    batch: string[],
    batchIndices: number[],
    results: Array<{ index: number; content: string | null; error?: any }>,
    modelToUse: any,
    useStructuredOutput: boolean,
    options: any,
    maxRetries: number,
  ): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 120000; // 2 minute default per prompt

    let retryCount = 0;
    let remainingPrompts: Array<{ prompt: string; originalIndex: number }> =
      batch.map((prompt, idx) => ({
        prompt,
        originalIndex: batchIndices[idx],
      }));

    while (remainingPrompts.length > 0 && retryCount <= maxRetries) {
      const batchPromises = remainingPrompts.map(
        async ({ prompt, originalIndex }) => {
          try {
            let response;
            const invokeWithAbortableTimeout = async <T>(
              invokeFn: (signal: AbortSignal) => Promise<T>,
            ): Promise<T> => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
              try {
                const result = await invokeFn(controller.signal);
                clearTimeout(timeoutId);
                return result;
              } catch (err) {
                clearTimeout(timeoutId);
                if (controller.signal.aborted) {
                  throw new Error(`AI invoke timed out after ${timeoutMs}ms`);
                }
                throw err;
              }
            };
            const traceCall = {
              inputs: buildFlowPromptTraceInputs(prompt),
              requestPreview: buildFlowRequestPreview(prompt),
            };
            if (useStructuredOutput) {
              // When using structured output, schema is already bound
              response = await runWithActiveMlflowTraceContextAsync(
                () =>
                  invokeWithAbortableTimeout((signal) =>
                    modelToUse.invoke([new HumanMessage(prompt)], {
                      temperature: options?.temperature ?? 0.3,
                      max_tokens: options?.maxTokens ?? 4000,
                      signal,
                    }),
                  ),
                traceCall,
              );
              // withStructuredOutput returns parsed object, so stringify it
              const content = JSON.stringify(response);

              // Validate it's valid JSON
              JSON.parse(content);

              return { originalIndex, content, success: true };
            } else {
              // Fallback to json_object mode without schema
              response = await runWithActiveMlflowTraceContextAsync(
                () =>
                  invokeWithAbortableTimeout((signal) =>
                    modelToUse.invoke([new HumanMessage(prompt)], {
                      temperature: options?.temperature ?? 0.3,
                      max_tokens: options?.maxTokens ?? 4000,
                      response_format: { type: 'json_object' },
                      signal,
                    }),
                  ),
                traceCall,
              );
              const content =
                typeof response.content === 'string'
                  ? response.content
                  : JSON.stringify(response.content);

              // Validate it's valid JSON
              JSON.parse(content);

              return { originalIndex, content, success: true };
            }
          } catch (error) {
            console.warn(
              `[Retry ${retryCount}/${maxRetries}] Failed to process prompt at index ${originalIndex}:`,
              error.message,
            );
            return { originalIndex, content: null, success: false, error };
          }
        },
      );

      const batchResults = await Promise.all(batchPromises);

      // Update results and prepare retry list
      const failedPrompts: Array<{ prompt: string; originalIndex: number }> =
        [];
      for (const result of batchResults) {
        if (result.success) {
          results[result.originalIndex].content = result.content;
        } else {
          results[result.originalIndex].error = result.error;
          const failedPrompt = remainingPrompts.find(
            (p) => p.originalIndex === result.originalIndex,
          );
          if (failedPrompt) {
            failedPrompts.push(failedPrompt);
          }
        }
      }

      remainingPrompts = failedPrompts;
      if (remainingPrompts.length > 0) {
        retryCount++;
        console.log(
          `Retrying ${remainingPrompts.length} failed prompts (attempt ${retryCount}/${maxRetries})...`,
        );
        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  /** Normalize arbitrary AI JSON into API form shape (ids, options, types). */
  sanitizeAiFormOutput(form: unknown) {
    return this.validateAndSanitizeForm(form);
  }

  private validateAndSanitizeForm(form: any) {
    if (!form?.title || !Array.isArray(form?.questions)) {
      throw new InternalServerErrorException('Invalid form returned by AI');
    }

    const mapType = (t: string): string => {
      const all = [
        'text',
        'textarea',
        'multiple_choice',
        'checkbox',
        'dropdown',
        'email',
        'number',
        'date',
        'time',
        'rating',
        'comment',
      ];
      return all.includes(t) ? t : 'text';
    };

    const questions = form.questions.map((q: any, idx: number) => {
      const questionType = mapType(q.type);
      const needsOptions = ['multiple_choice', 'checkbox', 'dropdown'].includes(
        questionType,
      );
      const options = needsOptions ? q.options || ['Option 1'] : undefined;

      // Ensure "other" option has the correct prefix if canBeOther is true
      let processedOptions = options;
      let canBeOther = q.canBeOther || false;

      if (needsOptions && options && options.length > 0) {
        // Check if any option has the "__OTHER__:" prefix
        const hasOtherOption = options.some((opt: string) =>
          opt.startsWith('__OTHER__:'),
        );

        if (hasOtherOption && !canBeOther) {
          // If prefix exists but canBeOther is false, set canBeOther to true
          canBeOther = true;
        }

        if (canBeOther) {
          // Ensure "other" option is always at the end: move it if it's in the middle
          let opts = options;
          const otherIndex = opts.findIndex((opt: string) =>
            opt.startsWith('__OTHER__:'),
          );
          if (otherIndex >= 0 && otherIndex !== opts.length - 1) {
            const otherOption = opts[otherIndex];
            opts = [
              ...opts.filter((_: string, i: number) => i !== otherIndex),
              otherOption,
            ];
          }

          const lastOption = opts[opts.length - 1];
          const lastIsOther = lastOption.startsWith('__OTHER__:');
          const hasOtherAfterMove = opts.some((opt: string) =>
            opt.startsWith('__OTHER__:'),
          );

          if (!hasOtherAfterMove && !lastIsOther) {
            // No option has the prefix - mark last as "other"
            processedOptions = [
              ...opts.slice(0, -1),
              `__OTHER__:${lastOption}`,
            ];
          } else if (lastIsOther) {
            // Last option has the prefix - extract placeholder from label if needed
            const optionLabel = lastOption.substring('__OTHER__:'.length);
            const placeholderMatch = optionLabel.match(/\(([^)]+)\)/);
            if (placeholderMatch && !q.otherPlaceholder) {
              const extractedPlaceholder = placeholderMatch[1];
              const cleanLabel = optionLabel
                .replace(/\s*\([^)]+\)\s*$/, '')
                .trim();
              processedOptions = [
                ...opts.slice(0, -1),
                `__OTHER__:${cleanLabel}`,
              ];
              (q as any)._extractedPlaceholder = extractedPlaceholder;
            } else {
              processedOptions = opts;
            }
          } else {
            processedOptions = opts;
          }
        } else {
          // Remove prefix if canBeOther is false
          processedOptions = options.map((opt: string) =>
            opt.startsWith('__OTHER__:')
              ? opt.substring('__OTHER__:'.length)
              : opt,
          );
        }
      }

      return {
        id: q.id || `question_${Date.now()}_${idx}`,
        title: q.title || 'Untitled Question',
        description: q.description || undefined,
        type: questionType,
        canBeOther: canBeOther,
        otherPlaceholder: canBeOther
          ? q.otherPlaceholder || (q as any)._extractedPlaceholder || undefined
          : undefined,
        required: typeof q.required === 'boolean' ? q.required : false,
        options: processedOptions,
        order: typeof q.order === 'number' ? q.order : idx,
        validation: q.validation || undefined,
      };
    });

    return {
      title: form.title,
      description: form.description || '',
      questions,
    };
  }
}
