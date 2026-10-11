import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { withEmbeddingSpan } from '../mlflow/mlflow-trace-context';

export type EmbeddingProvider = 'local' | 'ollama' | 'openai';
export type EmbeddingRole = 'query' | 'passage';

type FeatureExtractor = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<{ data: Float32Array | number[] }>;

export {
  DEFAULT_LOCAL_DIMENSION,
  DEFAULT_LOCAL_MODEL,
  defaultTopicSimilarityThreshold,
  E5_TOPIC_SIMILARITY_THRESHOLD,
  isE5EmbeddingModel,
  LEGACY_LOCAL_MODEL,
  MINILM_TOPIC_SIMILARITY_THRESHOLD,
  resolveTopicSimilarityThreshold,
} from './local-embedding-defaults';
import {
  DEFAULT_LOCAL_DIMENSION,
  DEFAULT_LOCAL_MODEL,
  isE5EmbeddingModel,
  resolveTopicSimilarityThreshold,
} from './local-embedding-defaults';

const E5_PREFIX: Record<EmbeddingRole, string> = {
  query: 'query: ',
  passage: 'passage: ',
};

/**
 * E5 models expect "query: " / "passage: " prefixes (including non-English).
 * For clustering and other symmetric similarity, official E5 guidance is to
 * use the query prefix on every text. Retrieval uses query vs passage.
 */
export function applyEmbeddingPrefix(
  text: string,
  role: EmbeddingRole,
  model: string,
): string {
  const trimmed = text.trim();
  if (!trimmed || !isE5EmbeddingModel(model)) {
    return trimmed;
  }
  if (/^(query|passage): /i.test(trimmed)) {
    return trimmed;
  }
  return `${E5_PREFIX[role]}${trimmed}`;
}

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private openAiModel: { embedQuery: (text: string) => Promise<number[]> } | null =
    null;
  private localExtractor: FeatureExtractor | null = null;
  private localInitPromise: Promise<void> | null = null;

  constructor() {
    if (this.getProvider() === 'openai') {
      this.initializeOpenAi();
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
    const configured = process.env.EMBEDDING_PROVIDER as
      | EmbeddingProvider
      | undefined;
    if (
      configured === 'local' ||
      configured === 'ollama' ||
      configured === 'openai'
    ) {
      return configured;
    }
    return 'local';
  }

  getDimension(): number {
    const configured = parseInt(process.env.LLM_EMBEDDING_DIMENSION || '', 10);
    if (!Number.isNaN(configured) && configured > 0) {
      return configured;
    }
    switch (this.getProvider()) {
      case 'openai':
        return 1536;
      case 'ollama':
        return 768;
      default:
        return DEFAULT_LOCAL_DIMENSION;
    }
  }

  isAvailable(): boolean {
    switch (this.getProvider()) {
      case 'openai':
        return this.openAiModel !== null;
      case 'ollama':
        return Boolean(process.env.OLLAMA_BASE_URL || 'http://localhost:11434');
      default:
        return true;
    }
  }

  getModelName(): string {
    switch (this.getProvider()) {
      case 'openai':
        return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      case 'ollama':
        return process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
      default:
        return process.env.LOCAL_EMBEDDING_MODEL || DEFAULT_LOCAL_MODEL;
    }
  }

  getTopicSimilarityThreshold(): number {
    return resolveTopicSimilarityThreshold(this.getModelName());
  }

  async embedQuery(text: string): Promise<number[]> {
    return withEmbeddingSpan(
      {
        provider: this.getProvider(),
        model: this.getModelName(),
        textLength: text.length,
      },
      () => this.embedInner(text, 'query'),
    );
  }

  /**
   * Document/passage embedding. E5 local models get a "passage: " prefix.
   * Topic clustering uses {@link embedQuery} (query prefix) because E5
   * treats symmetric similarity / clustering as a query-side task.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedDocument(text)));
  }

  async embedDocument(text: string): Promise<number[]> {
    return withEmbeddingSpan(
      {
        provider: this.getProvider(),
        model: this.getModelName(),
        textLength: text.length,
      },
      () => this.embedInner(text, 'passage'),
    );
  }

  private async embedInner(
    text: string,
    role: EmbeddingRole,
  ): Promise<number[]> {
    switch (this.getProvider()) {
      case 'openai':
        if (!this.openAiModel) {
          throw new Error('OpenAI embeddings are not configured');
        }
        return this.openAiModel.embedQuery(text);
      case 'ollama':
        return this.embedWithOllama(text);
      default:
        return this.embedWithLocalModel(text, role);
    }
  }

  private async embedWithLocalModel(
    text: string,
    role: EmbeddingRole,
  ): Promise<number[]> {
    const extractor = await this.ensureLocalModel();
    const input = applyEmbeddingPrefix(text, role, this.getModelName());
    const output = await extractor(input, {
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

  private initializeOpenAi(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set; OpenAI embeddings unavailable',
      );
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OpenAIEmbeddings } = require('@langchain/openai');
      this.openAiModel = new OpenAIEmbeddings({
        apiKey,
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      });
    } catch (err) {
      this.logger.warn(
        `Failed to initialize OpenAI embeddings: ${(err as Error).message}`,
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
