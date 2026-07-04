import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { EmbeddingService } from '../../ai/embedding.service';
import { normalizeTopicKey } from '../utils/topic-vector-cluster.util';

export interface StoredTopicRecord {
  topicKey: string;
  topicText: string;
  formId: string;
  responseCount: number;
  clusterId?: string;
  canonicalLabel?: string;
  embedding: number[];
}

const INDEX_NAME = 'analytics_topics_idx';
const KEY_PREFIX = 'analyticstopic:';

@Injectable()
export class TopicVectorStore implements OnModuleInit {
  private readonly logger = new Logger(TopicVectorStore.name);
  private redis: Redis | null = null;
  private vectorIndexReady = false;
  private vectorIndexInitPromise: Promise<boolean> | null = null;
  private warnedMissingSearchModule = false;

  constructor(private readonly embeddingService: EmbeddingService) {}

  onModuleInit(): void {
    if (process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING === 'false') {
      this.logger.log('Topic vector clustering disabled');
      return;
    }
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({ host, port, maxRetriesPerRequest: 3 });
    void this.prepareForClustering();
  }

  isAvailable(): boolean {
    return (
      process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING !== 'false' &&
      this.redis !== null &&
      this.vectorIndexReady &&
      this.embeddingService.isAvailable()
    );
  }

  /** Ensures RediSearch index exists; safe to call before clustering. */
  async prepareForClustering(): Promise<boolean> {
    if (process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING === 'false') {
      return false;
    }
    if (this.vectorIndexReady && this.embeddingService.isAvailable()) {
      return true;
    }
    if (this.vectorIndexInitPromise) {
      return this.vectorIndexInitPromise;
    }

    this.vectorIndexInitPromise = this.ensureVectorIndex();
    try {
      return await this.vectorIndexInitPromise;
    } finally {
      this.vectorIndexInitPromise = null;
    }
  }

  topicKeyFromText(topicText: string): string {
    return createHash('sha256')
      .update(normalizeTopicKey(topicText))
      .digest('hex')
      .slice(0, 32);
  }

  private redisKey(formId: string, topicKey: string): string {
    return `${KEY_PREFIX}${this.escapeTag(formId)}:${topicKey}`;
  }

  private getEmbeddingDimension(): number {
    return this.embeddingService.getDimension();
  }

