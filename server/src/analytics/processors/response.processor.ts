import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';
import { AiService } from '../../ai/ai.service';
import { BatchProcessor } from '../utils/batch.processor';
import { PromptBuilder } from '../utils/prompt.builder';
import { TopicVectorStore } from '../stores/topic-vector.store';
import {
  extractQuestionFocusPhrases,
  filterDiscoveredTopics,
} from '../utils/topic-question-filter.util';
import { ProgressCallback, ProcessingResult } from '../core/analytics.types';

/**
 * Response Processor
 * 
 * Processes individual responses to extract:
 * - Topics (in-vivo coding)
 * - Overall sentiment (positive/negative/neutral)
 * - Representative quotes
 * 
 * Uses hybrid batch processing:
 * - Adaptive chunk sizing based on response length
 * - Wave-based parallel processing (MAX_CONCURRENCY = 4)
 * - 3 parallel LLM calls per chunk (topics, sentiment, quotes)
 */
@Injectable()
export class ResponseProcessor {
  // Wave parallelism within a batch job (env-configurable, default 4)
  private readonly MAX_CONCURRENCY = parseInt(
    process.env.ANALYTICS_CHUNK_CONCURRENCY ?? '4',
    10,
  );

  constructor(
    private aiService: AiService,
    private batchProcessor: BatchProcessor,
    private promptBuilder: PromptBuilder,
    private topicVectorStore: TopicVectorStore,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
  ) {}

