import { Injectable } from '@nestjs/common';
import { END, START, StateGraph, Annotation } from '@langchain/langgraph';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { SpanType, withSpan } from '@mlflow/core';
import { Form } from '../../schemas/form.schema';
import type { FormDocument } from '../../schemas/form.schema';
import { Response } from '../../schemas/response.schema';
import type { ResponseDocument } from '../../schemas/response.schema';
import { SummaryGenerator } from '../../analytics/generators/summary.generator';
import { FindingsGenerator } from '../../analytics/generators/findings.generator';
import { RecommendationsGenerator } from '../../analytics/generators/recommendations.generator';
import type { TrendAnalysis } from '../../analytics/calculators/trend.calculator';
import { topicCorrelationToCountBreakdown } from '../../analytics/calculators/correlation.calculator';
import {
  runWithMlflowTraceContextAsync,
  applyMlflowTraceMetadata,
  withGraphNodeSpan,
} from '../../mlflow/mlflow-trace-context';
import { flushMlflowTraces } from '../../mlflow/mlflow-langchain-tracing';

const InsightsState = Annotation.Root({
  taskId: Annotation<string>,
  formId: Annotation<string>,
  form: Annotation<FormDocument | null>,
  responseCount: Annotation<number>,
  summary: Annotation<string | undefined>,
  findings: Annotation<unknown[] | undefined>,
  recommendations: Annotation<unknown[] | undefined>,
  error: Annotation<string | undefined>,
});

export type InsightsGraphResult = {
  summary: string;
  findingsCount: number;
  recommendationsCount: number;
};

@Injectable()
export class AnalyticsInsightsGraphService {
  constructor(
    private readonly summaryGenerator: SummaryGenerator,
    private readonly findingsGenerator: FindingsGenerator,
    private readonly recommendationsGenerator: RecommendationsGenerator,
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
    @InjectModel(Response.name)
    private readonly responseModel: Model<ResponseDocument>,
  ) {}

  async runInsightsGraph(
    taskId: string,
    formId: string,
    userId?: string,
  ): Promise<InsightsGraphResult> {
    const ctx = {
      sessionId: taskId,
      user: userId,
      tags: {
        graph: 'analytics_insights',
        formId,
        taskId,
        ...(userId ? { userId } : {}),
      },
    };

    return runWithMlflowTraceContextAsync(ctx, async () =>
      withSpan(
        async () => {
          applyMlflowTraceMetadata(ctx);
          try {
            return await this.executeGraph(taskId, formId, userId);
          } finally {
            await flushMlflowTraces();
          }
        },
        {
          name: 'formulai.graph.analytics_insights',
          spanType: SpanType.CHAIN,
          inputs: { taskId, formId, userId },
        },
      ),
    );
  }

  private async executeGraph(
    taskId: string,
    formId: string,
    userId?: string,
  ): Promise<InsightsGraphResult> {
    const graphId = 'analytics_insights';
    const graph = new StateGraph(InsightsState)
      .addNode('loadFormData', async () =>
        withGraphNodeSpan(graphId, 'loadFormData', { formId }, async () => {
          const form = await this.formModel.findById(formId).exec();
          if (!form?.analytics) {
            throw new Error('Form or analytics not found');
          }
          const responseCount = await this.responseModel
            .countDocuments({
              formId: new Types.ObjectId(formId),
              'metadata.processedForAnalytics': true,
            })
            .exec();
          return { form, responseCount };
        }),
      )
      .addNode('generateFindingsAndSummary', async (state) =>
        withGraphNodeSpan(
          graphId,
          'generateFindingsAndSummary',
          { formId, responseCount: state.responseCount },
          async () => {
            const responses =
              state.responseCount > 0
                ? await this.fetchInsightsSample(formId, state.responseCount)
                : [];

            const [findings, summary] = await Promise.all([
              this.generateFindings(state.form!, responses),
              this.generateSummary(
                state.form!,
                responses,
                [],
                state.taskId,
                userId,
              ),
            ]);

            await this.formModel.updateOne(
              { _id: new Types.ObjectId(formId) },
              {
                $set: {
                  'analytics.insights.keyFindings': findings,
                  'analytics.insights.summary': summary,
                  'analytics.lastUpdated': new Date(),
                },
              },
            );

            return { findings, summary };
          },
        ),
      )
      .addNode('generateRecommendations', async (state) =>
        withGraphNodeSpan(
          graphId,
          'generateRecommendations',
          { formId, responseCount: state.responseCount },
          async () => {
            const responses =
              state.responseCount > 0
                ? await this.fetchInsightsSample(formId, state.responseCount)
                : [];
            const recommendations = await this.generateRecommendations(
              state.form!,
              responses,
            );
            await this.formModel.updateOne(
              { _id: new Types.ObjectId(formId) },
              {
                $set: {
                  'analytics.insights.recommendations': recommendations,
                  'analytics.lastUpdated': new Date(),
                },
              },
            );
            return { recommendations };
          },
        ),
      )
      .addEdge(START, 'loadFormData')
      .addEdge('loadFormData', 'generateFindingsAndSummary')
      .addEdge('generateFindingsAndSummary', 'generateRecommendations')
      .addEdge('generateRecommendations', END)
      .compile();

    const result = await graph.invoke({ taskId, formId });
    const summary =
      result.summary?.trim() ||
      `Analysis complete for form ${formId}.`;

    console.log(
      `[AnalyticsInsightsGraph][${taskId}] Completed: summary=${summary.length} chars, findings=${result.findings?.length ?? 0}, recommendations=${result.recommendations?.length ?? 0}`,
    );

    return {
      summary,
      findingsCount: result.findings?.length ?? 0,
      recommendationsCount: result.recommendations?.length ?? 0,
    };
  }

