import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Form, FormDocument } from '../../schemas/form.schema';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { TaskManager } from './task.manager';
import { ResponseProcessor } from '../processors/response.processor';
import { TopicClusterer } from '../processors/topic.clusterer';
import { StatisticsCalculator } from '../calculators/statistics.calculator';
import { CorrelationCalculator } from '../calculators/correlation.calculator';
import { SentimentCalculator } from '../calculators/sentiment.calculator';
import { SummaryGenerator } from '../generators/summary.generator';
import { FindingsGenerator } from '../generators/findings.generator';
import { RecommendationsGenerator } from '../generators/recommendations.generator';
import { ProgressCallback, ProcessingResult, ClusteringResult, AggregateResult } from './analytics.types';
import { LockToken } from '../stores/form-lock.store';

/**
 * Analytics Orchestrator
 * 
 * Main coordinator for the entire analytics pipeline.
 * Orchestrates the flow: ResponseProcessor → TopicClusterer → Aggregate Analysis → Generators
 * 
 * Responsibilities:
 * - Manage task lifecycle (create, track, complete/fail)
 * - Acquire/release form locks for exclusive processing
 * - Coordinate all processing phases with progress tracking
 * - Handle errors and cleanup
 * - Generate final analytics result and save to Form document
 * 
 * Pipeline Stages:
 * 1. Process Responses (5-45%): Extract topics, sentiment, quotes from each response
 * 2. Cluster Topics (45-55%): Map raw topics to canonical categories
 * 3. Aggregate Analysis (60-85%): Calculate statistics, correlations, distributions
 * 4. Generate Insights (85-95%): Create summary, findings, recommendations
 * 5. Save Results (95-100%): Persist analytics to Form document
 */
@Injectable()
export class AnalyticsOrchestrator {
  private readonly logger = new Logger(AnalyticsOrchestrator.name);

  constructor(
    private readonly taskManager: TaskManager,
    private readonly responseProcessor: ResponseProcessor,
    private readonly topicClusterer: TopicClusterer,
    private readonly statisticsCalculator: StatisticsCalculator,
    private readonly correlationCalculator: CorrelationCalculator,
    private readonly sentimentCalculator: SentimentCalculator,
    private readonly summaryGenerator: SummaryGenerator,
    private readonly findingsGenerator: FindingsGenerator,
    private readonly recommendationsGenerator: RecommendationsGenerator,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(Response.name) private readonly responseModel: Model<ResponseDocument>,
  ) { }