  /**
   * Process all responses for a form
   */
  async processResponses(
    form: Form | FormDocument,
    taskId: string,
    progressCallback: ProgressCallback,
    allowedResponseIds?: string[],
    userId?: string,
  ): Promise<ProcessingResult> {
    console.log(`[ResponseProcessor][${taskId}] Starting response processing`);

    const formId = (form as FormDocument)._id || (form as any).id;

    // 1. Claim unprocessed responses (get list and send event to reset frontend to "Not started")
  const claimResult = await this.claimUnprocessedResponses(formId as Types.ObjectId, taskId, progressCallback, allowedResponseIds);
    
    // 2. Filter to text vs empty responses using pre-calculated metadata
    const textResponses = claimResult.filter(r => r.metadata.hasTextContent);
    const emptyResponses = claimResult.filter(r => !r.metadata.hasTextContent);

    // 3. Mark empty responses as processed immediately (no analysis needed)
    if (emptyResponses.length > 0) {
      console.log(`[ResponseProcessor][${taskId}] Marking ${emptyResponses.length} empty responses as processed`);
      await this.responseModel.updateMany(
        { _id: { $in: emptyResponses.map(r => r._id) } },
        {
          $set: {
            'metadata.processedForAnalytics': true,
            'metadata.lastAnalyzed': new Date(),
            'metadata.allTopics': [],
            'metadata.canonicalTopics': [],
            'metadata.primaryTopics': [],
            'metadata.overallSentiment': null,
            'metadata.quotes': {
              keyQuotes: [],
              representativeness: 'typical',
              responseQuality: {
                depth: 'superficial',
                completeness: 0,
                coherence: 0
              }
            }
          },
          $unset: {
            'metadata.processingTaskId': '',
            'metadata.processingStartedAt': ''
          }
        }
      ).exec();
    }

    if (textResponses.length === 0) {
      console.log(`[ResponseProcessor][${taskId}] No text responses to process`);
      return {
        processedCount: emptyResponses.length,
        failedCount: 0,
        skippedCount: 0,
        totalTime: 0
      };
    }

    console.log(`[ResponseProcessor][${taskId}] Processing ${textResponses.length} text responses`);

    // 3. Adaptive chunking
    const avgLength = this.batchProcessor.calculateAvgResponseLength(textResponses);
    const chunkSize = this.batchProcessor.adaptiveChunkSize(textResponses.length, avgLength);
    const chunks = this.batchProcessor.createResponseChunks(textResponses, chunkSize);

    console.log(`[ResponseProcessor][${taskId}] Created ${chunks.length} chunks (size: ${chunkSize}, avg length: ${avgLength})`);

    // 4. Send initial "processing started" event (no specific response IDs yet)
    const totalWaves = Math.ceil(chunks.length / this.MAX_CONCURRENCY);
    progressCallback({
      type: 'responses_processing',
      message: `Starting to process ${textResponses.length} responses in ${totalWaves} ${totalWaves === 1 ? 'batch' : 'batches'}...`,
      progress: 5,
      taskId,
      processedResponseIds: [], // Empty - we'll send specific IDs wave-by-wave
    });

    // 5. Process in waves (parallel)
    let processedChunks = 0;
    const errors: string[] = [];
    const omittedResponseIds: string[] = [];

    for (let i = 0; i < chunks.length; i += this.MAX_CONCURRENCY) {
      const wave = chunks.slice(i, i + this.MAX_CONCURRENCY);
      const waveNumber = Math.floor(i / this.MAX_CONCURRENCY) + 1;
      
      // Calculate response range for this wave
      const startResponse = processedChunks * chunks[0].length + 1;
      const endResponse = Math.min((processedChunks + wave.length) * chunks[0].length, textResponses.length);
      
      // Get IDs for responses in this wave
      const waveResponseIds = wave.flat().map(r => (r._id as Types.ObjectId).toString());
      
      // Note: processingTaskId is already set by orchestration for all responses upfront
      // No need to mark as "Pending" here again
      
      // Send detailed progress message
      progressCallback({
        type: 'progress',
        message: totalWaves > 1 
          ? `Analyzing topics, sentiment & quotes for responses ${startResponse}-${endResponse} (batch ${waveNumber}/${totalWaves})...`
          : `Analyzing topics, sentiment & quotes for ${textResponses.length} responses...`,
        progress: 5 + Math.floor((processedChunks / chunks.length) * 40), // 5% to 45%
        taskId
      });

      try {
        const waveResults = await Promise.all(
          wave.map((chunk, waveIdx) => 
            this.processChunkInParallel(chunk, form, i + waveIdx, taskId, userId)
          )
        );

        const { processedIds, omittedIds } = await this.saveChunkResults(
          waveResults,
          form,
          wave.flat(),
        );
        omittedResponseIds.push(...omittedIds);
        processedChunks += wave.length;

        // Send update with processed response IDs
        if (processedIds.length > 0) {
          progressCallback({
            type: 'responses_processed',
            message: `Processed ${processedIds.length} responses`,
            progress: 5 + Math.floor((processedChunks / chunks.length) * 40),
            taskId,
            processedResponseIds: processedIds
          });
        }
      } catch (error) {
        console.error(`[ResponseProcessor][${taskId}] Error in wave ${waveNumber}:`, error);
        errors.push(`Wave ${waveNumber}: ${error.message}`);
        
        // Clean up processingTaskId on failed wave's responses so they can be retried
        await this.responseModel.updateMany(
          { _id: { $in: waveResponseIds.map(id => new Types.ObjectId(id)) } },
          { $unset: { 'metadata.processingTaskId': '', 'metadata.processingStartedAt': '' } }
        ).exec();
        console.log(`[ResponseProcessor][${taskId}] Cleaned up processingTaskId for ${waveResponseIds.length} responses after wave failure`);
      }
    }

    if (omittedResponseIds.length > 0) {
      const retriedIds = await this.retryOmittedResponses(
        form,
        taskId,
        omittedResponseIds,
        progressCallback,
        userId,
      );
      if (retriedIds.length > 0) {
        progressCallback({
          type: 'responses_processed',
          message: `Processed ${retriedIds.length} response(s) after retry`,
          progress: 45,
          taskId,
          processedResponseIds: retriedIds,
        });
      }
    }

    return {
      processedCount: textResponses.length - errors.length,
      failedCount: errors.length,
      skippedCount: claimResult.length - textResponses.length,
      totalTime: 0 // Calculate if needed
    };
  }