  private async generateFindings(
    form: FormDocument,
    responses: ResponseDocument[],
  ) {
    const topTopics = form.analytics!.topics?.topTopics || [];
    const topicFrequencies = form.analytics!.topics?.distribution || {};
    const sentimentDistribution = form.analytics!.sentiment?.overall || {
      positive: 0,
      neutral: 0,
      negative: 0,
      averageScore: 0,
    };
    const representativeQuotes =
      form.analytics!.quotes?.representative || [];
    const emotionalTones = form.analytics!.sentiment?.emotionalTones || [];
    const dataQuality = {
      totalResponses: responses.length,
      validResponses: responses.filter((r) => r.metadata?.processedForAnalytics)
        .length,
      averageResponseLength: 0,
      completionRate: 0,
      textQuality: 'medium' as const,
      overallScore: 0.7,
    };
    const topicSentimentRecord = this.buildTopicSentimentRecord(form);
    const trends = this.buildTrends(form);

    return this.findingsGenerator.generateKeyFindings(
      responses,
      topTopics,
      topicFrequencies,
      sentimentDistribution,
      representativeQuotes,
      emotionalTones,
      dataQuality,
      topicSentimentRecord,
      trends,
    );
  }

  private async generateSummary(
    form: FormDocument,
    responses: ResponseDocument[],
    keyFindings: unknown[],
    taskId: string,
    userId?: string,
  ) {
    const topTopics = form.analytics!.topics?.topTopics || [];
    const sentimentDistribution = form.analytics!.sentiment?.overall || {
      positive: 0,
      neutral: 0,
      negative: 0,
      averageScore: 0,
    };
    const representativeQuotes =
      form.analytics!.quotes?.representative || [];
    const recommendations = form.analytics!.insights?.recommendations || [];
    const closedQuestionCorrelations = [
      { topics: form.analytics!.topics?.cooccurrence || [] },
      { sentiment: form.analytics!.sentiment?.topicCorrelations || [] },
    ];
    const topicSentiment = this.buildTopicSentimentMap(form);
    const trends = this.buildTrends(form);
    const responseCount =
      responses.length > 0
        ? responses.length
        : (form.analytics!.totalResponsesAnalyzed ?? 0);

    let summary = await this.summaryGenerator.generateAnalyticsSummary(
      form,
      responses,
      topTopics,
      sentimentDistribution,
      keyFindings as any[],
      recommendations as any[],
      representativeQuotes,
      closedQuestionCorrelations,
      topicSentiment,
      trends,
      responseCount,
      taskId,
      userId,
    );

    if (!summary?.trim()) {
      const sentimentLabel =
        (sentimentDistribution.positive ?? 0) >
        (sentimentDistribution.negative ?? 0)
          ? 'positive'
          : (sentimentDistribution.negative ?? 0) >
              (sentimentDistribution.positive ?? 0)
            ? 'negative'
            : 'neutral';
      const top3 = (topTopics || []).slice(0, 3).join(', ');
      summary = `Analysis of ${responseCount} responses to "${form.title}". Top themes: ${top3}. Overall sentiment is ${sentimentLabel}.`;
    }
    return summary;
  }

