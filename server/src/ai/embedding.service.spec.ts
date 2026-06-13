import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.LLM_EMBEDDING_DIMENSION;
    delete process.env.OLLAMA_EMBEDDING_MODEL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.LOCAL_EMBEDDING_WARMUP;
  });

  it('defaults to local in-process provider with 384 dimensions', () => {
    const service = new EmbeddingService();
    expect(service.getProvider()).toBe('local');
    expect(service.getDimension()).toBe(384);
    expect(service.isAvailable()).toBe(true);
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
    (
      service as unknown as {
        localExtractor: (text: string) => Promise<{ data: Float32Array }>;
      }
    ).localExtractor = jest
      .fn()
      .mockResolvedValue({ data: new Float32Array([0.1, 0.2, 0.3]) });

    const vector = await service.embedQuery('hello');

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
});
