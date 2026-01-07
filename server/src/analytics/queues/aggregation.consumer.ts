import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { QueueName } from './queue.names';
import type { AggregationJobData } from './queue.names';
import { StatisticsCalculator } from '../calculators/statistics.calculator';
import { CorrelationCalculator } from '../calculators/correlation.calculator';
import { SentimentCalculator } from '../calculators/sentiment.calculator';
import { TrendCalculator } from '../calculators/trend.calculator';
import { ProgressService } from './progress.service';
import { DeadLetterService } from './dead-letter.service';
import { Form } from '../../schemas/form.schema';
import type { FormDocument } from '../../schemas/form.schema';
import { Response } from '../../schemas/response.schema';
import type { ResponseDocument } from '../../schemas/response.schema';

@Processor(QueueName.AGGREGATION)
export class AggregationConsumer {
  constructor(
    private readonly statisticsCalculator: StatisticsCalculator,
    private readonly correlationCalculator: CorrelationCalculator,
    private readonly sentimentCalculator: SentimentCalculator,
    private readonly trendCalculator: TrendCalculator,
    private readonly progressService: ProgressService,
    private readonly deadLetterService: DeadLetterService,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(Response.name) private readonly responseModel: Model<ResponseDocument>,
  ) {}

  @Process({ name: 'aggregate-analytics', concurrency: 2 })
  async handleAggregation(job: Job<AggregationJobData>) {
    const { taskId, formId } = job.data;
    
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Loading processed responses...',
      progress: 56,
    });

    // Load form and processed responses
    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error(`Form ${formId} not found`);
    }

    const responses = await this.responseModel.find({
      formId: new Types.ObjectId(formId),
      'metadata.processedForAnalytics': true,
    }).exec();

    console.log(`[AggregationConsumer][${taskId}] Processing ${responses.length} responses`);

    if (responses.length === 0) {
      console.log(`[AggregationConsumer][${taskId}] No processed responses found`);
      return { success: true, message: 'No processed responses to aggregate' };
    }

    // Step 1: Calculate topic frequencies (56-60%)
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Calculating topic frequencies...',
      progress: 58,
    });

    const topicFrequencies = this.statisticsCalculator.calculateTopicFrequencies(responses);
    console.log(`[AggregationConsumer][${taskId}] Topic frequencies:`, JSON.stringify(topicFrequencies).substring(0, 500));
    const topTopics = Object.entries(topicFrequencies)
      .sort(([, a]: any, [, b]: any) => b.count - a.count)
      .slice(0, 15)
      .map(([topic]) => topic);
    console.log(`[AggregationConsumer][${taskId}] Top topics:`, topTopics);

    // Step 2: Calculate sentiment distribution (60-65%)
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Analyzing sentiment distribution...',
      progress: 60,
    });

    const sentimentDistribution = this.sentimentCalculator.calculateSentimentDistribution(responses);

    // Step 3: Assess data quality (65-68%)
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Assessing data quality...',
      progress: 65,
    });

    const dataQuality = this.statisticsCalculator.assessDataQuality(responses);
    const samplingStrategy = this.statisticsCalculator.determineTheoreticalSampling(responses, form);
    const emergingThemes = this.statisticsCalculator.identifyEmergingThemes(responses, topicFrequencies);

    // Step 4: Calculate correlations (68-72%)
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Calculating topic correlations...',
      progress: 68,
    });

    const topicCooccurrence = this.correlationCalculator.calculateTopicCooccurrence(responses);
    const topicSentimentCorrelation = this.correlationCalculator.calculateTopicSentimentCorrelation(responses);
    const closedQuestionTopics = this.correlationCalculator.calculateClosedQuestionTopicCorrelations(form, responses);

    // Step 5: Collect quotes and emotional tones (72-75%)
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Collecting representative quotes...',
      progress: 72,
    });

    const representativeQuotes = this.collectQuotesFromResponses(responses).slice(0, 10);
    const emotionalTones = this.collectEmotionalTones(responses);

    // Step 6: Calculate climate data (75%)
    const climateData = this.statisticsCalculator.calculateClimateData(
      responses,
      topTopics,
      sentimentDistribution,
      emotionalTones
    );

    // Get canonical topics from responses - enforce canonicalTopics, no fallback to allTopics
    // This must be done BEFORE trend analysis
    const canonicalTopicsSet = new Set<string>();
    let missingCanonicalCount = 0;
    responses.forEach(r => {
      const topics = r.metadata?.canonicalTopics || [];
      if (topics.length === 0 && (r.metadata?.allTopics?.length ?? 0) > 0) {
        missingCanonicalCount++;
      }
      topics.forEach(t => canonicalTopicsSet.add(t));
    });
    if (missingCanonicalCount > 0) {
      console.warn(`[AggregationConsumer][${taskId}] ${missingCanonicalCount} responses have allTopics but no canonicalTopics - topic clustering may have failed`);
    }
    const canonicalTopics = Array.from(canonicalTopicsSet);

    // Step 6b: Calculate temporal trends
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Analyzing temporal trends...',
      progress: 74,
    });

    const trendAnalysis = this.trendCalculator.calculateTrends(responses, canonicalTopics);
    console.log(`[AggregationConsumer][${taskId}] Trend analysis:`, {
      hasEnoughData: trendAnalysis.hasEnoughData,
      emergingTopics: trendAnalysis.emergingTopics?.length || 0,
      decliningTopics: trendAnalysis.decliningTopics?.length || 0,
      sentimentShifts: trendAnalysis.sentimentShifts?.length || 0,
    });

    // Step 7: Store aggregated data in form.analytics (partial - generators will add more)
    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Saving aggregated analytics...',
      progress: 75,
    });

    // Update form with aggregated analytics (partial structure - AI insights will be added later)
    form.analytics = {
      lastUpdated: new Date(),
      totalResponsesAnalyzed: responses.length,
      cacheVersion: 1,
      climate: climateData,
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
        emergingThemes: emergingThemes,
        counterNarratives: [],
        cooccurrence: topicCooccurrence,
      },
      sentiment: {
        overall: sentimentDistribution,
        byQuestion: {},
        emotionalTones: emotionalTones,
        dominantTags: [],
        topicCorrelations: topicSentimentCorrelation,
      },
      correlations: {
        byQuestion: {},
        questionPairs: [],
        topCorrelations: topicCooccurrence.slice(0, 10),
        closedQuestionTopics: closedQuestionTopics,
      },
      quotes: {
        representative: representativeQuotes as any,
        highQuality: representativeQuotes.filter(q => (q as any).depth === 'deep').slice(0, 5) as any,
        deviant: [],
      },
      deviantCases: [],
      insights: {
        summary: '', // Will be filled by AI generation stage
        keyFindings: [], // Will be filled by AI generation stage
        recommendations: [], // Will be filled by AI generation stage
      },
      // Store trend analysis for use by AI generation stage
      trendAnalysis: trendAnalysis.hasEnoughData ? {
        hasEnoughData: true,
        emergingTopics: trendAnalysis.emergingTopics || [],
        decliningTopics: trendAnalysis.decliningTopics || [],
        sentimentShifts: trendAnalysis.sentimentShifts || [],
        volumeTrend: trendAnalysis.volumeTrend || 'stable',
        periodComparison: trendAnalysis.periodComparison || undefined
      } : undefined,
    };

    await form.save();

    console.log(`[AggregationConsumer][${taskId}] Aggregation complete - stored analytics for ${responses.length} responses`);

    job.progress(100);
    return { 
      success: true, 
      topTopics: topTopics.length,
      sentimentDistribution,
      canonicalTopics: canonicalTopics.length,
    };
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
            responseId: String(r._id),
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

  @OnQueueFailed()
  onFailed(job: Job<AggregationJobData>, error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[Aggregation] Job ${job.id} failed:`, error.message);
    this.deadLetterService.forwardWhenExhausted(QueueName.AGGREGATION, job, error);
  }
}
