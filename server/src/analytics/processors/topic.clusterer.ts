import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { AiService } from '../../ai/ai.service';
import { ProgressCallback, ClusteringResult } from '../core/analytics.types';
import { PromptBuilder } from '../utils/prompt.builder';

/**
 * Topic Clusterer
 * 
 * Clusters raw topics into canonical categories using LLM.
 * This makes aggregation trivial - just count canonical topics across responses.
 * 
 * Process:
 * 1. Collect all unique raw topics from processed responses
 * 2. Use LLM to create canonical topic mapping
 * 3. Apply mapping to all responses (store as canonicalTopics)
 * 4. Return clustering summary
 */
@Injectable()
export class TopicClusterer {
  constructor(
    private aiService: AiService,
    private promptBuilder: PromptBuilder,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
  ) {}

  /**
   * Cluster topics and store canonical topics on each response
   */
  async clusterAndStoreCanonicalTopics(
    formId: Types.ObjectId,
    taskId: string,
    progressCallback: ProgressCallback
  ): Promise<ClusteringResult> {
    const startTime = Date.now();
    console.log(`[TopicClusterer][${taskId}] Starting canonical topic clustering`);

    // Get all processed responses with topics
    const responsesWithTopics = await this.responseModel.find({
      formId: formId,
      'metadata.processingTaskId': taskId,
      'metadata.allTopics': { $exists: true, $ne: [] }
    }).exec();

    if (responsesWithTopics.length === 0) {
      console.log(`[TopicClusterer][${taskId}] No responses with topics to cluster`);
      return {
        canonicalTopics: [],
        topicMapping: {},
        totalTime: Date.now() - startTime
      };
    }

    // Collect all unique raw topics
    const allRawTopics = new Set<string>();
    responsesWithTopics.forEach(response => {
      if (Array.isArray(response.metadata.allTopics)) {
        response.metadata.allTopics.forEach(topic => allRawTopics.add(topic));
      }
    });

    const uniqueTopics = Array.from(allRawTopics);
    console.log(`[TopicClusterer][${taskId}] Found ${uniqueTopics.length} unique raw topics to cluster`);

    progressCallback({
      type: 'progress',
      message: `Clustering ${uniqueTopics.length} unique topics into canonical categories...`,
      progress: 47,
      taskId
    });

    // Use LLM to create canonical topic mapping
    const canonicalMapping = await this.createCanonicalTopicMapping(uniqueTopics);
    console.log(`[TopicClusterer][${taskId}] Created ${Object.keys(canonicalMapping).length} canonical topic mappings`);

    progressCallback({
      type: 'progress',
      message: 'Storing canonical topics on responses...',
      progress: 50,
      taskId
    });

    // Update each response with canonical topics
    const updates: any[] = [];
    for (const response of responsesWithTopics) {
      const rawTopics = response.metadata.allTopics || [];
      const canonicalTopics = rawTopics
        .map(rawTopic => {
          const key = typeof rawTopic === 'string' ? rawTopic.trim().toLowerCase() : String(rawTopic);
          return canonicalMapping[key] || rawTopic;
        })
        .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

      updates.push({
        filter: { _id: response._id },
        update: {
          $set: {
            'metadata.canonicalTopics': canonicalTopics,
            'metadata.topicMapping': canonicalMapping
          }
        }
      });
    }

    // Execute updates in batches
    console.log(`[TopicClusterer][${taskId}] Updating ${updates.length} responses with canonical topics`);
    for (const { filter, update } of updates) {
      await this.responseModel.updateOne(filter, update).exec();
    }

    console.log(`[TopicClusterer][${taskId}] Canonical topic clustering complete`);

    // Get unique canonical topics
    const canonicalTopics = Array.from(new Set(Object.values(canonicalMapping)));

    return {
      canonicalTopics,
      topicMapping: canonicalMapping,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Create canonical topic mapping using LLM
   */
  private async createCanonicalTopicMapping(rawTopics: string[]): Promise<Record<string, string>> {
    if (rawTopics.length === 0) return {};

    const prompt = this.promptBuilder.buildTopicClusteringPrompt(rawTopics);

    const resultRaw = await this.aiService['invokeModelRaw'](prompt);
    try {
      const result = JSON.parse(resultRaw);
      const mapping = (result.mapping || {}) as Record<string, string>;
      // Normalize keys for case/whitespace to avoid unmapped variants
      const normalized: Record<string, string> = {};
      Object.entries(mapping).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'string') {
          normalized[k.trim().toLowerCase()] = v.trim();
        }
      });
      return normalized;
    } catch (e) {
      console.error('[createCanonicalTopicMapping] Failed to parse LLM result:', e);
      // Fallback: identity mapping
      return rawTopics.reduce((acc, topic) => {
        acc[topic.trim().toLowerCase()] = topic;
        return acc;
      }, {} as Record<string, string>);
    }
  }
}