  private async generateRecommendations(
    form: FormDocument,
    responses: ResponseDocument[],
  ) {
    const sentimentDistribution = form.analytics!.sentiment?.overall || {
      positive: 0,
      neutral: 0,
      negative: 0,
      averageScore: 0,
    };
    const canonicalTopicsSet = new Set<string>();
    responses.forEach((r) => {
      (r.metadata?.canonicalTopics || []).forEach((t) =>
        canonicalTopicsSet.add(t),
      );
    });
    const canonicalTopics = Array.from(canonicalTopicsSet);
    const dataQuality = {
      totalResponses: responses.length,
      validResponses: responses.filter((r) => r.metadata?.processedForAnalytics)
        .length,
      averageResponseLength: 0,
      completionRate: 0,
      textQuality: 'medium' as const,
      overallScore: 0.7,
    };
    const topicSentimentRecord = this.buildTopicSentimentRecord(form);
    const trends = this.buildTrends(form);

    return this.recommendationsGenerator.generateRecommendations(
      sentimentDistribution,
      canonicalTopics,
      dataQuality,
      responses,
      topicSentimentRecord,
      trends,
    );
  }

  private buildTopicSentimentMap(form: FormDocument) {
    const topicSentiment = new Map<
      string,
      { positive: number; neutral: number; negative: number }
    >();
    (form.analytics!.sentiment?.topicCorrelations || []).forEach((tc: any) => {
      if (tc.topic && tc.sentiment) {
        const counts = topicCorrelationToCountBreakdown(tc);
        topicSentiment.set(tc.topic, {
          positive: counts.positive,
          neutral: counts.neutral,
          negative: counts.negative,
        });
      }
    });
    return topicSentiment;
  }

  private buildTopicSentimentRecord(form: FormDocument) {
    const record: Record<
      string,
      { positive: number; neutral: number; negative: number; total: number }
    > = {};
    (form.analytics!.sentiment?.topicCorrelations || []).forEach((tc: any) => {
      if (tc.topic && tc.sentiment) {
        record[tc.topic] = topicCorrelationToCountBreakdown(tc);
      }
    });
    return record;
  }

  private buildTrends(form: FormDocument): TrendAnalysis | undefined {
    const stored = form.analytics!.trendAnalysis;
    if (!stored?.hasEnoughData) return undefined;
    return {
      hasEnoughData: true,
      emergingTopics: stored.emergingTopics || [],
      decliningTopics: stored.decliningTopics || [],
      sentimentShifts: stored.sentimentShifts || [],
      volumeTrend: stored.volumeTrend || 'stable',
      periodComparison: stored.periodComparison || null,
    };
  }

  private async fetchInsightsSample(
    formId: string,
    responseCount: number,
  ): Promise<ResponseDocument[]> {
    const sampleSize = Math.min(
      Math.max(200, Math.ceil(Math.sqrt(responseCount) * 10)),
      2000,
    );

    if (responseCount <= sampleSize) {
      const docs = await this.responseModel
        .find({
          formId: new Types.ObjectId(formId),
          'metadata.processedForAnalytics': true,
        })
        .select(
          'answers metadata.canonicalTopics metadata.allTopics metadata.quotes metadata.overallSentiment submittedAt',
        )
        .lean()
        .exec();
      return docs as unknown as ResponseDocument[];
    }

    const sampled = await this.responseModel
      .aggregate([
        {
          $match: {
            formId: new Types.ObjectId(formId),
            'metadata.processedForAnalytics': true,
          },
        },
        { $sample: { size: sampleSize } },
        {
          $project: {
            submittedAt: 1,
            answers: 1,
            'metadata.canonicalTopics': 1,
            'metadata.allTopics': 1,
            'metadata.quotes': 1,
            'metadata.overallSentiment': 1,
          },
        },
      ])
      .exec();

    return sampled as ResponseDocument[];
  }
}
