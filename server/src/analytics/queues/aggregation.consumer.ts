import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { QueueName } from './queue.names';
import type { AggregationJobData } from './queue.names';
import { StatisticsCalculator } from '../calculators/statistics.calculator';
import { CorrelationCalculator } from '../calculators/correlation.calculator';
import { TrendCalculator } from '../calculators/trend.calculator';
import { ProgressService } from './progress.service';
import { DeadLetterService } from './dead-letter.service';
import { MlflowPromptService } from '../../mlflow/mlflow-prompt.service';
import { AnalyticsAggregationService } from '../utils/analytics-aggregation.service';
import { extractQuestionFocusPhrases } from '../utils/topic-question-filter.util';
import { Form } from '../../schemas/form.schema';
import type { FormDocument } from '../../schemas/form.schema';
import type { ResponseDocument } from '../../schemas/response.schema';

@Processor(QueueName.AGGREGATION)
export class AggregationConsumer {
  constructor(
    private readonly statisticsCalculator: StatisticsCalculator,
    private readonly correlationCalculator: CorrelationCalculator,
    private readonly trendCalculator: TrendCalculator,
    private readonly progressService: ProgressService,
    private readonly deadLetterService: DeadLetterService,
    private readonly mlflowPrompts: MlflowPromptService,
    private readonly aggregationService: AnalyticsAggregationService,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
  ) {}

