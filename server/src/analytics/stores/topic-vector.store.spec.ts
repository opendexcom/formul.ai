import { TopicVectorStore } from './topic-vector.store';
import { EmbeddingService } from '../../ai/embedding.service';

describe('TopicVectorStore', () => {
  afterEach(() => {
    delete process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING;
    jest.restoreAllMocks();
  });

  it('topicKeyFromText is stable for equivalent casing', () => {
    process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING = 'false';
    const embeddingService = {
      isAvailable: () => true,
      getDimension: () => 384,
    } as EmbeddingService;
    const store = new TopicVectorStore(embeddingService);

    const a = store.topicKeyFromText('Company Culture');
    const b = store.topicKeyFromText('company culture');
    expect(a).toBe(b);
  });

  it('isAvailable is false when vector clustering disabled', () => {
    process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING = 'false';
    const embeddingService = {
      isAvailable: () => true,
      getDimension: () => 384,
    } as EmbeddingService;
    const store = new TopicVectorStore(embeddingService);
    store.onModuleInit();
    expect(store.isAvailable()).toBe(false);
  });

  it('upsertTopics skips when store unavailable', async () => {
    process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING = 'false';
    const embeddingService = {
      isAvailable: () => true,
      embedQuery: jest.fn(),
      getDimension: () => 384,
    } as unknown as EmbeddingService;
    const store = new TopicVectorStore(embeddingService);
    store.onModuleInit();

    await store.upsertTopics('form1', new Map([['Pay', 3]]));
    expect(embeddingService.embedQuery).not.toHaveBeenCalled();
  });

  it('redisHasSearchModule detects nested MODULE LIST entries (Redis 7+ / Stack)', async () => {
    const embeddingService = {
      isAvailable: () => true,
      getDimension: () => 384,
    } as EmbeddingService;
    const store = new TopicVectorStore(embeddingService);
    const redis = {
      call: jest.fn().mockResolvedValue([
        ['name', 'ReJSON', 'ver', 20808],
        ['name', 'search', 'ver', 21015],
      ]),
    };
    (store as unknown as { redis: typeof redis }).redis = redis;

    const hasSearch = await (
      store as unknown as { redisHasSearchModule: () => Promise<boolean> }
    ).redisHasSearchModule();

    expect(hasSearch).toBe(true);
  });
});
