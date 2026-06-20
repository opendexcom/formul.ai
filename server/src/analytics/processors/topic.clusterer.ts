import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';
import { AiService } from '../../ai/ai.service';
import { TopicVectorStore } from '../stores/topic-vector.store';
import {
  buildClustersFromGroups,
  normalizeTopicKey,
  pickCanonicalLabelFromCluster,
  TopicClusterMember,
  UnionFind,
} from '../utils/topic-vector-cluster.util';
import {
  extractQuestionFocusPhrases,
  filterDiscoveredTopics,
} from '../utils/topic-question-filter.util';
import { buildCanonicalTopicSentiments } from '../utils/topic-sentiment.util';
import { ProgressCallback, ClusteringResult } from '../core/analytics.types';

const CLUSTER_BATCH_SIZE = parseInt(
  process.env.ANALYTICS_CLUSTER_BATCH_SIZE ?? '200',
  10,
);
const BULK_WRITE_BATCH_SIZE = parseInt(
  process.env.ANALYTICS_BULK_WRITE_BATCH_SIZE ?? '500',
  10,
);
const KNN_K = parseInt(process.env.ANALYTICS_TOPIC_KNN_K ?? '15', 10);
const LLM_LABEL_CLUSTERS =
  process.env.ANALYTICS_TOPIC_LLM_LABEL_CLUSTERS !== 'false';

/**
 * Topic Clusterer — vector-first canonical topic creation with LLM fallback.
 */
@Injectable()
export class TopicClusterer {
  constructor(
    private aiService: AiService,
    private topicVectorStore: TopicVectorStore,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
    @InjectModel(Form.name) private formModel: Model<FormDocument>,
  ) {}

  async clusterAndStoreCanonicalTopics(
    formId: Types.ObjectId,
    taskId: string,
    progressCallback: ProgressCallback,
    userId?: string,
  ): Promise<ClusteringResult> {
    const startTime = Date.now();
    const formIdStr = formId.toString();
    console.log(`[TopicClusterer][${taskId}] Starting canonical topic creation`);

    const form = await this.formModel.findById(formId).select('questions').lean();
    const questionFocusPhrases = form
      ? extractQuestionFocusPhrases(form as Form)
      : [];

    const matchQuery = {
      formId,
      'metadata.processedForAnalytics': true,
      $or: [
        { 'metadata.discoveredTopics.0': { $exists: true } },
        { 'metadata.allTopics.0': { $exists: true } },
      ],
    };

    const responseCount = await this.responseModel.countDocuments(matchQuery).exec();
    console.log(`[TopicClusterer][${taskId}] Found ${responseCount} responses with topics`);

    if (responseCount === 0) {
      return {
        canonicalTopics: [],
        topicMapping: {},
        totalTime: Date.now() - startTime,
      };
    }

    const rawDistinct = await this.responseModel.distinct(
      'metadata.discoveredTopics',
      matchQuery,
    );
    const fallbackDistinct =
      rawDistinct.filter(
        (t): t is string => typeof t === 'string' && t.trim().length > 0,
      ).length > 0
        ? rawDistinct
        : await this.responseModel.distinct('metadata.allTopics', matchQuery);

    const uniqueTopics = fallbackDistinct
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .filter((t, index, self) => self.indexOf(t) === index);

    const filteredUniqueTopics =
      questionFocusPhrases.length > 0
        ? filterDiscoveredTopics(uniqueTopics, questionFocusPhrases)
        : uniqueTopics;

    console.log(`[TopicClusterer][${taskId}] Found ${filteredUniqueTopics.length} unique raw topics`);

    progressCallback({
      type: 'progress',
      message: `Creating canonical topics from ${filteredUniqueTopics.length} unique topics...`,
      progress: 47,
      taskId,
    });

    const topicCounts = await this.getTopicCounts(formId, questionFocusPhrases);
    await this.topicVectorStore.upsertTopics(formIdStr, topicCounts);

    const canonicalMapping = this.topicVectorStore.isAvailable()
      ? await this.createVectorCanonicalMapping(
          formIdStr,
          filteredUniqueTopics,
          topicCounts,
          taskId,
          userId,
        )
      : await this.createBatchedCanonicalMapping(
          filteredUniqueTopics,
          taskId,
          formIdStr,
          userId,
        );

    console.log(
      `[TopicClusterer][${taskId}] Created ${Object.keys(canonicalMapping).length} canonical topic mappings`,
    );

    progressCallback({
      type: 'progress',
      message: 'Storing canonical topics on responses...',
      progress: 50,
      taskId,
    });

    await this.applyCanonicalMappingWithCursor(formId, canonicalMapping, taskId);

    const canonicalTopics = Array.from(new Set(Object.values(canonicalMapping)));

    return {
      canonicalTopics,
      topicMapping: canonicalMapping,
      totalTime: Date.now() - startTime,
    };
  }

