import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';
import { AiService } from '../../ai/ai.service';
import { BatchProcessor } from '../utils/batch.processor';
import { PromptBuilder } from '../utils/prompt.builder';
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
  // TEMP: Lower concurrency so waves are emitted sequentially for clearer UI state transitions
  // Original: 4
  private readonly MAX_CONCURRENCY = 1;

  constructor(
    private aiService: AiService,
    private batchProcessor: BatchProcessor,
    private promptBuilder: PromptBuilder,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
  ) {}

  /**
   * Process all responses for a form
   */
  async processResponses(
    form: Form | FormDocument,
    taskId: string,
    progressCallback: ProgressCallback,
    allowedResponseIds?: string[]
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

    for (let i = 0; i < chunks.length; i += this.MAX_CONCURRENCY) {
      const wave = chunks.slice(i, i + this.MAX_CONCURRENCY);
      const waveNumber = Math.floor(i / this.MAX_CONCURRENCY) + 1;
      
      // Calculate response range for this wave
      const startResponse = processedChunks * chunks[0].length + 1;
      const endResponse = Math.min((processedChunks + wave.length) * chunks[0].length, textResponses.length);
      
      // Get IDs for responses in this wave
      const waveResponseIds = wave.flat().map(r => (r._id as Types.ObjectId).toString());
      
      // Mark THIS wave's responses as "Pending" (set processingTaskId)
      await this.responseModel.updateMany(
        { _id: { $in: waveResponseIds.map(id => new Types.ObjectId(id)) } },
        {
          $set: {
            'metadata.processingTaskId': taskId,
            'metadata.processingStartedAt': new Date()
          }
        }
      ).exec();
      
      // Send SSE event with THIS wave's response IDs (frontend marks them as "Pending")
      progressCallback({
        type: 'responses_processing',
        message: `Processing batch ${waveNumber}/${totalWaves} (${waveResponseIds.length} responses)...`,
        progress: 5 + Math.floor((processedChunks / chunks.length) * 40),
        taskId,
        processedResponseIds: waveResponseIds, // Only this wave's IDs
      });
      
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
            this.processChunkInParallel(chunk, form, i + waveIdx, taskId)
          )
        );

        const processedIds = await this.saveChunkResults(waveResults);
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
   * Claim unprocessed responses atomically
   */
  private async claimUnprocessedResponses(
    formId: Types.ObjectId,
    taskId: string,
    progressCallback: ProgressCallback,
    allowedResponseIds?: string[]
  ): Promise<ResponseDocument[]> {
    // Just fetch unprocessed responses - orchestration already sent responses_claimed event
    const query: any = {
      formId: formId,
      'metadata.processedForAnalytics': false,
      'metadata.processingTaskId': { $exists: false }
    };
    if (allowedResponseIds && allowedResponseIds.length > 0) {
      query._id = { $in: allowedResponseIds.map(id => new Types.ObjectId(id)) };
    }
    const unprocessedResponses = await this.responseModel.find(query).exec();

    console.log(`[ResponseProcessor][${taskId}] Found ${unprocessedResponses.length} unprocessed responses to claim`);

    return unprocessedResponses;
  }

  /**
   * Process chunk: 3 features in parallel (topics, sentiment-overall, quotes)
   * NO per-question sentiment - that's calculated mathematically later
   */
  private async processChunkInParallel(
    chunk: ResponseDocument[],
    form: Form | FormDocument,
    chunkIndex: number,
    taskId: string
  ): Promise<any> {
    const topicPrompt = this.promptBuilder.buildTopicExtractionPrompt(chunk, form);
    const sentimentPrompt = this.promptBuilder.buildOverallSentimentPrompt(chunk, form);
    const quotePrompt = this.promptBuilder.buildQuoteExtractionPrompt(chunk, form);

    try {
      // Batch the 3 analysis types in parallel
      const results = await this.aiService.batchAnalyze(
        [topicPrompt, sentimentPrompt, quotePrompt],
        { 
          temperature: 0.3, 
          maxTokens: 4000, 
          maxConcurrency: 3
        }
      );

      console.log(`[ResponseProcessor][${taskId}] Topics result preview:`, results[0].substring(0, 200));
      console.log(`[processChunkInParallel][${taskId}] Raw results lengths:`, results.map(r => r.length));
      
      const parsedTopics = JSON.parse(results[0]);
    console.log(`[ResponseProcessor][${taskId}] Full topics response (first 1000 chars):`, results[0].substring(0, 1000));
      const parsedSentiment = JSON.parse(results[1]);
      const parsedQuotes = JSON.parse(results[2]);

      // Extract results array from wrapper object
      const topicsArray = Array.isArray(parsedTopics) ? parsedTopics : (parsedTopics.results || []);
      const sentimentArray = Array.isArray(parsedSentiment) ? parsedSentiment : (parsedSentiment.results || []);
      const quotesArray = Array.isArray(parsedQuotes) ? parsedQuotes : (parsedQuotes.results || []);

      console.log(`[ResponseProcessor][${taskId}] Parsed structures - Topics:`, topicsArray.length, 
        'Sentiment:', sentimentArray.length, 
        'Quotes:', quotesArray.length);
      console.log(`[processChunkInParallel][${taskId}] Extracted arrays:`, {
        topicsLength: topicsArray.length,
        sentimentLength: sentimentArray.length,
        quotesLength: quotesArray.length
      });

      return {
        chunkIndex,
        topics: topicsArray,
        sentiment: sentimentArray,
        quotes: quotesArray
      };
    } catch (error) {
      console.error(`[Analytics][${taskId}] Error in chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  /**
   * Save chunk results to database
   */
  private async saveChunkResults(waveResults: any[]): Promise<string[]> {
    const updates: any[] = [];
    const processedIds: string[] = [];

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
          updateFields['metadata.allTopics'] = topicData.topics.map((t: any) => t.topic) || [];
          updateFields['metadata.primaryTopics'] = topicData.topics.filter((t: any) => t.isPrimary).map((t: any) => t.topic) || [];
          updateFields['metadata.topicDetails'] = topicData.topics || [];
         
           if (topicData.topics.length > 0) {
             console.log(`[saveChunkResults] Response ${responseId} has ${topicData.topics.length} topics:`, topicData.topics.map((t: any) => t.topic));
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

    // Execute all updates
    console.log(`[saveChunkResults] Executing ${updates.length} updates...`);
    for (const { filter, update } of updates) {
      try {
        const result = await this.responseModel.updateOne(filter, update).exec();
        if (result.matchedCount === 0) {
          console.warn(`[saveChunkResults] No document matched for responseId: ${filter._id}`);
        }
      } catch (error) {
        console.error(`[saveChunkResults] Error updating responseId ${filter._id}:`, error);
      }
    }
    console.log(`[saveChunkResults] Completed ${updates.length} updates`);
    
    return processedIds; // Return IDs of processed responses
  }

  /**
   * Release task claim on responses
   */
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
