import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { CacheContext, CachePolicy } from '../mlflow/mlflow.types';

export interface CacheLookupResult {
  content: string;
  cacheMode: 'exact' | 'semantic';
  similarity?: number;
}

@Injectable()
export class SemanticLlmCacheService implements OnModuleInit {
  private readonly logger = new Logger(SemanticLlmCacheService.name);
  private redis: Redis | null = null;
  private vectorIndexReady = false;

  onModuleInit(): void {
    if (process.env.LLM_SEMANTIC_CACHE_ENABLED === 'false') {
      this.logger.log('Semantic LLM cache disabled');
      return;
    }
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({ host, port, maxRetriesPerRequest: 3 });
    void this.ensureVectorIndex();
  }

  isEnabled(): boolean {
    return (
      process.env.LLM_SEMANTIC_CACHE_ENABLED !== 'false' && this.redis !== null
    );
  }

  private getEmbeddingDimension(): number {
    const configured = parseInt(process.env.LLM_EMBEDDING_DIMENSION || '', 10);
    if (!Number.isNaN(configured) && configured > 0) {
      return configured;
    }
    const provider = process.env.EMBEDDING_PROVIDER || 'local';
    switch (provider) {
      case 'openai':
        return 1536;
      case 'ollama':
        return 768;
      default:
        return 384;
    }
  }

  private async ensureVectorIndex(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.call(
        'FT.CREATE',
        'llm_cache_idx',
        'ON',
        'HASH',
        'PREFIX',
        '1',
        'llmcache:',
        'SCHEMA',
        'embedding',
        'VECTOR',
        'HNSW',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        String(this.getEmbeddingDimension()),
        'DISTANCE_METRIC',
        'COSINE',
        'flow_key',
        'TAG',
        'scope_id',
        'TAG',
        'prompt_version',
        'TAG',
        'response',
        'TEXT',
      );
      this.vectorIndexReady = true;
    } catch (err: any) {
      if (String(err?.message).includes('Index already exists')) {
        this.vectorIndexReady = true;
      } else {
        this.logger.warn(
          `Vector index unavailable (exact cache still works): ${err?.message}`,
        );
      }
    }
  }

  private exactKey(ctx: CacheContext, prompt: string): string {
    const hash = createHash('sha256')
      .update(
        [ctx.flowKey, ctx.scopeId, ctx.promptVersion, ctx.model, String(ctx.useJsonFormat), prompt].join('|'),
      )
      .digest('hex');
    return `llmcache:exact:${hash}`;
  }

  async lookup(
    prompt: string,
    policy: CachePolicy,
    ctx: CacheContext,
    embedding?: number[],
  ): Promise<CacheLookupResult | null> {
    if (!this.isEnabled() || !policy.enabled || policy.scope === 'none') {
      return null;
    }

    if (policy.mode === 'exact') {
      const key = this.exactKey(ctx, prompt);
      const hit = await this.redis!.get(key);
      if (hit) {
        return { content: hit, cacheMode: 'exact' };
      }
      return null;
    }

    if (!this.vectorIndexReady || !embedding?.length) {
      return null;
    }

    const buffer = Buffer.alloc(embedding.length * 4);
    embedding.forEach((v, i) => buffer.writeFloatLE(v, i * 4));
    const filter = `@flow_key:{${this.escapeTag(ctx.flowKey)}} @scope_id:{${this.escapeTag(ctx.scopeId)}} @prompt_version:{${this.escapeTag(ctx.promptVersion)}}`;

    try {
      const result = (await this.redis!.call(
        'FT.SEARCH',
        'llm_cache_idx',
        `(${filter})=>[KNN 1 @embedding $BLOB AS score]`,
        'PARAMS',
        '2',
        'BLOB',
        buffer,
        'SORTBY',
        'score',
        'RETURN',
        '2',
        'response',
        'score',
        'LIMIT',
        '0',
        '1',
      )) as unknown[];

      if (!Array.isArray(result) || result.length < 4) {
        return null;
      }
      const fields = result[2] as string[];
      const responseIdx = fields.indexOf('response');
      const scoreIdx = fields.indexOf('score');
      if (responseIdx === -1) return null;
      const content = fields[responseIdx + 1];
      const distance = scoreIdx >= 0 ? parseFloat(fields[scoreIdx + 1]) : 1;
      const similarity = 1 - distance;
      if (similarity >= (policy.similarity ?? 0.95)) {
        return { content, cacheMode: 'semantic', similarity };
      }
    } catch (err) {
      this.logger.warn(`Semantic cache lookup failed: ${(err as Error).message}`);
    }
    return null;
  }

  async store(
    prompt: string,
    response: string,
    policy: CachePolicy,
    ctx: CacheContext,
    embedding?: number[],
  ): Promise<void> {
    if (!this.isEnabled() || !policy.enabled || policy.scope === 'none') {
      return;
    }

    const ttl = policy.ttl_seconds ?? parseInt(
      process.env.LLM_SEMANTIC_CACHE_TTL_SECONDS || '86400',
      10,
    );

    if (policy.mode === 'exact') {
      const key = this.exactKey(ctx, prompt);
      await this.redis!.setex(key, ttl, response);
      return;
    }

    if (!this.vectorIndexReady || !embedding?.length) return;

    const id = createHash('sha256')
      .update(`${ctx.flowKey}:${ctx.scopeId}:${Date.now()}:${Math.random()}`)
      .digest('hex');
    const key = `llmcache:${id}`;
    const buffer = Buffer.alloc(embedding.length * 4);
    embedding.forEach((v, i) => buffer.writeFloatLE(v, i * 4));

    await this.redis!.hset(key, {
      flow_key: ctx.flowKey,
      scope_id: ctx.scopeId,
      prompt_version: ctx.promptVersion,
      response,
      embedding: buffer,
    });
    await this.redis!.expire(key, ttl);
  }

  resolveScopeId(
    policy: CachePolicy,
    options: {
      userId?: string;
      formId?: string;
      documentHash?: string;
      cacheScopeId?: string;
    },
  ): string {
    if (options.cacheScopeId) return options.cacheScopeId;
    switch (policy.scope) {
      case 'user':
        return options.userId ?? 'anonymous';
      case 'form':
        return options.formId ?? 'unknown-form';
      case 'user_document':
        return `${options.userId ?? 'anonymous'}:${options.documentHash ?? 'no-doc'}`;
      case 'global':
        return 'global';
      default:
        return 'none';
    }
  }

  private escapeTag(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