  private async getTopicCounts(
    formId: Types.ObjectId,
    questionFocusPhrases: string[] = [],
  ): Promise<Map<string, number>> {
    const rows = await this.responseModel
      .aggregate<{ topics: string[]; sentiment?: string }>([
        {
          $match: {
            formId,
            'metadata.processedForAnalytics': true,
            $or: [
              { 'metadata.discoveredTopics.0': { $exists: true } },
              { 'metadata.allTopics.0': { $exists: true } },
            ],
          },
        },
        {
          $project: {
            topics: {
              $cond: [
                {
                  $gt: [
                    { $size: { $ifNull: ['$metadata.discoveredTopics', []] } },
                    0,
                  ],
                },
                '$metadata.discoveredTopics',
                { $ifNull: ['$metadata.allTopics', []] },
              ],
            },
          },
        },
      ])
      .exec();

    const counts = new Map<string, number>();
    for (const row of rows) {
      const topics =
        questionFocusPhrases.length > 0
          ? filterDiscoveredTopics(row.topics || [], questionFocusPhrases)
          : row.topics || [];
      for (const topic of topics) {
        if (typeof topic === 'string' && topic.trim()) {
          counts.set(topic, (counts.get(topic) ?? 0) + 1);
        }
      }
    }
    return counts;
  }

  private async createVectorCanonicalMapping(
    formId: string,
    rawTopics: string[],
    topicCounts: Map<string, number>,
    taskId: string,
    userId?: string,
  ): Promise<Record<string, string>> {
    const storedTopics = await this.topicVectorStore.getAllTopics(formId);
    const memberByKey = new Map<string, TopicClusterMember>();

    for (const record of storedTopics) {
      memberByKey.set(record.topicKey, {
        topicKey: record.topicKey,
        topicText: record.topicText,
        responseCount: record.responseCount,
      });
    }

    for (const topicText of rawTopics) {
      const topicKey = this.topicVectorStore.topicKeyFromText(topicText);
      if (!memberByKey.has(topicKey)) {
        memberByKey.set(topicKey, {
          topicKey,
          topicText,
          responseCount: topicCounts.get(topicText) ?? 1,
        });
        await this.topicVectorStore.upsertTopic(
          formId,
          topicText,
          topicCounts.get(topicText) ?? 1,
        );
      }
    }

    const refreshed = await this.topicVectorStore.getAllTopics(formId);
    const uf = new UnionFind();

    for (const record of refreshed) {
      uf.add(record.topicKey);
      memberByKey.set(record.topicKey, {
        topicKey: record.topicKey,
        topicText: record.topicText,
        responseCount: record.responseCount,
      });
    }

    for (const record of refreshed) {
      const similar = await this.topicVectorStore.findSimilar(
        formId,
        record.embedding,
        KNN_K,
      );
      for (const match of similar) {
        if (match.topicKey === record.topicKey) continue;
        uf.union(record.topicKey, match.topicKey);
      }
    }

    const clusters = buildClustersFromGroups(uf.groups(), memberByKey);
    const mapping: Record<string, string> = {};

    for (const cluster of clusters) {
      let canonicalLabel = pickCanonicalLabelFromCluster(cluster.members);

      if (LLM_LABEL_CLUSTERS && cluster.members.length >= 3) {
        const llmLabel = await this.labelClusterWithLlm(
          cluster.members.map((m) => m.topicText),
          taskId,
          formId,
          userId,
        );
        if (llmLabel) canonicalLabel = llmLabel;
      }

      for (const member of cluster.members) {
        mapping[normalizeTopicKey(member.topicText)] = canonicalLabel;
        await this.topicVectorStore.assignCluster(
          formId,
          member.topicKey,
          cluster.id,
          canonicalLabel,
        );
      }
    }

    for (const topicText of rawTopics) {
      const key = normalizeTopicKey(topicText);
      if (!mapping[key]) {
        mapping[key] = topicText.trim();
      }
    }

    return mapping;
  }