  /**
   * Re-run combined analysis one response at a time when the LLM drops entries from a batch.
   */
  private async retryOmittedResponses(
    form: Form | FormDocument,
    taskId: string,
    omittedIds: string[],
    progressCallback: ProgressCallback,
    userId?: string,
  ): Promise<string[]> {
    const uniqueIds = [...new Set(omittedIds)];
    console.warn(
      `[ResponseProcessor][${taskId}] Retrying ${uniqueIds.length} omitted response(s) individually`,
    );

    progressCallback({
      type: 'progress',
      message: `Retrying ${uniqueIds.length} response(s) the model skipped...`,
      progress: 44,
      taskId,
    });

    const responses = await this.responseModel
      .find({ _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) } })
      .exec();

    const retriedIds: string[] = [];
    const stillOmitted: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const responseId = (response._id as Types.ObjectId).toString();

      try {
        const chunkResult = await this.processChunkInParallel(
          [response],
          form,
          i,
          taskId,
          userId,
        );
        const { processedIds, omittedIds } = await this.saveChunkResults(
          [chunkResult],
          form,
          [response],
        );
        if (processedIds.length > 0) {
          retriedIds.push(...processedIds);
        } else {
          stillOmitted.push(...omittedIds);
        }
      } catch (error) {
        console.error(
          `[ResponseProcessor][${taskId}] Retry failed for ${responseId}:`,
          error,
        );
        stillOmitted.push(responseId);
      }
    }

    if (stillOmitted.length > 0) {
      console.warn(
        `[ResponseProcessor][${taskId}] Clearing claim on ${stillOmitted.length} response(s) after retry failure:`,
        stillOmitted,
      );
      await this.responseModel.updateMany(
        { _id: { $in: stillOmitted.map((id) => new Types.ObjectId(id)) } },
        {
          $unset: {
            'metadata.processingTaskId': '',
            'metadata.processingStartedAt': '',
          },
        },
      ).exec();
    }

    return retriedIds;
  }

  /**
   * Claim unprocessed responses atomically
   */
  private async claimUnprocessedResponses(
    formId: Types.ObjectId,
    taskId: string,
    progressCallback: ProgressCallback,
    allowedResponseIds?: string[]
  ): Promise<ResponseDocument[]> {
    // Fetch responses for this batch - orchestration already set processingTaskId on all
    // Use allowedResponseIds to filter to just this batch's responses
    const query: any = {
      formId: formId,
      'metadata.processedForAnalytics': { $ne: true },
    };
    if (allowedResponseIds && allowedResponseIds.length > 0) {
      query._id = { $in: allowedResponseIds.map(id => new Types.ObjectId(id)) };
    }
    const unprocessedResponses = await this.responseModel.find(query).exec();

    console.log(`[ResponseProcessor][${taskId}] Found ${unprocessedResponses.length} unprocessed responses to claim (allowedIds: ${allowedResponseIds?.length || 'all'})`);

    return unprocessedResponses;
  }

  /**
   * Process chunk: single combined LLM call (topics + sentiment + quotes)
   */
  private async processChunkInParallel(
    chunk: ResponseDocument[],
    form: Form | FormDocument,
    chunkIndex: number,
    taskId: string,
    userId?: string,
  ): Promise<any> {
    const formId = String((form as FormDocument)._id ?? (form as any).id ?? '');
    const flowOpts = { skipValidation: true, formId, sessionId: taskId, userId };

    try {
      const combinedFlow = await this.aiService.invokeFlow(
        'analytics.combined_analysis',
        this.promptBuilder.getCombinedAnalysisVariables(chunk, form as Form),
        flowOpts,
      );

      const parsed = JSON.parse(combinedFlow.content);
      const resultsArray = Array.isArray(parsed)
        ? parsed
        : parsed.results || [];

      const topicsArray = resultsArray.map((r: any) => ({
        responseId: r.responseId,
        topics: r.topics || [],
      }));
      const sentimentArray = resultsArray.map((r: any) => ({
        responseId: r.responseId,
        overallSentiment: r.overallSentiment,
      }));
      const quotesArray = resultsArray.map((r: any) => ({
        responseId: r.responseId,
        quotes: r.quotes || [],
        responseQuality: r.responseQuality,
      }));

      console.log(
        `[ResponseProcessor][${taskId}] Combined analysis - Topics:`,
        topicsArray.length,
        'Sentiment:',
        sentimentArray.length,
        'Quotes:',
        quotesArray.length,
      );

      return {
        chunkIndex,
        topics: topicsArray,
        sentiment: sentimentArray,
        quotes: quotesArray,
      };
    } catch (error) {
      console.error(`[Analytics][${taskId}] Error in chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  /**
   * Save chunk results to database
   */
  /**
   * Save chunk results to database
   */
  private async saveChunkResults(
    waveResults: any[], 
    form: Form | FormDocument,
    waveResponses: ResponseDocument[]
  ): Promise<{ processedIds: string[]; omittedIds: string[] }> {
    const updates: any[] = [];
    const processedIds: string[] = [];
    const topicCounts = new Map<string, number>();
    const formIdStr = String(
      (form as FormDocument)._id ?? (form as any).id ?? '',
    );
    const questionFocusPhrases = extractQuestionFocusPhrases(form as Form);

    for (const chunkResult of waveResults) {
      const { topics, sentiment, quotes } = chunkResult;

      // Verify structure
      if (!Array.isArray(topics) || !Array.isArray(sentiment) || !Array.isArray(quotes)) {
        console.error('[saveChunkResults] Invalid structure:', { 
          topicsIsArray: Array.isArray(topics), 
          sentimentIsArray: Array.isArray(sentiment), 
          quotesIsArray: Array.isArray(quotes) 
        });
        continue;
      }

      // Create lookup maps
      const topicsMap = new Map(topics.map(t => [t.responseId, t]));
      const sentimentMap = new Map(sentiment.map(s => [s.responseId, s]));
      const quotesMap = new Map(quotes.map(q => [q.responseId, q]));

      // Get all unique response IDs
      const allResponseIds = new Set([
        ...topics.map(t => t.responseId),
        ...sentiment.map(s => s.responseId),
        ...quotes.map(q => q.responseId)
      ]);

      console.log(`[saveChunkResults] Processing ${allResponseIds.size} unique responses from chunk`);

      for (const responseId of allResponseIds) {
        const topicData = topicsMap.get(responseId);
        const sentimentData = sentimentMap.get(responseId);
        const quoteData = quotesMap.get(responseId);

        if (!topicData && !sentimentData && !quoteData) {
          console.warn(`[saveChunkResults] No data for response ${responseId}`);
          continue;
        }

        // Track this response ID as processed
        processedIds.push(responseId);

        // Build update object
        const updateFields: any = {
          'metadata.lastAnalyzed': new Date(),
          'metadata.processedForAnalytics': true, // Mark as processed
        };
        
        // Clear processing task ID to mark as complete
        const unsetFields: any = {
          'metadata.processingTaskId': '',
          'metadata.processingStartedAt': ''
        };

        if (topicData?.topics) {
          // Backward-compat: keep legacy field while also storing enhanced fields
          updateFields['metadata.topics'] = topicData.topics || [];
          const topicNames = topicData.topics.map((t: any) => t.topic) || [];
          const quoteThemes = (quoteData?.quotes || []).flatMap(
            (q: any) => q.themes || [],
          );
          const mergedTopics = [
            ...new Set(
              [...topicNames, ...quoteThemes].filter(
                (t): t is string => typeof t === 'string' && t.trim().length > 0,
              ),
            ),
          ];
          updateFields['metadata.allTopics'] = mergedTopics;
          updateFields['metadata.discoveredTopics'] = filterDiscoveredTopics(
            mergedTopics,
            questionFocusPhrases,
          );
          updateFields['metadata.primaryTopics'] = topicData.topics.filter((t: any) => t.isPrimary).map((t: any) => t.topic) || [];
          updateFields['metadata.topicDetails'] = topicData.topics || [];

          if (mergedTopics.length > 0) {
            console.log(`[saveChunkResults] Response ${responseId} has ${mergedTopics.length} topics:`, mergedTopics);
            const discovered = filterDiscoveredTopics(
              mergedTopics,
              questionFocusPhrases,
            );
            for (const topic of discovered) {
              topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
            }
          }
        } else if (quoteData?.quotes?.length) {
          const quoteThemes = quoteData.quotes.flatMap((q: any) => q.themes || []);
          const quoteThemeStrings: string[] = quoteThemes.filter(
            (t: unknown): t is string =>
              typeof t === 'string' && t.trim().length > 0,
          );
          const mergedTopics = Array.from(new Set(quoteThemeStrings));
          if (mergedTopics.length > 0) {
            updateFields['metadata.allTopics'] = mergedTopics;
            updateFields['metadata.discoveredTopics'] = filterDiscoveredTopics(
              mergedTopics,
              questionFocusPhrases,
            );
            const discovered = filterDiscoveredTopics(
              mergedTopics,
              questionFocusPhrases,
            );
            for (const topic of discovered) {
              topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
            }
          }
        }

        if (sentimentData?.overallSentiment) {
          updateFields['metadata.overallSentiment'] = {
            label: sentimentData.overallSentiment.sentiment,
            score: sentimentData.overallSentiment.score,
            emotionalTone: sentimentData.overallSentiment.emotionalTone,
            confidence: sentimentData.overallSentiment.confidence,
            reasoning: sentimentData.overallSentiment.reasoning
          };
        }

        if (quoteData) {
          const quotesArray = quoteData.quotes || [];
          
          // Calculate representativeness
          let representativeness: 'typical' | 'deviant' | 'mixed' = 'typical';
          if (quotesArray.length > 0) {
            const avgRepresentativeness = quotesArray.reduce((sum: number, q: any) => sum + (q.representativeness || 0), 0) / quotesArray.length;
            if (avgRepresentativeness < 0.4) {
              representativeness = 'deviant';
            } else if (avgRepresentativeness >= 0.4 && avgRepresentativeness < 0.7) {
              representativeness = 'mixed';
            }
          }

          // Convert depth score to label
          let depthLabel: 'superficial' | 'moderate' | 'deep' = 'moderate';
          if (quoteData.responseQuality?.depth) {
            if (quoteData.responseQuality.depth < 0.4) {
              depthLabel = 'superficial';
            } else if (quoteData.responseQuality.depth >= 0.7) {
              depthLabel = 'deep';
            }
          }

          updateFields['metadata.quotes'] = {
            keyQuotes: quotesArray.map((q: any) => ({
              quote: q.text || '',
              significance: q.themes?.join(', ') || '',
              questionId: q.questionId || '',
              relatedTopics: q.themes || []
            })),
            representativeness,
            responseQuality: {
              depth: depthLabel,
              completeness: quoteData.responseQuality?.completeness || 0.5,
              coherence: quoteData.responseQuality?.clarity || 0.5
            }
          };
        } else {
          // No quote data - set defaults
          updateFields['metadata.quotes'] = {
            keyQuotes: [],
            representativeness: 'typical',
            responseQuality: {
              depth: 'moderate',
              completeness: 0.5,
              coherence: 0.5
            }
          };
        }

        updates.push({
          filter: { _id: responseId },
          update: { 
            $set: updateFields,
            $unset: unsetFields
          }
        });
      }
    }

    const expectedIds = waveResponses.map((r) =>
      (r._id as Types.ObjectId).toString(),
    );
    const processedSet = new Set(processedIds);
    const omittedIds = expectedIds.filter((id) => !processedSet.has(id));
    if (omittedIds.length > 0) {
      console.warn(
        `[saveChunkResults] LLM omitted ${omittedIds.length} response(s):`,
        omittedIds,
      );
    }

    // Execute all updates in a single bulkWrite round-trip
    console.log(`[saveChunkResults] Executing ${updates.length} updates via bulkWrite...`);
    if (updates.length > 0) {
      try {
        const result = await this.responseModel.bulkWrite(
          updates.map(({ filter, update }) => ({
            updateOne: { filter, update },
          })),
        );
        console.log(
          `[saveChunkResults] bulkWrite complete: matched=${result.matchedCount}, modified=${result.modifiedCount}`,
        );
      } catch (error) {
        console.error('[saveChunkResults] bulkWrite error:', error);
        throw error;
      }
    }

    if (this.topicVectorStore.isAvailable() && topicCounts.size > 0 && formIdStr) {
      await this.topicVectorStore.upsertTopics(formIdStr, topicCounts);
    }
    
    return { processedIds, omittedIds };
  }

  /**
   * Release task claim on responses
   */
  /**
   * Clear stale in-flight claims so the UI does not show "Pending" forever.
   * Responses stay unprocessed and will be picked up on the next analytics run.
   */
  async clearStrandedClaims(taskId: string, formId: Types.ObjectId): Promise<number> {
    const result = await this.responseModel.updateMany(
      {
        formId,
        'metadata.processingTaskId': taskId,
        'metadata.processedForAnalytics': { $ne: true },
      },
      {
        $unset: {
          'metadata.processingTaskId': '',
          'metadata.processingStartedAt': '',
        },
      },
    ).exec();

    if (result.modifiedCount > 0) {
      console.warn(
        `[clearStrandedClaims][${taskId}] Cleared claim on ${result.modifiedCount} unprocessed response(s)`,
      );
    }

    return result.modifiedCount;
  }

  async releaseTaskClaim(taskId: string, formId: Types.ObjectId): Promise<void> {
    console.log(`[releaseTaskClaim][${taskId}] Marking responses as processed for form ${formId}`);
    
    const result = await this.responseModel.updateMany(
      { formId: formId, 'metadata.processingTaskId': taskId },
      {
        $set: { 'metadata.processedForAnalytics': true, 'metadata.lastAnalyzed': new Date() },
        $unset: { 'metadata.processingTaskId': '', 'metadata.processingStartedAt': '' }
      }
    ).exec();
    
    console.log(`[releaseTaskClaim][${taskId}] Marked ${result.modifiedCount} responses as processed`);
  }
}