  private embeddingToBuffer(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4);
    embedding.forEach((v, i) => buffer.writeFloatLE(v, i * 4));
    return buffer;
  }

  private bufferToEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i));
    }
    return embedding;
  }

  private escapeTag(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private async redisHasSearchModule(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const modules = (await this.redis.call('MODULE', 'LIST')) as unknown[];
      return modules.some((entry) => this.moduleEntryHasSearch(entry));
    } catch {
      return false;
    }
  }

  /** Redis 7+ returns MODULE LIST as an array of per-module kv arrays. */
  private moduleEntryHasSearch(entry: unknown): boolean {
    if (!Array.isArray(entry)) return false;
    for (let i = 0; i < entry.length; i += 2) {
      const key = String(entry[i] ?? '').toLowerCase();
      const value = String(entry[i + 1] ?? '').toLowerCase();
      if (key === 'name' && (value.includes('search') || value.includes('redisearch'))) {
        return true;
      }
    }
    return false;
  }

  private warnMissingSearchModule(): void {
    if (this.warnedMissingSearchModule) return;
    this.warnedMissingSearchModule = true;
    this.logger.warn(
      'Redis RediSearch module not available — topic clustering will fall back to LLM batch mapping. ' +
        'Use Redis Stack (docker compose service `redis`, image redis/redis-stack-server) and recreate the container if you previously ran plain Redis.',
    );
  }

  private async ensureVectorIndex(): Promise<boolean> {
    if (!this.redis) return false;
    if (this.vectorIndexReady) return true;

    if (!(await this.redisHasSearchModule())) {
      this.warnMissingSearchModule();
      return false;
    }

    if (!this.embeddingService.isAvailable()) {
      return false;
    }

    try {
      await this.redis.call(
        'FT.CREATE',
        INDEX_NAME,
        'ON',
        'HASH',
        'PREFIX',
        '1',
        KEY_PREFIX,
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
        'form_id',
        'TAG',
        'topic_key',
        'TAG',
        'topic_text',
        'TEXT',
        'response_count',
        'NUMERIC',
        'cluster_id',
        'TAG',
        'canonical_label',
        'TEXT',
      );
      this.vectorIndexReady = true;
      this.logger.log(
        `Topic vector index ready (${INDEX_NAME}, dim=${this.getEmbeddingDimension()})`,
      );
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Index already exists')) {
        this.vectorIndexReady = true;
        return true;
      }
      this.logger.warn(`Topic vector index unavailable: ${message}`);
      return false;
    }
  }

  async upsertTopic(
    formId: string,
    topicText: string,
    responseCountDelta = 1,
  ): Promise<StoredTopicRecord | null> {
    if (!this.redis || !topicText.trim()) return null;

    const topicKey = this.topicKeyFromText(topicText);
    const key = this.redisKey(formId, topicKey);
    const existing = await this.redis.hgetall(key);

    if (existing?.embedding) {
      const currentCount = parseInt(existing.response_count || '0', 10);
      await this.redis.hset(key, {
        response_count: String(currentCount + responseCountDelta),
        topic_text: topicText.trim(),
      });
      return this.parseRecord(key, existing, topicText, currentCount + responseCountDelta);
    }

    if (!this.embeddingService.isAvailable()) {
      return null;
    }

    const embedding = await this.embeddingService.embedQuery(topicText.trim());
    await this.redis.hset(key, {
      form_id: this.escapeTag(formId),
      topic_key: topicKey,
      topic_text: topicText.trim(),
      response_count: String(responseCountDelta),
      cluster_id: '',
      canonical_label: '',
      embedding: this.embeddingToBuffer(embedding),
    });

    return {
      topicKey,
      topicText: topicText.trim(),
      formId,
      responseCount: responseCountDelta,
      embedding,
    };
  }

  async upsertTopics(
    formId: string,
    topicCounts: Map<string, number>,
  ): Promise<void> {
    if (topicCounts.size === 0) return;
    if (!(await this.prepareForClustering())) return;

    for (const [topicText, count] of topicCounts.entries()) {
      await this.upsertTopic(formId, topicText, count);
    }
  }

  async getAllTopics(formId: string): Promise<StoredTopicRecord[]> {
    if (!this.redis) return [];

    const pattern = `${KEY_PREFIX}${this.escapeTag(formId)}:*`;
    const keys = await this.scanKeys(pattern);
    const records: StoredTopicRecord[] = [];

    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      const record = this.parseRecordFromHash(key, data);
      if (record) records.push(record);
    }

    return records;
  }

  async findSimilar(
    formId: string,
    embedding: number[],
    k: number,
    minSimilarity?: number,
  ): Promise<Array<StoredTopicRecord & { similarity: number }>> {
    if (!embedding.length) return [];
    if (!(await this.prepareForClustering())) return [];

    const threshold =
      minSimilarity ??
      parseFloat(process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD ?? '0.82');
    const buffer = this.embeddingToBuffer(embedding);
    const filter = `@form_id:{${this.escapeTag(formId)}}`;

    try {
      const result = (await this.redis!.call(
        'FT.SEARCH',
        INDEX_NAME,
        `(${filter})=>[KNN ${k} @embedding $BLOB AS score]`,
        'PARAMS',
        '2',
        'BLOB',
        buffer,
        'SORTBY',
        'score',
        'RETURN',
        '7',
        'topic_key',
        'topic_text',
        'response_count',
        'cluster_id',
        'canonical_label',
        'form_id',
        'score',
        'LIMIT',
        '0',
        k,
      )) as unknown[];

      if (!Array.isArray(result) || result.length < 2) return [];

      const total = result[0] as number;
      if (total === 0) return [];

      const matches: Array<StoredTopicRecord & { similarity: number }> = [];
      for (let i = 1; i < result.length; i += 2) {
        const docKey = result[i] as string;
        const fields = result[i + 1] as string[];
        const fieldMap = this.fieldsToMap(fields);
        const distance = parseFloat(fieldMap.score ?? '1');
        const similarity = 1 - distance;
        if (similarity < threshold) continue;

        const hash = await this.redis!.hgetall(docKey);
        const record = this.parseRecordFromHash(docKey, hash);
        if (record) {
          matches.push({ ...record, similarity });
        }
      }
      return matches;
    } catch (err) {
      this.logger.warn(
        `Topic similarity search failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  async assignCluster(
    formId: string,
    topicKey: string,
    clusterId: string,
    canonicalLabel: string,
  ): Promise<void> {
    if (!this.redis) return;
    const key = this.redisKey(formId, topicKey);
    await this.redis.hset(key, {
      cluster_id: clusterId,
      canonical_label: canonicalLabel,
    });
  }

  async clearForm(formId: string): Promise<void> {
    if (!this.redis) return;
    const pattern = `${KEY_PREFIX}${this.escapeTag(formId)}:*`;
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    if (!this.redis) return [];
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  private fieldsToMap(fields: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }
    return map;
  }

  private parseRecordFromHash(
    key: string,
    data: Record<string, string>,
  ): StoredTopicRecord | null {
    if (!data?.topic_key || !data?.embedding) return null;
    const embeddingBuffer = Buffer.isBuffer(data.embedding)
      ? data.embedding
      : Buffer.from(data.embedding);
    return {
      topicKey: data.topic_key,
      topicText: data.topic_text || '',
      formId: data.form_id || '',
      responseCount: parseInt(data.response_count || '0', 10),
      clusterId: data.cluster_id || undefined,
      canonicalLabel: data.canonical_label || undefined,
      embedding: this.bufferToEmbedding(embeddingBuffer),
    };
  }

  private parseRecord(
    key: string,
    data: Record<string, string>,
    topicText: string,
    responseCount: number,
  ): StoredTopicRecord | null {
    if (!data?.embedding) return null;
    const embeddingBuffer = Buffer.isBuffer(data.embedding)
      ? data.embedding
      : Buffer.from(data.embedding);
    const parts = key.split(':');
    const topicKey = parts[parts.length - 1];
    return {
      topicKey,
      topicText,
      formId: parts[1] || '',
      responseCount,
      clusterId: data.cluster_id || undefined,
      canonicalLabel: data.canonical_label || undefined,
      embedding: this.bufferToEmbedding(embeddingBuffer),
    };
  }
}
