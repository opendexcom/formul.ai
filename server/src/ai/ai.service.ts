import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GenerateAIFormDto } from './dto/generate-ai-form.dto';

export interface GenerationStep {
  step: string;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  data?: any;
}

@Injectable()
export class AiService {
  private chatModel: any | null = null;
  private provider: 'openai' | 'ollama' = 'openai';

  constructor() {
    // Determine provider from environment
    this.provider = (process.env.LLM_PROVIDER as 'openai' | 'ollama') || 'openai';

    try {
      if (this.provider === 'ollama') {
        this.initializeOllama();
      } else {
        this.initializeOpenAI();
      }
    } catch (e) {
      console.error(`Failed to initialize LangChain with ${this.provider}:`, e);
      throw new InternalServerErrorException('AI service initialization failed');
    }
  }

  private initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not configured. AI service will not be available.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ChatOpenAI } = require('@langchain/openai');
    this.chatModel = new ChatOpenAI({ 
      apiKey, 
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini', 
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
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
      throw new InternalServerErrorException(`AI provider (${this.provider}) is not configured. Check your environment variables.`);
    }

    const prompt = dto.mode === 'refine' && dto.currentForm
      ? `You are a form builder assistant. The user has a form and wants to refine it.

Current form:
${JSON.stringify(dto.currentForm, null, 2)}

User's refinement request: ${dto.prompt}

Update the form based on the user's request. Adjust questions, add new ones, remove unwanted ones, or modify properties as requested.`
      : `You are a form builder assistant. Generate a structured form based on the user's description.

User wants to create: ${dto.prompt}

Guidelines:
- Use appropriate question types based on the context
- For multiple choice, checkbox, and dropdown questions, provide relevant options
- Mark important fields as required
- Include 3-10 questions depending on the form's purpose
- Use clear, concise question titles
- Add helpful descriptions where needed`;

    const content = await this.invokeModel(prompt);
    const parsed = JSON.parse(content);
    return this.validateAndSanitizeForm(parsed);
  }

  /**
   * Generate form with streaming step-by-step RAG process
   */
  async *generateWithSteps(dto: GenerateAIFormDto): AsyncGenerator<GenerationStep> {
    if (!this.chatModel) {
      throw new InternalServerErrorException(`AI provider (${this.provider}) is not configured. Check your environment variables.`);
    }

    const currentFormContext = dto.currentForm 
      ? `\n\nCurrent form structure:\n${JSON.stringify(dto.currentForm, null, 2)}\n\nThe user wants to refine or modify this existing form.`
      : '\n\nThis is a new form being created from scratch.';

    // Step 1: Analyze request and create strategy
    yield { step: 'analyze', message: 'Analyzing form requirements...', status: 'in-progress' };
    
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

    const strategyContent = await this.invokeModelRaw(strategyPrompt);
    const strategy = JSON.parse(strategyContent);
    
    yield { 
      step: 'analyze', 
      message: `Strategy created: ${strategy.purpose}`, 
      status: 'completed',
      data: strategy
    };

    // Step 2: Generate question list
    yield { step: 'questions', message: 'Preparing questions based on strategy...', status: 'in-progress' };
    
  const questionsPrompt = `Based on the following strategy, generate a list of questions.
${currentFormContext}

Strategy: ${JSON.stringify(strategy, null, 2)}
User request: ${dto.prompt}

For each question, specify: title, type, description, whether it's required, and options (if applicable).
${dto.currentForm ? 'Keep questions from the current form that are still relevant, and modify or add new ones as needed.' : ''}
Important: Respond ONLY with a valid JSON array of question objects (no backticks, no prose). Return a JSON array of questions.`;

    const questionsContent = await this.invokeModelRaw(questionsPrompt);
    const questionsList = JSON.parse(questionsContent);
    
    yield { 
      step: 'questions', 
      message: `Generated ${questionsList.length} questions`, 
      status: 'completed',
      data: questionsList
    };

    // Step 3: Optimize question types
    yield { step: 'optimize', message: 'Optimizing question types for better UX...', status: 'in-progress' };
    
  const optimizePrompt = `Review and optimize these questions for user experience and data collection efficiency.
${currentFormContext}

Questions: ${JSON.stringify(questionsList, null, 2)}
Strategy: ${JSON.stringify(strategy, null, 2)}

Ensure:
- Question types are optimal for the data being collected
- Options are comprehensive and mutually exclusive where needed
- Required fields are appropriate
- Question order flows logically
${dto.currentForm ? '- Changes from the original form are intentional and improve the form' : ''}

Important: Respond ONLY with a valid JSON array of question objects (no backticks, no prose). Return optimized questions as a JSON array.`;

    const optimizedContent = await this.invokeModelRaw(optimizePrompt);
    const optimizedQuestions = JSON.parse(optimizedContent);
    
    yield { 
      step: 'optimize', 
      message: 'Questions optimized for better user experience', 
      status: 'completed',
      data: optimizedQuestions
    };

    // Step 4: Generate final form
    yield { step: 'generate', message: 'Generating final form structure...', status: 'in-progress' };
    
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

    const finalContent = await this.invokeModel(finalPrompt);
    const parsed = JSON.parse(finalContent);
    const finalForm = this.validateAndSanitizeForm(parsed);
    
    yield { 
      step: 'generate', 
      message: 'Form generated successfully!', 
      status: 'completed',
      data: finalForm
    };
  }

  private async invokeModel(prompt: string): Promise<string> {
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
                enum: ['text', 'textarea', 'multiple_choice', 'checkbox', 'dropdown', 'email', 'number', 'date', 'time', 'rating']
              },
              required: { type: 'boolean' },
              options: { type: 'array', items: { type: 'string' } },
              order: { type: 'number' }
            },
            required: ['id', 'title', 'type', 'required', 'order'],
            additionalProperties: false
          }
        }
      },
      required: ['title', 'description', 'questions'],
      additionalProperties: false
    };

    // LangChain with structured output
    const structuredModel = this.chatModel.withStructuredOutput(schema);
    const res = await structuredModel.invoke(prompt);
    return JSON.stringify(res);
  }

  private async invokeModelRaw(prompt: string, useJsonFormat: boolean = true): Promise<string> {
    if (!this.chatModel) {
      throw new InternalServerErrorException('AI provider not initialized');
    }

    // For RAG steps, use LangChain with JSON mode for flexibility
    // For plain text responses, don't use JSON mode
    const options = useJsonFormat ? { response_format: { type: 'json_object' } } : {};
    const res = await this.chatModel.invoke(prompt, options);
    return typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  }

  /**
   * Public method for generic text analysis with JSON response
   * Useful for analytics, topic clustering, etc.
   */
  async analyzeText(prompt: string): Promise<string> {
    return this.invokeModelRaw(prompt);
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
      const results: Array<{ index: number; content: string | null; error?: any }> = 
        prompts.map((_, index) => ({ index, content: null }));

      // Process in waves with retry logic
      for (let i = 0; i < prompts.length; i += maxConcurrency) {
        const batch = prompts.slice(i, i + maxConcurrency);
        const batchIndices = Array.from({ length: batch.length }, (_, idx) => i + idx);
        
        await this.processBatchWithRetry(
          batch,
          batchIndices,
          results,
          modelToUse,
          useStructuredOutput,
          options,
          maxRetries
        );
      }

      // Check if any prompts failed after all retries
      const failed = results.filter(r => r.content === null);
      if (failed.length > 0) {
        console.error(`Failed to process ${failed.length}/${prompts.length} prompts after ${maxRetries} retries`);
        throw new InternalServerErrorException(
          `Failed to process ${failed.length} prompts. First error: ${failed[0].error?.message || 'Unknown error'}`
        );
      }

      return results.map(r => r.content!);
    } catch (error) {
      console.error('Error in batch analysis:', error);
      throw new InternalServerErrorException('Failed to batch analyze text with AI');
    }
  }

  private async processBatchWithRetry(
    batch: string[],
    batchIndices: number[],
    results: Array<{ index: number; content: string | null; error?: any }>,
    modelToUse: any,
    useStructuredOutput: boolean,
    options: any,
    maxRetries: number
  ): Promise<void> {
    let retryCount = 0;
    let remainingPrompts: Array<{ prompt: string; originalIndex: number }> = 
      batch.map((prompt, idx) => ({ prompt, originalIndex: batchIndices[idx] }));

    while (remainingPrompts.length > 0 && retryCount <= maxRetries) {
      const batchPromises = remainingPrompts.map(async ({ prompt, originalIndex }) => {
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
              response_format: { type: 'json_object' }
            });
            const content = typeof response.content === 'string' 
              ? response.content 
              : JSON.stringify(response.content);
            
            // Validate it's valid JSON
            JSON.parse(content);
            
            return { originalIndex, content, success: true };
          }
        } catch (error) {
          console.warn(`[Retry ${retryCount}/${maxRetries}] Failed to process prompt at index ${originalIndex}:`, error.message);
          return { originalIndex, content: null, success: false, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Update results and prepare retry list
      const failedPrompts: Array<{ prompt: string; originalIndex: number }> = [];
      for (const result of batchResults) {
        if (result.success) {
          results[result.originalIndex].content = result.content;
        } else {
          results[result.originalIndex].error = result.error;
          const failedPrompt = remainingPrompts.find(p => p.originalIndex === result.originalIndex);
          if (failedPrompt) {
            failedPrompts.push(failedPrompt);
          }
        }
      }

      remainingPrompts = failedPrompts;
      if (remainingPrompts.length > 0) {
        retryCount++;
        console.log(`Retrying ${remainingPrompts.length} failed prompts (attempt ${retryCount}/${maxRetries})...`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  private validateAndSanitizeForm(form: any) {
    if (!form?.title || !Array.isArray(form?.questions)) {
      throw new InternalServerErrorException('Invalid form returned by AI');
    }

    const mapType = (t: string): string => {
      const all = [
        'text','textarea','multiple_choice','checkbox','dropdown','email','number','date','time','rating'
      ];
      return all.includes(t) ? t : 'text';
    };

    const questions = form.questions.map((q: any, idx: number) => ({
      id: q.id || `question_${Date.now()}_${idx}`,
      title: q.title || 'Untitled Question',
      description: q.description || undefined,
      type: mapType(q.type),
      required: typeof q.required === 'boolean' ? q.required : false,
      options: ['multiple_choice','checkbox','dropdown'].includes(mapType(q.type)) ? (q.options || ['Option 1']) : undefined,
      order: typeof q.order === 'number' ? q.order : idx,
      validation: q.validation || undefined,
    }));

    return {
      title: form.title,
      description: form.description || '',
      questions,
    };
  }
}