  /**
   * Generate analytics with SSE progress streaming
   * Main entry point for analytics generation
   */
  async generateAnalyticsWithProgress(
    formId: string,
    progressCallback: ProgressCallback
  ): Promise<void> {
    let taskId: string | undefined;
    let lockToken: LockToken | null = null;

    try {
      // 1. Create task
      taskId = await this.taskManager.createTask(formId);

      progressCallback({
        type: 'start',
        message: 'Starting analytics generation...',
        progress: 0,
        taskId,
      });

      // 2. Load form
      const form = await this.formModel.findById(formId).exec();
      if (!form) {
        throw new Error(`Form ${formId} not found`);
      }

      // 3. Acquire form lock (prevents concurrent runs)
      progressCallback({
        type: 'progress',
        message: 'Acquiring form lock...',
        progress: 2,
        taskId,
      });

      lockToken = await this.taskManager.acquireFormLock(formId, taskId);
      if (!lockToken) {
        throw new Error('Another analytics process is already running for this form');
      }

      // 4. Process individual responses (5-45%)
      progressCallback({
        type: 'progress',
        message: 'Processing individual responses...',
        progress: 5,
        taskId,
      });

      const processingResult = await this.responseProcessor.processResponses(
        form,
        taskId,
        (update) => {
          // Forward processor progress (already in 5-45% range)
          progressCallback(update);
        }
      );

      this.logger.log(`[${taskId}] Processed ${processingResult.processedCount} responses`);

      // 5. Cluster topics (45-55%)
      progressCallback({
        type: 'progress',
        message: 'Clustering topics into canonical categories...',
        progress: 45,
        taskId,
      });

      const clusteringResult = await this.topicClusterer.clusterAndStoreCanonicalTopics(
        form._id as Types.ObjectId,
        taskId,
        (update) => {
          // Forward clustering progress (already in 47-50% range)
          progressCallback(update);
        }
      );

      this.logger.log(`[${taskId}] Created ${clusteringResult.canonicalTopics.length} canonical topics`);

      // 5.5 Mark responses as processed before aggregate calculations
      progressCallback({
        type: 'progress',
        message: 'Finalizing response processing...',
        progress: 55,
        taskId,
      });

      // Ensure processedForAnalytics=true so aggregate stage can load responses
      await this.responseProcessor.releaseTaskClaim(taskId, form._id as Types.ObjectId);

      // 6. Generate aggregate analytics (60-95%)
      progressCallback({
        type: 'progress',
        message: 'Generating aggregate analytics...',
        progress: 60,
        taskId,
      });

      const aggregateResult = await this.generateAggregateInsights(
        form,
        taskId,
        progressCallback
      );

      // 7. Save analytics to form (95-100%)
      progressCallback({
        type: 'progress',
        message: 'Saving analytics results...',
        progress: 95,
        taskId,
      });

      await this.saveAnalyticsToForm(form, aggregateResult);

      // 8. Release lock and complete task
      await this.taskManager.releaseFormLock(lockToken);
      await this.taskManager.completeTask(taskId, true);

      progressCallback({
        type: 'complete',
        message: 'Analytics generation completed successfully',
        progress: 100,
        taskId,
        stats: {
          processedResponses: processingResult.processedCount,
          canonicalTopics: clusteringResult.canonicalTopics.length,
          totalTopics: (aggregateResult.topTopics || []).length,
        },
      });

    } catch (error) {
      this.logger.error(`Error:`, error);

      // Mark responses as processed before cleanup (best effort)
      if (taskId) {
        try {
          this.logger.log(`[${taskId}] Releasing task claim and marking responses as processed (cleanup)`);
          const form = await this.formModel.findById(formId).exec();
          if (form) {
            await this.responseProcessor.releaseTaskClaim(taskId, form._id as Types.ObjectId);
            this.logger.log(`[${taskId}] Responses marked as processed during cleanup`);
          }
        } catch (releaseError) {
          this.logger.error(`[${taskId}] Failed to release task claim during cleanup:`, releaseError);
        }
      }

      // Cleanup on error
      if (lockToken) {
        await this.taskManager.releaseFormLock(lockToken);
      }
      if (taskId) {
        await this.taskManager.failTask(taskId, error.message);
      }

      progressCallback({
        type: 'error',
        message: `Analytics generation failed: ${error.message}`,
        progress: 0,
        taskId: taskId || 'unknown',
      });

      throw error;
    }
  }

  /**
   * Generate aggregate insights from processed responses
   * Coordinates: Statistics → Correlations → Generators
   */
  private async generateAggregateInsights(
    form: FormDocument,
    taskId: string,
    progressCallback: ProgressCallback
  ): Promise<any> {
    // Load all processed responses
    const responses = await this.responseModel.find({
      formId: form._id,
      'metadata.processedForAnalytics': true,
    }).exec();

    if (responses.length === 0) {
      return {
        topicFrequencies: {},
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0, averageScore: 0 },
        topicCooccurrence: [],
        topicSentimentCorrelation: [],
        dataQuality: { score: 0, completenessRate: 0, averageDepth: 0 },
        summary: 'No responses to analyze yet.',
        keyFindings: [],
        recommendations: [],
      };
    }

    // Stage 1: Calculate statistics (60-70%)
    progressCallback({
      type: 'progress',
      message: 'Calculating topic frequencies and sentiment distribution...',
      progress: 60,
      taskId,
    });

    const topicFrequencies = this.statisticsCalculator.calculateTopicFrequencies(responses);
    const sentimentDistribution = this.sentimentCalculator.calculateSentimentDistribution(responses);
    const dataQuality = this.statisticsCalculator.assessDataQuality(responses);

    progressCallback({
      type: 'progress',
      message: 'Applying theoretical sampling...',
      progress: 65,
      taskId,
    });

    const samplingStrategy = this.statisticsCalculator.determineTheoreticalSampling(responses, form);