  @Process('aggregate-analytics')
  async handleAggregation(job: Job<AggregationJobData>) {
    const { taskId, formId } = job.data;

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Loading processed responses...',
      progress: 56,
    });

    const form = await this.formModel.findById(formId).exec();
    if (!form) {
      throw new Error(`Form ${formId} not found`);
    }

    const responseCount =
      await this.aggregationService.countProcessedResponses(formId);

    console.log(
      `[AggregationConsumer][${taskId}] Processing ${responseCount} responses via aggregation pipelines`,
    );

    if (responseCount === 0) {
      console.log(`[AggregationConsumer][${taskId}] No processed responses found`);
      return { success: true, message: 'No processed responses to aggregate' };
    }

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Calculating topic frequencies...',
      progress: 58,
    });

    const questionFocusPhrases = extractQuestionFocusPhrases(form);

    const topicFrequencies =
      await this.aggregationService.aggregateTopicFrequencies(
        formId,
        questionFocusPhrases,
      );
    const topTopics = Object.entries(topicFrequencies)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 15)
      .map(([topic]) => topic);

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Analyzing sentiment distribution...',
      progress: 60,
    });

    const sentimentDistribution =
      await this.aggregationService.aggregateSentimentDistribution(formId);

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Assessing data quality...',
      progress: 65,
    });

    const qualitySummary =
      await this.aggregationService.aggregateDataQualitySummary(formId);
    const emergingSample =
      await this.aggregationService.fetchEmergingThemesSample(formId);
    const samplingStrategy = this.statisticsCalculator.determineTheoreticalSampling(
      emergingSample,
      form,
    );
    const emergingThemes = this.statisticsCalculator.identifyEmergingThemes(
      emergingSample,
      topicFrequencies,
    );

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Calculating topic correlations...',
      progress: 68,
    });

    const topicCooccurrence =
      await this.aggregationService.streamTopicCooccurrence(formId);
    const topicMapping =
      await this.aggregationService.aggregateTopicMapping(formId);
    const topicSentimentCorrelation =
      await this.aggregationService.aggregateTopicSentimentCorrelation(
        formId,
        15,
        questionFocusPhrases,
      );

    const closedQuestionSample =
      await this.aggregationService.fetchClosedQuestionSample(formId);
    const closedQuestionTopics =
      this.correlationCalculator.calculateClosedQuestionTopicCorrelations(
        form,
        closedQuestionSample as ResponseDocument[],
      );

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Collecting representative quotes...',
      progress: 72,
    });

    const quoteDocs =
      await this.aggregationService.fetchRepresentativeQuoteDocs(formId);
    const representativeQuotes = this.collectQuotesFromDocs(quoteDocs).slice(
      0,
      10,
    );
    const emotionalTones =
      await this.aggregationService.aggregateEmotionalTones(formId);

    const climateData = this.statisticsCalculator.calculateClimateData(
      emergingSample,
      topTopics,
      sentimentDistribution,
      emotionalTones,
    );

    const canonicalTopics =
      await this.aggregationService.aggregateCanonicalTopics(formId);

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Analyzing temporal trends...',
      progress: 74,
    });

    const trendSample = await this.aggregationService.fetchTrendSample(formId);
    const trendAnalysis = this.trendCalculator.calculateTrends(
      trendSample,
      canonicalTopics,
    );

    await this.progressService.publishProgress({
      taskId,
      type: 'progress',
      message: 'Saving aggregated analytics...',
      progress: 75,
    });

    const analyticsFlowKeys = [
      'analytics.combined_analysis',
      'analytics.topic_extraction',
      'analytics.sentiment',
      'analytics.quote_extraction',
      'analytics.topic_clustering',
      'analytics.topic_clustering_batch',
      'analytics.summary',
    ];
    const promptVersions =
      await this.mlflowPrompts.getPromptVersionsForFlows(analyticsFlowKeys);

    form.analytics = {
      lastUpdated: new Date(),
      totalResponsesAnalyzed: responseCount,
      cacheVersion: 1,
      promptVersions,
      climate: climateData,
      topics: {
        distribution: topicFrequencies,
        topTopics,
        dominantThemes: topTopics.slice(0, 10).map((topic: string) => ({
          theme: topic,
          frequency: topicFrequencies[topic]?.count || 0,
          sentiment: topicFrequencies[topic]?.sentimentBreakdown || {
            positive: 0,
            neutral: 0,
            negative: 0,
          },
          representativeQuotes: [],
          relatedQuestions: topicFrequencies[topic]?.associatedQuestions || [],
        })),
        emergingThemes,
        counterNarratives: [],
        cooccurrence: topicCooccurrence,
        topicMapping,
      },
      sentiment: {
        overall: sentimentDistribution,
        byQuestion: {},
        emotionalTones,
        dominantTags: [],
        topicCorrelations: topicSentimentCorrelation,
      },
      correlations: {
        byQuestion: {},
        questionPairs: [],
        topCorrelations: topicCooccurrence.slice(0, 10),
        closedQuestionTopics,
      },
      quotes: {
        representative: representativeQuotes as any,
        highQuality: representativeQuotes
          .filter((q) => (q as any).depth === 'deep')
          .slice(0, 5) as any,
        deviant: [],
      },
      deviantCases: [],
      insights: {
        summary: '',
        keyFindings: [],
        recommendations: [],
      },
      trendAnalysis: trendAnalysis.hasEnoughData
        ? {
            hasEnoughData: true,
            emergingTopics: trendAnalysis.emergingTopics || [],
            decliningTopics: trendAnalysis.decliningTopics || [],
            sentimentShifts: trendAnalysis.sentimentShifts || [],
            volumeTrend: trendAnalysis.volumeTrend || 'stable',
            periodComparison: trendAnalysis.periodComparison || undefined,
          }
        : undefined,
    };

    await form.save();

    console.log(
      `[AggregationConsumer][${taskId}] Aggregation complete - stored analytics for ${responseCount} responses (sampling strategy: ${samplingStrategy.description}, quality score: ${qualitySummary.avgCompleteness})`,
    );

    return {
      success: true,
      topTopics: topTopics.length,
      sentimentDistribution,
      canonicalTopics: canonicalTopics.length,
    };
  }

  private collectQuotesFromDocs(
    docs: Array<{
      _id: Types.ObjectId;
      submittedAt?: Date;
      metadata?: ResponseDocument['metadata'];
    }>,
  ): any[] {
    const allQuotes: any[] = [];

    docs.forEach((r) => {
      if (
        r.metadata?.quotes?.keyQuotes &&
        Array.isArray(r.metadata.quotes.keyQuotes)
      ) {
        r.metadata.quotes.keyQuotes.forEach((quote: any) => {
          allQuotes.push({
            text: quote.quote || quote.text || '',
            responseId: String(r._id),
            submittedAt: r.submittedAt || new Date(),
            topics: quote.relatedTopics || quote.themes || [],
            sentiment: r.metadata?.overallSentiment?.label || 'neutral',
            emotionalTone:
              r.metadata?.overallSentiment?.emotionalTone || 'neutral',
            representativeness: 'typical',
            depth: r.metadata?.quotes?.responseQuality?.depth || 'moderate',
          });
        });
      }
    });

    return allQuotes;
  }

  @OnQueueFailed()
  onFailed(job: Job<AggregationJobData>, error: Error) {
    console.error(`[Aggregation] Job ${job.id} failed:`, error.message);
    this.deadLetterService.forwardWhenExhausted(QueueName.AGGREGATION, job, error);
  }
}