  private async labelClusterWithLlm(
    clusterTopics: string[],
    taskId: string,
    formId: string,
    userId?: string,
  ): Promise<string | null> {
    try {
      const { content: resultRaw } = await this.aiService.invokeFlow(
        'analytics.topic_clustering',
        { clusterTopics: JSON.stringify(clusterTopics, null, 2) },
        { skipValidation: true, formId, sessionId: taskId, userId },
      );
      const result = JSON.parse(resultRaw);
      if (typeof result.canonicalLabel === 'string' && result.canonicalLabel.trim()) {
        return result.canonicalLabel.trim();
      }
      if (result.mapping && typeof result.mapping === 'object') {
        const values = Object.values(result.mapping).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );
        if (values.length > 0) return values[0].trim();
      }
    } catch (e) {
      console.error('[labelClusterWithLlm] Failed:', e);
    }
    return null;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async createBatchedCanonicalMapping(
    rawTopics: string[],
    taskId: string,
    formId: string,
    userId?: string,
  ): Promise<Record<string, string>> {
    if (rawTopics.length === 0) return {};

    const topicBatches = this.chunkArray(rawTopics, CLUSTER_BATCH_SIZE);
    const partialMappings = await Promise.all(
      topicBatches.map((batch) =>
        this.createBatchCanonicalTopicMapping(batch, taskId, formId, userId),
      ),
    );

    let combined: Record<string, string> = {};
    for (const mapping of partialMappings) {
      combined = { ...combined, ...mapping };
    }

    if (topicBatches.length <= 1) {
      return combined;
    }

    const canonicalValues = Array.from(new Set(Object.values(combined)));
    if (canonicalValues.length <= CLUSTER_BATCH_SIZE) {
      const mergeMapping = await this.createBatchCanonicalTopicMapping(
        canonicalValues,
        taskId,
        formId,
        userId,
      );
      const normalized: Record<string, string> = {};
      for (const [rawKey, canonicalValue] of Object.entries(combined)) {
        const mergeKey = canonicalValue.trim().toLowerCase();
        normalized[rawKey] = mergeMapping[mergeKey] ?? canonicalValue;
      }
      return normalized;
    }

    const mergeBatches = this.chunkArray(canonicalValues, CLUSTER_BATCH_SIZE);
    const mergePartial = await Promise.all(
      mergeBatches.map((batch) =>
        this.createBatchCanonicalTopicMapping(batch, taskId, formId, userId),
      ),
    );
    const globalMerge: Record<string, string> = {};
    for (const mapping of mergePartial) {
      Object.assign(globalMerge, mapping);
    }

    const normalized: Record<string, string> = {};
    for (const [rawKey, canonicalValue] of Object.entries(combined)) {
      const mergeKey = canonicalValue.trim().toLowerCase();
      normalized[rawKey] = globalMerge[mergeKey] ?? canonicalValue;
    }
    return normalized;
  }