    // Identify emerging themes
    const emergingThemes = this.statisticsCalculator.identifyEmergingThemes(responses, topicFrequencies);

    // Stage 2: Calculate correlations (70-75%)
    progressCallback({
      type: 'progress',
      message: 'Analyzing topic correlations...',
      progress: 70,
      taskId,
    });

    const topicCooccurrence = this.correlationCalculator.calculateTopicCooccurrence(responses);
    const topicSentimentCorrelation = this.correlationCalculator.calculateTopicSentimentCorrelation(responses);
    const closedQuestionTopics = this.correlationCalculator.calculateClosedQuestionTopicCorrelations(form, responses);

    // Stage 3: Get top topics (75-80%)
    progressCallback({
      type: 'progress',
      message: 'Identifying top topics...',
      progress: 75,
      taskId,
    });

    const topTopics = Object.entries(topicFrequencies)
      .sort(([, a]: any, [, b]: any) => b.count - a.count)
      .slice(0, 15)
      .map(([topic]) => topic);

    // Collect quotes and representative responses
    const representativeQuotes = this.collectQuotesFromResponses(responses).slice(0, 10);
    const emotionalTones = this.collectEmotionalTones(responses);

    // Calculate climate data for Overall Response Climate card
    const climateData = this.statisticsCalculator.calculateClimateData(
      responses,
      topTopics,
      sentimentDistribution,
      emotionalTones
    );

    // Stage 4: Generate findings (80-85%)
    progressCallback({
      type: 'progress',
      message: 'Generating key findings...',
      progress: 80,
      taskId,
    });

    const keyFindings = this.findingsGenerator.generateKeyFindings(
      responses,
      topTopics,
      topicFrequencies,
      sentimentDistribution,
      representativeQuotes,
      emotionalTones,
      dataQuality
    );

    // Stage 5: Generate recommendations (85-90%)
    progressCallback({
      type: 'progress',
      message: 'Generating recommendations...',
      progress: 85,
      taskId,
    });

    // Get canonical (clustered) topics from responses metadata
    const canonicalTopicsSet = new Set<string>();
    responses.forEach(r => {
      const topics = r.metadata?.canonicalTopics || [];
      topics.forEach(t => canonicalTopicsSet.add(t));
    });
    const canonicalTopicsList = Array.from(canonicalTopicsSet);

    const recommendations = await this.recommendationsGenerator.generateRecommendations(
      sentimentDistribution,
      canonicalTopicsList.length > 0 ? canonicalTopicsList : Object.keys(topicFrequencies), // Use canonical topics if available
      dataQuality
    );

    // Stage 6: Generate summary (90-95%)
    progressCallback({
      type: 'progress',
      message: 'Generating executive summary...',
      progress: 90,
      taskId,
    });

    const closedQuestionCorrelations = [
      { topics: topicCooccurrence },
      { sentiment: topicSentimentCorrelation }
    ];

    const summary = await this.summaryGenerator.generateAnalyticsSummary(
      form,
      responses,
      topTopics,
      sentimentDistribution,
      keyFindings,
      recommendations,
      representativeQuotes,
      closedQuestionCorrelations,
    );

