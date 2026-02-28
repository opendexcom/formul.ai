import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';
import { GuardianService } from './guardian.service';
import { BadRequestException } from '@nestjs/common';
import { LlmUsage } from './llm.types';

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
    totalTokens:
      totalTokens ?? ((promptTokens ?? 0) + (completionTokens ?? 0)),
  };
}

@Injectable()
export class AiService {
  private chatModel: any | null = null;
  private provider: 'openai' | 'ollama' = 'openai';

  constructor(private readonly guardianService: GuardianService) {
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

  async generate(dto: GenerateAIFormDto) {
    if (!this.chatModel) {
      throw new InternalServerErrorException(
        `AI provider (${this.provider}) is not configured. Check your environment variables.`,
      );
    }

    // Security Check
    const validation = await this.guardianService.validatePrompt(dto.prompt);
    if (!validation.isSafe) {
      throw new BadRequestException(`Request rejected: ${validation.reason}`);
    }

    const prompt =
      dto.mode === 'refine' && dto.currentForm
        ? `You are a form builder assistant. The user has a form and wants to refine it.

Current form:
${JSON.stringify(dto.currentForm, null, 2)}

User's refinement request: ${dto.prompt}

Update the form based on the user's request. Adjust questions, add new ones, remove unwanted ones, or modify properties as requested.

IMPORTANT - "Other" Option Support:
- For single choice (multiple_choice), checkbox, and dropdown questions, you can add an "other" option
- To enable "other" option, set canBeOther: true
- When canBeOther is true, the last option in the options array MUST be marked with the special prefix "__OTHER__:" followed by ONLY the label (e.g., "__OTHER__:Other", "__OTHER__:Something else")
- DO NOT include placeholder text in the option label - the label should be clean (e.g., "Other", "Inne", "Something else")
- Set otherPlaceholder field separately for the placeholder text (e.g., "Please specify", "Proszę podać")
- The option label and placeholder are SEPARATE - keep them separate
- If canBeOther is false, ensure no option has the "__OTHER__:" prefix`
        : `You are a form builder assistant. Generate a structured form based on the user's description.

User wants to create: ${dto.prompt}

Guidelines:
- Use appropriate question types based on the context
- For single choice (multiple_choice), checkbox, and dropdown questions, provide relevant options
- Mark important fields as required
- Include 3-10 questions depending on the form's purpose
- Use clear, concise question titles
- Add helpful descriptions where needed

IMPORTANT - "Other" Option Support:
- For single choice (multiple_choice), checkbox, and dropdown questions, you can add an "other" option
- To enable "other" option, set canBeOther: true
- When canBeOther is true, the last option in the options array MUST be marked with the special prefix "__OTHER__:" followed by ONLY the label (e.g., "__OTHER__:Other", "__OTHER__:Something else")
- DO NOT include placeholder text in the option label - use the otherPlaceholder field instead
- The "other" option label should be clean (e.g., "Other", "Something else", "Inne") - do NOT put placeholder text like "(please specify)" in the label
- Set otherPlaceholder field separately for the placeholder text that appears in the input field (e.g., "Please specify", "Proszę podać")
- Example: If you want an "other" option, the options array should end with something like "__OTHER__:Other" and set otherPlaceholder separately

Example question with "other" option:
{
  "id": "q1",
  "title": "What is your favorite color?",
  "type": "multiple_choice",
  "required": false,
  "canBeOther": true,
  "otherPlaceholder": "Please specify your color",
  "options": ["Red", "Blue", "Green", "__OTHER__:Other"],
  "order": 1
}

CRITICAL: The option label and placeholder are SEPARATE fields:
- Option label (in options array): Just the text shown in the list (e.g., "Other", "Inne")
- otherPlaceholder field: The placeholder text for the input field (e.g., "Please specify", "Proszę podać")`;

    const { content, usage } = await this.invokeModelWithUsage(prompt);
    const parsed = JSON.parse(content);
    const form = this.validateAndSanitizeForm(parsed);
    return { form, usage };
  }

  /**
   * Generate form with streaming step-by-step RAG process
   */
  async *generateWithSteps(
    dto: GenerateAIFormDto,
  ): AsyncGenerator<GenerationStep> {
    if (!this.chatModel) {
      throw new InternalServerErrorException(
        `AI provider (${this.provider}) is not configured. Check your environment variables.`,
      );
    }

    // Security Check
    const validation = await this.guardianService.validatePrompt(dto.prompt);
    if (!validation.isSafe) {
      yield {
        step: 'error',
        message: `Security check failed: ${validation.reason}`,
        status: 'error',
      };
      return;
    }

    const currentFormContext = dto.currentForm
      ? `\n\nCurrent form structure:\n${JSON.stringify(dto.currentForm, null, 2)}\n\nThe user wants to refine or modify this existing form.`
      : '\n\nThis is a new form being created from scratch.';

    // Step 1: Analyze request and create strategy
    yield {
      step: 'analyze',
      message: 'Analyzing form requirements...',
      status: 'in-progress',
    };

    const strategyPrompt = `You are a form design strategist. Analyze the user's request and create a strategy for building the form.
${currentFormContext}

User request: ${dto.prompt}

Create a detailed strategy including:
1. Form purpose and target audience
2. Key information to collect
3. Appropriate question types for each data point
4. Validation and UX considerations
${dto.currentForm ? '5. What should be kept, modified, or removed from the existing form' : ''}

Important: Respond ONLY with a valid JSON object (no backticks, no prose). Return a JSON object with this shape: { purpose: string, audience: string, dataPoints: string[], questionTypes: Record<string, string>, considerations: string[]${dto.currentForm ? ', modifications: { keep: string[], modify: string[], remove: string[], add: string[] }' : ''} }`;

    const { content: strategyContent, usage: analyzeUsage } =
      await this.invokeModelRawWithUsage(strategyPrompt);
    const strategy = JSON.parse(strategyContent);

    yield {
      step: 'analyze',
      message: `Strategy created: ${strategy.purpose}`,
      status: 'completed',
      data: strategy,
      usage: analyzeUsage,
    };

    // Step 2: Generate question list
    yield {
      step: 'questions',
      message: 'Preparing questions based on strategy...',
      status: 'in-progress',
    };

    const questionsPrompt = `Based on the following strategy, generate a list of questions.
${currentFormContext}

Strategy: ${JSON.stringify(strategy, null, 2)}
User request: ${dto.prompt}

For each question, specify: title, type, description, whether it's required, options (if applicable), canBeOther (if applicable), and otherPlaceholder (if canBeOther is true).

IMPORTANT - "Other" Option Support:
- For single choice (multiple_choice), checkbox, and dropdown questions, you can add an "other" option when users might need to provide a custom answer
- To enable "other" option, set canBeOther: true
- When canBeOther is true, the last option in the options array MUST be marked with the special prefix "__OTHER__:" followed by ONLY the label (e.g., "__OTHER__:Other", "__OTHER__:Something else")
- DO NOT include placeholder text in the option label - use the otherPlaceholder field instead
- The option label should be clean (e.g., "Other", "Inne", "Something else") - do NOT put "(please specify)" in the label
- Set otherPlaceholder field separately for the placeholder text (e.g., "Please specify", "Proszę podać")
- Example: { "canBeOther": true, "otherPlaceholder": "Please specify", "options": ["Option 1", "Option 2", "__OTHER__:Other"] }
- CRITICAL: Option label and placeholder are SEPARATE fields - keep them separate

${dto.currentForm ? 'Keep questions from the current form that are still relevant, and modify or add new ones as needed.' : ''}
Important: Respond ONLY with a valid JSON array of question objects (no backticks, no prose). Return a JSON array of questions.`;

    const { content: questionsContent, usage: questionsUsage } =
      await this.invokeModelRawWithUsage(questionsPrompt);
    const questionsList = JSON.parse(questionsContent);

    yield {
      step: 'questions',
      message: `Generated ${questionsList.length} questions`,
      status: 'completed',
      data: questionsList,
      usage: questionsUsage,
    };

    // Step 3: Optimize question types
    yield {
      step: 'optimize',
      message: 'Optimizing question types for better UX...',
      status: 'in-progress',
    };

    const optimizePrompt = `Review and optimize these questions for user experience and data collection efficiency.
${currentFormContext}

Questions: ${JSON.stringify(questionsList, null, 2)}
Strategy: ${JSON.stringify(strategy, null, 2)}

Ensure:
- Question types are optimal for the data being collected
- Options are comprehensive and mutually exclusive where needed
- Required fields are appropriate
- Question order flows logically
- For single choice (multiple_choice), checkbox, and dropdown questions, consider adding "other" option (canBeOther: true) when users might need to provide custom answers
- When canBeOther is true, ensure the last option uses "__OTHER__:" prefix (e.g., "__OTHER__:Other")
${dto.currentForm ? '- Changes from the original form are intentional and improve the form' : ''}

IMPORTANT - "Other" Option Format:
- If canBeOther is true, the last option MUST have "__OTHER__:" prefix
- The option label should be clean (e.g., "__OTHER__:Other", "__OTHER__:Something else") - do NOT include placeholder text in the label
- Set otherPlaceholder field separately for the placeholder text (e.g., "Please specify")
- Example: ["Red", "Blue", "__OTHER__:Other"] with otherPlaceholder: "Please specify your color"
- CRITICAL: Keep the option label and placeholder SEPARATE - do not put placeholder text in the option label

Important: Respond ONLY with a valid JSON array of question objects (no backticks, no prose). Return optimized questions as a JSON array.`;

    const { content: optimizedContent, usage: optimizeUsage } =
      await this.invokeModelRawWithUsage(optimizePrompt);
    const optimizedQuestions = JSON.parse(optimizedContent);

    yield {
      step: 'optimize',
      message: 'Questions optimized for better user experience',
      status: 'completed',
      data: optimizedQuestions,
      usage: optimizeUsage,
    };

    // Step 4: Generate final form
    yield {
      step: 'generate',
      message: 'Generating final form structure...',
      status: 'in-progress',
    };

    const finalPrompt = `Create the final form structure.
${currentFormContext}

Purpose: ${strategy.purpose}
Questions: ${JSON.stringify(optimizedQuestions, null, 2)}
User request: ${dto.prompt}

Generate a complete form with:
- A compelling title that reflects the form's purpose
- A clear description explaining what the form collects and why
- The optimized questions list
${dto.currentForm ? '\n- Preserve the original form ID and metadata where applicable' : ''}`;

    const { content: finalContent, usage } =
      await this.invokeModelWithUsage(finalPrompt);
    const parsed = JSON.parse(finalContent);
    const finalForm = this.validateAndSanitizeForm(parsed);

    yield {
      step: 'generate',
      message: 'Form generated successfully!',
      status: 'completed',
      data: finalForm,
      usage,
    };
  }

  private async invokeModelWithUsage(
    prompt: string,
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

    // includeRaw preserves provider metadata (token usage) alongside parsed output
    const structuredModel = this.chatModel.withStructuredOutput(schema, {
      includeRaw: true,
    });
    const res = await structuredModel.invoke(prompt);
    const parsed = res?.parsed ?? res;
    const content = JSON.stringify(parsed);
    const usage =
      extractUsageFromResponse(res?.raw) ?? extractUsageFromResponse(res);
    return { content, usage };
  }

  private async invokeModelRawWithUsage(
    prompt: string,
    useJsonFormat: boolean = true,
  ): Promise<{ content: string; usage?: LlmUsage }> {
    if (!this.chatModel) {
      throw new InternalServerErrorException('AI provider not initialized');
    }

    // For RAG steps, use LangChain with JSON mode for flexibility
    const options = useJsonFormat
      ? { response_format: { type: 'json_object' } }
      : {};
    const res = await this.chatModel.invoke(prompt, options);
    const content =
      typeof res.content === 'string'
        ? res.content
        : JSON.stringify(res.content);
    const usage = extractUsageFromResponse(res);
    return { content, usage };
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
  ): Promise<{ content: string; usage?: LlmUsage }> {
    if (!skipValidation) {
      const validation = await this.guardianService.validatePrompt(prompt);
      if (!validation.isSafe) {
        throw new BadRequestException(`Request rejected: ${validation.reason}`);
      }
    }
    return this.invokeModelRawWithUsage(prompt, useJsonFormat);
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
            if (useStructuredOutput) {
              // When using structured output, schema is already bound
              response = await modelToUse.invoke(prompt, {
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 4000,
              });
              // withStructuredOutput returns parsed object, so stringify it
              const content = JSON.stringify(response);

              // Validate it's valid JSON
              JSON.parse(content);

              return { originalIndex, content, success: true };
            } else {
              // Fallback to json_object mode without schema
              response = await modelToUse.invoke(prompt, {
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 4000,
                response_format: { type: 'json_object' },
              });
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
      ];
      return all.includes(t) ? t : 'text';
    };

    const questions = form.questions.map((q: any, idx: number) => {
      const questionType = mapType(q.type);
      const needsOptions = ['multiple_choice', 'checkbox', 'dropdown'].includes(questionType);
      const options = needsOptions ? (q.options || ['Option 1']) : undefined;
      
      // Ensure "other" option has the correct prefix if canBeOther is true
      let processedOptions = options;
      let canBeOther = q.canBeOther || false;
      
      if (needsOptions && options && options.length > 0) {
        // Check if any option has the "__OTHER__:" prefix
        const hasOtherOption = options.some((opt: string) => opt.startsWith('__OTHER__:'));
        
        if (hasOtherOption && !canBeOther) {
          // If prefix exists but canBeOther is false, set canBeOther to true
          canBeOther = true;
        }
        
        if (canBeOther) {
          // Ensure "other" option is always at the end: move it if it's in the middle
          let opts = options;
          const otherIndex = opts.findIndex((opt: string) => opt.startsWith('__OTHER__:'));
          if (otherIndex >= 0 && otherIndex !== opts.length - 1) {
            const otherOption = opts[otherIndex];
            opts = [...opts.filter((_: string, i: number) => i !== otherIndex), otherOption];
          }

          const lastOption = opts[opts.length - 1];
          const lastIsOther = lastOption.startsWith('__OTHER__:');
          const hasOtherAfterMove = opts.some((opt: string) => opt.startsWith('__OTHER__:'));

          if (!hasOtherAfterMove && !lastIsOther) {
            // No option has the prefix - mark last as "other"
            processedOptions = [...opts.slice(0, -1), `__OTHER__:${lastOption}`];
          } else if (lastIsOther) {
            // Last option has the prefix - extract placeholder from label if needed
            const optionLabel = lastOption.substring('__OTHER__:'.length);
            const placeholderMatch = optionLabel.match(/\(([^)]+)\)/);
            if (placeholderMatch && !q.otherPlaceholder) {
              const extractedPlaceholder = placeholderMatch[1];
              const cleanLabel = optionLabel.replace(/\s*\([^)]+\)\s*$/, '').trim();
              processedOptions = [...opts.slice(0, -1), `__OTHER__:${cleanLabel}`];
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
            opt.startsWith('__OTHER__:') ? opt.substring('__OTHER__:'.length) : opt
          );
        }
      }
      
      return {
        id: q.id || `question_${Date.now()}_${idx}`,
        title: q.title || 'Untitled Question',
        description: q.description || undefined,
        type: questionType,
        canBeOther: canBeOther,
        otherPlaceholder: canBeOther ? (q.otherPlaceholder || (q as any)._extractedPlaceholder || undefined) : undefined,
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