  private async applyCanonicalMappingWithCursor(
    formId: Types.ObjectId,
    canonicalMapping: Record<string, string>,
    taskId: string,
  ): Promise<void> {
    const matchQuery = {
      formId,
      'metadata.processedForAnalytics': true,
      $or: [
        { 'metadata.discoveredTopics.0': { $exists: true } },
        { 'metadata.allTopics.0': { $exists: true } },
      ],
    };

    const cursor = this.responseModel
      .find(matchQuery)
      .select(
        '_id metadata.discoveredTopics metadata.allTopics metadata.topicDetails metadata.overallSentiment',
      )
      .lean()
      .cursor();

    let bulkOps: Array<{
      updateOne: {
        filter: { _id: Types.ObjectId };
        update: {
          $set: {
            'metadata.canonicalTopics': string[];
            'metadata.topicMapping': Record<string, string>;
            'metadata.canonicalTopicSentiments': Array<{
              topic: string;
              label: string;
              score: number;
            }>;
          };
        };
      };
    }> = [];
    let updatedCount = 0;

    for await (const doc of cursor) {
      const rawTopics =
        (doc as any).metadata?.discoveredTopics?.length > 0
          ? (doc as any).metadata.discoveredTopics
          : (doc as any).metadata?.allTopics || [];
      const canonicalTopics = rawTopics
        .map((rawTopic: string) => {
          const key =
            typeof rawTopic === 'string'
              ? rawTopic.trim().toLowerCase()
              : String(rawTopic);
          return canonicalMapping[key] || rawTopic;
        })
        .filter(
          (value: string, index: number, self: string[]) =>
            self.indexOf(value) === index,
        );

      const canonicalTopicSentiments = buildCanonicalTopicSentiments(
        (doc as any).metadata?.topicDetails,
        canonicalTopics,
        canonicalMapping,
        (doc as any).metadata?.overallSentiment,
      );

      bulkOps.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: {
            $set: {
              'metadata.canonicalTopics': canonicalTopics,
              'metadata.topicMapping': canonicalMapping,
              'metadata.canonicalTopicSentiments': canonicalTopicSentiments,
            },
          },
        },
      });

      if (bulkOps.length >= BULK_WRITE_BATCH_SIZE) {
        const result = await this.responseModel.bulkWrite(bulkOps);
        updatedCount += result.modifiedCount;
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      const result = await this.responseModel.bulkWrite(bulkOps);
      updatedCount += result.modifiedCount;
    }

    console.log(
      `[TopicClusterer][${taskId}] Canonical topic creation complete - updated ${updatedCount} responses`,
    );
  }

  /** LLM batch mapping fallback when vector store unavailable. */
  private async createBatchCanonicalTopicMapping(
    rawTopics: string[],
    taskId: string,
    formId: string,
    userId?: string,
  ): Promise<Record<string, string>> {
    if (rawTopics.length === 0) return {};

    const { content: resultRaw } = await this.aiService.invokeFlow(
      'analytics.topic_clustering_batch',
      { rawTopics: JSON.stringify(rawTopics, null, 2) },
      { skipValidation: true, formId, sessionId: taskId, userId },
    );
    try {
      const result = JSON.parse(resultRaw);
      const mapping = (result.mapping || {}) as Record<string, string>;
      const normalized: Record<string, string> = {};
      Object.entries(mapping).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'string') {
          normalized[k.trim().toLowerCase()] = v.trim();
        }
      });
      return normalized;
    } catch (e) {
      console.error('[createBatchCanonicalTopicMapping] Failed to parse LLM result:', e);
      return rawTopics.reduce(
        (acc, topic) => {
          const key = topic.trim().toLowerCase();
          const titleCased = topic
            .trim()
            .split(' ')
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
            )
            .join(' ');
          acc[key] = titleCased;
          return acc;
        },
        {} as Record<string, string>,
      );
    }
  }
}
