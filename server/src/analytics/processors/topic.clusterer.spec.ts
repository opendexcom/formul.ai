import { TopicClusterer } from './topic.clusterer';
import { Types } from 'mongoose';

describe('TopicClusterer', () => {
  const formId = new Types.ObjectId();

  afterEach(() => {
    delete process.env.ANALYTICS_TOPIC_VECTOR_CLUSTERING;
    delete process.env.ANALYTICS_TOPIC_LLM_LABEL_CLUSTERS;
    jest.restoreAllMocks();
  });

  function createClusterer(options: {
    vectorAvailable?: boolean;
    distinctTopics?: string[];
    topicCounts?: Map<string, number>;
    storedTopics?: Array<{
      topicKey: string;
      topicText: string;
      responseCount: number;
      embedding: number[];
    }>;
    similarByKey?: Record<string, Array<{ topicKey: string; similarity: number }>>;
  }) {
    const aiService = {
      invokeFlow: jest.fn().mockResolvedValue({
        content: JSON.stringify({ mapping: { pay: 'Compensation' } }),
      }),
    };

    const topicVectorStore = {
      isAvailable: () => options.vectorAvailable ?? false,
      upsertTopics: jest.fn().mockResolvedValue(undefined),
      upsertTopic: jest.fn().mockResolvedValue(null),
      topicKeyFromText: (text: string) =>
        text.trim().toLowerCase().replace(/\s+/g, '_'),
      getAllTopics: jest.fn().mockResolvedValue(
        (options.storedTopics ?? []).map((t) => ({
          ...t,
          formId: formId.toString(),
        })),
      ),
      findSimilar: jest.fn().mockImplementation(
        (_formId: string, embedding: number[]) => {
          const key = options.storedTopics?.find(
            (t) =>
              t.embedding.length === embedding.length &&
              t.embedding.every((v, i) => v === embedding[i]),
          )?.topicKey;
          if (!key || !options.similarByKey?.[key]) return Promise.resolve([]);
          return Promise.resolve(
            options.similarByKey[key].map((m) => ({
              topicKey: m.topicKey,
              topicText: m.topicKey,
              responseCount: 1,
              formId: formId.toString(),
              embedding: [0],
              similarity: m.similarity,
            })),
          );
        },
      ),
      assignCluster: jest.fn().mockResolvedValue(undefined),
    };

    const responseModel = {
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      }),
      distinct: jest.fn().mockReturnValue(
        Promise.resolve(options.distinctTopics ?? ['Pay', 'Salary']),
      ),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(
          Array.from(options.topicCounts ?? new Map([['Pay', 2], ['Salary', 1]])).map(
            ([topic, count]) => ({ _id: topic, count }),
          ),
        ),
      }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            cursor: jest.fn().mockImplementation(async function* () {
              yield {
                _id: new Types.ObjectId(),
                metadata: { allTopics: ['Pay', 'Salary'] },
              };
            }),
          }),
        }),
      }),
      bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const clusterer = new TopicClusterer(
      aiService as any,
      topicVectorStore as any,
      responseModel as any,
      {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ questions: [] }),
          }),
        }),
      } as any,
    );

    return { clusterer, aiService, topicVectorStore, responseModel };
  }

  it('falls back to LLM batch mapping when vector store unavailable', async () => {
    const { clusterer, aiService } = createClusterer({ vectorAvailable: false });

    const result = await clusterer.clusterAndStoreCanonicalTopics(
      formId,
      'task-1',
      jest.fn(),
    );

    expect(aiService.invokeFlow).toHaveBeenCalledWith(
      'analytics.topic_clustering_batch',
      expect.any(Object),
      expect.any(Object),
    );
    expect(result.canonicalTopics.length).toBeGreaterThan(0);
  });

  it('clusters similar topics via vector graph without LLM batch fallback', async () => {
    process.env.ANALYTICS_TOPIC_LLM_LABEL_CLUSTERS = 'false';

    const storedTopics = [
      {
        topicKey: 'company_culture',
        topicText: 'Company Culture',
        responseCount: 3,
        embedding: [1, 0],
      },
      {
        topicKey: 'workplace_culture',
        topicText: 'Workplace Culture',
        responseCount: 2,
        embedding: [0.99, 0.01],
      },
      {
        topicKey: 'compensation',
        topicText: 'Compensation',
        responseCount: 1,
        embedding: [0, 1],
      },
    ];

    const { clusterer, aiService } = createClusterer({
      vectorAvailable: true,
      distinctTopics: ['Company Culture', 'Workplace Culture', 'Compensation'],
      topicCounts: new Map([
        ['Company Culture', 3],
        ['Workplace Culture', 2],
        ['Compensation', 1],
      ]),
      storedTopics,
      similarByKey: {
        company_culture: [{ topicKey: 'workplace_culture', similarity: 0.9 }],
        workplace_culture: [{ topicKey: 'company_culture', similarity: 0.9 }],
        compensation: [],
      },
    });

    const result = await clusterer.clusterAndStoreCanonicalTopics(
      formId,
      'task-2',
      jest.fn(),
    );

    expect(aiService.invokeFlow).not.toHaveBeenCalled();
    expect(result.topicMapping['company culture']).toBe('Company Culture');
    expect(result.topicMapping['workplace culture']).toBe('Company Culture');
    expect(result.topicMapping['compensation']).toBe('Compensation');
  });
});
