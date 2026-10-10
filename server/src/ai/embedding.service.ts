import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { withEmbeddingSpan } from '../mlflow/mlflow-trace-context';
import {
  resolveEmbeddingDimension,
  resolveEmbeddingModelName,
  resolveEmbeddingProvider,
  resolveLlmProviderConfig,
} from './llm-provider.config';
import { createEmbeddingModel } from './llm-provider.factory';
import type { EmbeddingProviderName } from './llm-provider.types';

export type EmbeddingProvider = EmbeddingProviderName;

type FeatureExtractor = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<{ data: Float32Array | number[] }>;

const DEFAULT_LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private remoteModel: { embedQuery: (text: string) => Promise<number[]> } | null =
    null;
  private localExtractor: FeatureExtractor | null = null;
  private localInitPromise: Promise<void> | null = null;

  constructor() {
    const provider = this.getProvider();
    if (provider === 'openai' || provider === 'mistral' || provider === 'bedrock') {
      this.initializeRemoteEmbeddings(provider);
    }
  }

  onModuleInit(): void {
    if (
      this.getProvider() === 'local' &&
      process.env.LOCAL_EMBEDDING_WARMUP !== 'false'
    ) {
      void this.ensureLocalModel().catch((err) => {
        this.logger.warn(
          `Local embedding warmup failed: ${(err as Error).message}`,
        );
      });
    }
  }

  getProvider(): EmbeddingProvider {
    return resolveEmbeddingProvider();
  }

  getDimension(): number {
    return resolveEmbeddingDimension();
  }

  isAvailable(): boolean {
    switch (this.getProvider()) {
      case 'openai':
      case 'mistral':
      case 'bedrock':
        return this.remoteModel !== null;
      case 'ollama':
        return Boolean(process.env.OLLAMA_BASE_URL || 'http://localhost:11434');
      default:
        return true;
    }
  }

  getModelName(): string {
    return resolveEmbeddingModelName();
  }

  async embedQuery(text: string): Promise<number[]> {
    return withEmbeddingSpan(
      {
        provider: this.getProvider(),
        model: this.getModelName(),
        textLength: text.length,
      },
      () => this.embedQueryInner(text),
    );
  }

  private async embedQueryInner(text: string): Promise<number[]> {
    switch (this.getProvider()) {
      case 'openai':
      case 'mistral':
      case 'bedrock':
        if (!this.remoteModel) {
          throw new Error(`${this.getProvider()} embeddings are not configured`);
        }
        return this.remoteModel.embedQuery(text);
      case 'ollama':
        return this.embedWithOllama(text);
      default:
        return this.embedWithLocalModel(text);
    }
  }

  private async embedWithLocalModel(text: string): Promise<number[]> {
    const extractor = await this.ensureLocalModel();
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return this.tensorToVector(output.data);
  }

  private async ensureLocalModel(): Promise<FeatureExtractor> {
    if (this.localExtractor) {
      return this.localExtractor;
    }
    if (!this.localInitPromise) {
      this.localInitPromise = this.initializeLocalModel();
    }
    await this.localInitPromise;
    if (!this.localExtractor) {
      throw new Error('Local embedding model failed to load');
    }
    return this.localExtractor;
  }

  private async initializeLocalModel(): Promise<void> {
    const model = process.env.LOCAL_EMBEDDING_MODEL || DEFAULT_LOCAL_MODEL;
    const { env, pipeline } = await import('@huggingface/transformers');

    if (process.env.TRANSFORMERS_CACHE) {
      env.cacheDir = process.env.TRANSFORMERS_CACHE;
    }
    env.allowLocalModels = true;
    const wasmThreads = Math.max(
      1,
      parseInt(process.env.LOCAL_EMBEDDING_THREADS || '2', 10),
    );
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.numThreads = wasmThreads;
    }

    this.logger.log(`Loading local CPU embedding model: ${model}`);
    const extractor = await pipeline('feature-extraction', model, {
      device: 'cpu',
      dtype: 'fp32',
    });
    this.localExtractor = extractor as unknown as FeatureExtractor;
    this.logger.log(
      `Local CPU embedding model ready (${this.getDimension()} dimensions)`,
    );
  }

  private tensorToVector(data: Float32Array | number[]): number[] {
    if (Array.isArray(data)) {
      return data;
    }
    return Array.from(data);
  }

  private initializeRemoteEmbeddings(
    provider: 'openai' | 'mistral' | 'bedrock',
  ): void {
    try {
      const llmConfig = resolveLlmProviderConfig({
        ...process.env,
        LLM_PROVIDER: provider,
      });
      this.remoteModel = createEmbeddingModel(llmConfig);
      if (!this.remoteModel && provider !== 'bedrock') {
        const keyName =
          provider === 'mistral' ? 'MISTRAL_API_KEY' : 'OPENAI_API_KEY';
        this.logger.warn(
          `${keyName} not set; ${provider} embeddings unavailable`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to initialize ${provider} embeddings: ${(err as Error).message}`,
      );
    }
  }

  private async embedWithOllama(text: string): Promise<number[]> {
    const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(
      /\/$/,
      '',
    );
    const model =
      process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ollama embeddings failed (${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as { embedding?: number[] };
    if (!payload.embedding?.length) {
      throw new Error('Ollama returned an empty embedding vector');
    }
    return payload.embedding;
  }
}
