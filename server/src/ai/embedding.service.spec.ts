import {
  applyEmbeddingPrefix,
  DEFAULT_LOCAL_DIMENSION,
  DEFAULT_LOCAL_MODEL,
  E5_TOPIC_SIMILARITY_THRESHOLD,
  EmbeddingService,
  isE5EmbeddingModel,
  LEGACY_LOCAL_MODEL,
  MINILM_TOPIC_SIMILARITY_THRESHOLD,
  resolveTopicSimilarityThreshold,
} from './embedding.service';

describe('EmbeddingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.LLM_EMBEDDING_DIMENSION;
    delete process.env.OLLAMA_EMBEDDING_MODEL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.LOCAL_EMBEDDING_WARMUP;
    delete process.env.LOCAL_EMBEDDING_MODEL;
    delete process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD;
  });

  it('uses a per-model topic similarity threshold unless env overrides', () => {
    expect(resolveTopicSimilarityThreshold(DEFAULT_LOCAL_MODEL)).toBe(0.9);
    expect(resolveTopicSimilarityThreshold(LEGACY_LOCAL_MODEL)).toBe(0.82);
    expect(E5_TOPIC_SIMILARITY_THRESHOLD).toBe(0.9);
    expect(MINILM_TOPIC_SIMILARITY_THRESHOLD).toBe(0.82);

    const e5 = new EmbeddingService();
    expect(e5.getTopicSimilarityThreshold()).toBe(0.9);

    process.env.LOCAL_EMBEDDING_MODEL = LEGACY_LOCAL_MODEL;
    const minilm = new EmbeddingService();
    expect(minilm.getTopicSimilarityThreshold()).toBe(0.82);

    process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD = '0.77';
    expect(e5.getTopicSimilarityThreshold()).toBe(0.77);
    expect(resolveTopicSimilarityThreshold(DEFAULT_LOCAL_MODEL)).toBe(0.77);
  });

  it('defaults to multilingual e5-small with 384 dimensions (same as MiniLM)', () => {
    const service = new EmbeddingService();
    expect(service.getProvider()).toBe('local');
    expect(service.getModelName()).toBe('Xenova/multilingual-e5-small');
    expect(service.getModelName()).toBe(DEFAULT_LOCAL_MODEL);
    expect(service.getDimension()).toBe(384);
    expect(service.getDimension()).toBe(DEFAULT_LOCAL_DIMENSION);
    expect(DEFAULT_LOCAL_DIMENSION).toBe(384);
    expect(LEGACY_LOCAL_MODEL).toBe('Xenova/all-MiniLM-L6-v2');
    expect(service.isAvailable()).toBe(true);
  });

  it('applies e5 query/passage prefixes only for e5-family models', () => {
    expect(isE5EmbeddingModel(DEFAULT_LOCAL_MODEL)).toBe(true);
    expect(isE5EmbeddingModel(LEGACY_LOCAL_MODEL)).toBe(false);
    expect(applyEmbeddingPrefix('hello', 'query', DEFAULT_LOCAL_MODEL)).toBe(
      'query: hello',
    );
    expect(applyEmbeddingPrefix('hello', 'passage', DEFAULT_LOCAL_MODEL)).toBe(
      'passage: hello',
    );
    expect(applyEmbeddingPrefix('query: already', 'query', DEFAULT_LOCAL_MODEL)).toBe(
      'query: already',
    );
    expect(applyEmbeddingPrefix('hello', 'query', LEGACY_LOCAL_MODEL)).toBe(
      'hello',
    );
  });

  it('uses openai dimensions when configured', () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    const service = new EmbeddingService();
    expect(service.getProvider()).toBe('openai');
    expect(service.getDimension()).toBe(1536);
  });

  it('embeds locally without network calls', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(
      new Error('fetch should not be called for local embeddings'),
    );

    const service = new EmbeddingService();
    const extractor = jest
      .fn()
      .mockResolvedValue({ data: new Float32Array([0.1, 0.2, 0.3]) });
    (
      service as unknown as {
        localExtractor: typeof extractor;
      }
    ).localExtractor = extractor;

    const vector = await service.embedQuery('hello');

    expect(extractor).toHaveBeenCalledWith(
      'query: hello',
      expect.objectContaining({ pooling: 'mean', normalize: true }),
    );
    expect(vector).toHaveLength(3);
    expect(vector[0]).toBeCloseTo(0.1);
    expect(vector[1]).toBeCloseTo(0.2);
    expect(vector[2]).toBeCloseTo(0.3);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('calls Ollama only when explicitly configured', async () => {
    process.env.EMBEDDING_PROVIDER = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.4, 0.5] }),
    }) as typeof fetch;

    const service = new EmbeddingService();
    const vector = await service.embedQuery('hello');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/embeddings',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vector).toEqual([0.4, 0.5]);
  });

  it('does not prefix MiniLM local inputs', async () => {
    process.env.LOCAL_EMBEDDING_MODEL = LEGACY_LOCAL_MODEL;
    const service = new EmbeddingService();
    const extractor = jest
      .fn()
      .mockResolvedValue({ data: new Float32Array([0.1, 0.2, 0.3]) });
    (
      service as unknown as {
        localExtractor: typeof extractor;
      }
    ).localExtractor = extractor;

    await service.embedQuery('hello');
    await service.embedDocument('doc');

    expect(extractor).toHaveBeenNthCalledWith(
      1,
      'hello',
      expect.objectContaining({ pooling: 'mean', normalize: true }),
    );
    expect(extractor).toHaveBeenNthCalledWith(
      2,
      'doc',
      expect.objectContaining({ pooling: 'mean', normalize: true }),
    );
  });

  it('prefixes e5 document embeddings with passage:', async () => {
    const service = new EmbeddingService();
    const extractor = jest
      .fn()
      .mockResolvedValue({ data: new Float32Array([0.1, 0.2, 0.3]) });
    (
      service as unknown as {
        localExtractor: typeof extractor;
      }
    ).localExtractor = extractor;

    const [vector] = await service.embedDocuments(['skarga']);
    expect(extractor).toHaveBeenCalledWith(
      'passage: skarga',
      expect.objectContaining({ pooling: 'mean', normalize: true }),
    );
    expect(vector).toHaveLength(3);
  });
});