    return {
      topicFrequencies,
      sentimentDistribution,
      topicCooccurrence,
      topicSentimentCorrelation,
      closedQuestionTopics,
      dataQuality,
      summary,
      keyFindings,
      recommendations,
      topTopics,
      emotionalTones,
      emergingThemes,
      climateData,
    };
  }

  /**
   * Save aggregate analytics to Form document
   */
  private async saveAnalyticsToForm(
    form: FormDocument,
    aggregate: any
  ): Promise<void> {
    // Get all processed responses for quotes
    const responses = await this.responseModel.find({
      formId: form._id,
      'metadata.processedForAnalytics': true,
    }).exec();

    // Collect quotes
    const allQuotes = this.collectQuotesFromResponses(responses);
    const representativeQuotes = allQuotes.slice(0, 10);
    const highQualityQuotes = allQuotes.filter(q => (q as any).impact > 0.7).slice(0, 5);

    // Safety checks for aggregate data
    const topTopics = aggregate.topTopics || [];
    const topicFrequencies = aggregate.topicFrequencies || {};
    const topicCooccurrence = aggregate.topicCooccurrence || [];
    const topicSentimentCorrelation = aggregate.topicSentimentCorrelation || [];
    const closedQuestionTopics = aggregate.closedQuestionTopics || [];
    const emergingThemes = aggregate.emergingThemes || [];
    const sentimentDistribution = aggregate.sentimentDistribution || { positive: 0, neutral: 0, negative: 0, averageScore: 0 };
    const emotionalTones = aggregate.emotionalTones || [];
    const climateData = aggregate.climateData || null;

    // Update form analytics
    form.analytics = {
      lastUpdated: new Date(),
      totalResponsesAnalyzed: responses.length,
      cacheVersion: 1,
      climate: climateData, // ADD: Climate data for Overall Response Climate card
      topics: {
        distribution: topicFrequencies,
        topTopics: topTopics,
        dominantThemes: topTopics.slice(0, 5).map((topic: string) => ({
          theme: topic,
          frequency: topicFrequencies[topic]?.count || 0,
          sentiment: topicFrequencies[topic]?.sentimentBreakdown || { positive: 0, neutral: 0, negative: 0 },
          representativeQuotes: [],
          relatedQuestions: topicFrequencies[topic]?.associatedQuestions || [],
        })),
        emergingThemes: emergingThemes, // ADD: Emerging themes
        counterNarratives: [],
        cooccurrence: topicCooccurrence, // ADD: Topic co-occurrence data
      },
      sentiment: {
        overall: sentimentDistribution,
        byQuestion: {},
        emotionalTones: emotionalTones,
        dominantTags: [],
        topicCorrelations: topicSentimentCorrelation, // ADD: Topic-sentiment correlations
      },
      correlations: {
        byQuestion: {},
        questionPairs: [],
        topCorrelations: topicCooccurrence.slice(0, 10),
        closedQuestionTopics: closedQuestionTopics, // ADD: Closed question topic correlations
      },
      quotes: {
        representative: representativeQuotes as any,
        highQuality: highQualityQuotes as any,
        deviant: [],
      },
      deviantCases: [],
      insights: {
        summary: aggregate.summary || '',
        keyFindings: aggregate.keyFindings || [],
        recommendations: aggregate.recommendations || [],
      },
    };

    await form.save();
  }

  /**
   * Theoretical sampling (simplified - placeholder for future enhancement)
   */
  private theoreticalSample(responses: ResponseDocument[], strategy: any): ResponseDocument[] {
    // For now, return all responses
    // Future: implement stratified sampling based on strategy
    return responses;
  }

  /**
   * Collect quotes from responses
   */
  private collectQuotesFromResponses(responses: ResponseDocument[]): any[] {
    const allQuotes: any[] = [];

    responses.forEach(r => {
      if (r.metadata?.quotes?.keyQuotes && Array.isArray(r.metadata.quotes.keyQuotes)) {
        r.metadata.quotes.keyQuotes.forEach((quote: any) => {
          allQuotes.push({
            text: quote.quote || quote.text || '',
            responseId: (r._id as Types.ObjectId).toString(),
            submittedAt: r.submittedAt || new Date(),
            topics: quote.relatedTopics || quote.themes || [],
            sentiment: r.metadata?.overallSentiment?.label || 'neutral',
            emotionalTone: r.metadata?.overallSentiment?.emotionalTone || 'neutral',
            representativeness: 'typical',
            depth: r.metadata?.quotes?.responseQuality?.depth || 'moderate',
          });
        });
      }
    });

    return allQuotes;
  }

  /**
   * Collect emotional tones from responses
   */
  private collectEmotionalTones(responses: ResponseDocument[]): Array<{ tone: string; percentage: number }> {
    const tones = responses
      .map(r => r.metadata?.overallSentiment?.emotionalTone)
      .filter((tone): tone is string => typeof tone === 'string');

    const toneCounts = tones.reduce((acc, tone) => {
      acc[tone] = (acc[tone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalTones = tones.length;

    return Object.entries(toneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tone, count]) => ({
        tone,
        percentage: Math.round((count / totalTones) * 100),
      }));
  }
}
