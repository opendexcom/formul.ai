import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';
import { TrendAnalysis } from '../calculators/trend.calculator';
import { AnalyticsUsageTrackerService } from '../services/analytics-usage-tracker.service';

/**
 * Summary Generator
 *
 * Generates LLM-based executive summary of analytics results
 * Includes:
 * - Context preparation (topic quotes, closed question stats)
 * - LLM prompt construction
 * - Summary generation with fallback handling
 * - Negative topic highlighting and trend awareness
 */
@Injectable()
export class SummaryGenerator {
  constructor(
    private aiService: AiService,
    private promptBuilder: PromptBuilder,
    private analyticsUsageTracker: AnalyticsUsageTrackerService,
  ) {}

  /**
   * Generate comprehensive analytics summary using LLM
   * @param form The form being analyzed
   * @param responses All responses to analyze
   * @param topTopics Top topics from topic extraction
   * @param sentimentDistribution Overall sentiment breakdown
   * @param keyFindings Generated key findings
   * @param recommendations Generated recommendations
   * @param highlightedQuotes Highlighted quotes for citations
   * @param closedQuestionCorrelations Topic correlations with closed questions
   * @param topicSentiment Optional topic-level sentiment for negative topic highlighting
   * @param trends Optional trend analysis for temporal patterns
   */
  async generateAnalyticsSummary(
    form: Form | FormDocument,
    responses: ResponseDocument[],
    topTopics: string[],
    sentimentDistribution: any,
    keyFindings: any[],
    recommendations: any[],
    highlightedQuotes: any[],
    closedQuestionCorrelations: any[],
    topicSentiment?: Map<
      string,
      { positive: number; neutral: number; negative: number }
    >,
    trends?: TrendAnalysis,
    responseCountOverride?: number,
    sessionId?: string,
    userId?: string,
  ): Promise<string> {
    const responseCount = responseCountOverride ?? responses.length;
    try {
      // Find responses related to most common topics for citations
      const topicToResponses = new Map<string, ResponseDocument[]>();

      // Group responses by their topics (prefer canonical, fall back to raw)
      for (const response of responses) {
        const responseTopics =
          response.metadata?.canonicalTopics?.length
            ? response.metadata.canonicalTopics
            : response.metadata?.allTopics || [];
        for (const topic of responseTopics.slice(0, 3)) {
          if (topTopics.includes(topic)) {
            if (!topicToResponses.has(topic)) {
              topicToResponses.set(topic, []);
            }
            const topicResponses = topicToResponses.get(topic);
            if (topicResponses) {
              topicResponses.push(response);
            }
          }
        }
      }

      // Get representative quotes for top 3 topics with highest response counts
      const topicQuotes = this.extractTopicQuotes(topTopics, topicToResponses);

      // Calculate closed question statistics
      const closedQuestionStats = this.calculateClosedQuestionStats(
        form,
        responses,
      );

      // Format insights from closed question topic correlations
      const closedQuestionInsights = this.formatClosedQuestionInsights(
        closedQuestionCorrelations,
      );

      // Calculate negative topics (topics with >40% negative sentiment)
      const negativeTopics = topicSentiment
        ? this.extractNegativeTopics(topicSentiment)
        : [];

      // Format trends for the prompt
      const formattedTrends = trends
        ? {
            emergingTopics: trends.emergingTopics?.map((t) => ({
              topic: t.topic,
              description: t.description,
            })),
            decliningTopics: trends.decliningTopics?.map((t) => ({
              topic: t.topic,
              description: t.description,
            })),
            sentimentShifts: trends.sentimentShifts?.map((s) => ({
              topic: s.topic,
              direction: s.direction,
              description: s.description,
            })),
          }
        : undefined;

      // Build variables and run via registered MLflow flow (traced as formulai.analytics.summary)
      const summaryVariables = this.promptBuilder.buildAnalyticsSummaryVariables(
        form,
        topTopics,
        sentimentDistribution,
        responseCount,
        topicQuotes,
        closedQuestionStats,
        closedQuestionInsights,
        negativeTopics,
        formattedTrends,
      );

      console.log(
        '[SummaryGenerator] Invoking analytics.summary flow, context length:',
        summaryVariables.summaryContext.length,
      );
      const summaryFlow = await this.aiService.invokeFlow(
        'analytics.summary',
        summaryVariables,
        {
          skipValidation: true,
          useJsonFormat: false,
          formId: String((form as FormDocument)._id ?? ''),
          ...(sessionId ? { sessionId } : {}),
          ...(userId ? { userId } : {}),
        },
      );
      if (sessionId) {
        this.analyticsUsageTracker.recordUsage(sessionId, summaryFlow.usage);
      }
      const summary = summaryFlow.content;
      console.log(
        '[SummaryGenerator] AI service returned summary, length:',
        summary?.length || 0,
      );

      if (!summary || summary.trim().length === 0) {
        console.warn(
          '[SummaryGenerator] AI service returned empty summary, using fallback',
        );
        return this.generateFallbackSummary(
          form,
          responseCount,
          topTopics,
          sentimentDistribution,
          highlightedQuotes,
        );
      }

      return summary.trim();
    } catch (error) {
      console.error('[SummaryGenerator] Error generating summary:', error);
      // Fallback to basic summary with quote if available
      return this.generateFallbackSummary(
        form,
        responseCount,
        topTopics,
        sentimentDistribution,
        highlightedQuotes,
      );
    }
  }

  /**
   * Extract representative quotes for top topics
   */
  private extractTopicQuotes(
    topTopics: string[],
    topicToResponses: Map<string, ResponseDocument[]>,
  ): Array<{ topic: string; quote: string; count: number }> {
    return topTopics
      .slice(0, 3)
      .map((topic) => {
        const relatedResponses = topicToResponses.get(topic) || [];
        if (relatedResponses.length > 0) {
          // Get a quote from the first related response
          const response = relatedResponses[0];
          const quote = response.metadata?.quotes?.keyQuotes?.[0];
          return quote
            ? {
                topic,
                quote: quote.quote,
                count: relatedResponses.length,
              }
            : null;
        }
        return null;
      })
      .filter(Boolean) as Array<{
      topic: string;
      quote: string;
      count: number;
    }>;
  }

  /**
   * Calculate statistics for closed questions (multiple_choice, checkbox, dropdown, rating)
   */
  private calculateClosedQuestionStats(
    form: Form | FormDocument,
    responses: ResponseDocument[],
  ): Array<{
    question: string;
    questionType: string;
    topAnswers: Array<{ value: string; count: number; percentage: number }>;
    averageRating?: number;
    ratingDistribution?: { [key: number]: number };
  }> {
    const closedQuestions = form.questions.filter((q) =>
      ['multiple_choice', 'checkbox', 'dropdown', 'rating'].includes(q.type),
    );

    return closedQuestions.map((q) => {
      const answerCounts = new Map<string, number>();
      const ratingValues: number[] = [];

      responses.forEach((r) => {
        const answer = (r.answers ?? []).find((a) => a.questionId === q.id);
        if (answer?.value != null) {
          const values = Array.isArray(answer.value)
            ? answer.value
            : [answer.value];
          values.forEach((v) => {
            const valStr = String(v);
            answerCounts.set(valStr, (answerCounts.get(valStr) || 0) + 1);

            // Collect numeric values for rating calculations
            if (q.type === 'rating') {
              const numVal = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(numVal)) {
                ratingValues.push(numVal);
              }
            }
          });
        }
      });

      const sortedAnswers = Array.from(answerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5 answers for ratings

      const result: {
        question: string;
        questionType: string;
        topAnswers: Array<{ value: string; count: number; percentage: number }>;
        averageRating?: number;
        ratingDistribution?: { [key: number]: number };
      } = {
        question: q.title,
        questionType: q.type,
        topAnswers: sortedAnswers.map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / responses.length) * 100),
        })),
      };

      // Calculate average rating and distribution for rating questions
      if (q.type === 'rating' && ratingValues.length > 0) {
        result.averageRating =
          Math.round(
            (ratingValues.reduce((sum, v) => sum + v, 0) /
              ratingValues.length) *
              10,
          ) / 10;
        result.ratingDistribution = {};
        ratingValues.forEach((v) => {
          result.ratingDistribution![v] =
            (result.ratingDistribution![v] || 0) + 1;
        });
      }

      return result;
    });
  }

  /**
   * Format insights from closed question topic correlations
   */
  private formatClosedQuestionInsights(
    closedQuestionCorrelations: any[],
  ): Array<{
    question: string;
    answer: string;
    count: number;
    topTopic: string;
    topicPercentage: number;
  }> {
    // Safety check: return empty array if structure is not what we expect
    if (
      !Array.isArray(closedQuestionCorrelations) ||
      closedQuestionCorrelations.length === 0
    ) {
      return [];
    }

    return closedQuestionCorrelations
      .slice(0, 2) // Top 2 questions
      .map((qc) => {
        // Check if qc has the expected structure
        if (
          !qc ||
          !Array.isArray(qc.correlations) ||
          qc.correlations.length === 0
        ) {
          return null;
        }

        const topCorrelation = qc.correlations[0]; // Most common answer
        if (!topCorrelation) return null;

        // Check if topicDistribution exists and has items
        if (
          !Array.isArray(topCorrelation.topicDistribution) ||
          topCorrelation.topicDistribution.length === 0
        ) {
          return null;
        }

        const topTopic = topCorrelation.topicDistribution[0];
        if (!topTopic) return null;

        return {
          question: qc.questionTitle,
          answer: topCorrelation.answerValue,
          count: topCorrelation.responseCount,
          topTopic: topTopic.topic,
          topicPercentage: topTopic.percentage,
        };
      })
      .filter(Boolean) as Array<{
      question: string;
      answer: string;
      count: number;
      topTopic: string;
      topicPercentage: number;
    }>;
  }

  /**
   * Extract topics with high negative sentiment (>40% negative)
   */
  private extractNegativeTopics(
    topicSentiment: Map<
      string,
      { positive: number; neutral: number; negative: number }
    >,
  ): Array<{ topic: string; negativePercentage: number; count: number }> {
    const negativeTopics: Array<{
      topic: string;
      negativePercentage: number;
      count: number;
    }> = [];

    for (const [topic, sentiment] of topicSentiment.entries()) {
      const total = sentiment.positive + sentiment.neutral + sentiment.negative;
      if (total === 0) continue;

      const negativePercentage = Math.round((sentiment.negative / total) * 100);
      if (negativePercentage >= 40) {
        negativeTopics.push({
          topic,
          negativePercentage,
          count: total,
        });
      }
    }

    // Sort by negative percentage descending
    return negativeTopics.sort(
      (a, b) => b.negativePercentage - a.negativePercentage,
    );
  }

  /**
   * Generate fallback summary when LLM fails
   */
  private generateFallbackSummary(
    form: Form | FormDocument,
    responseCount: number,
    topTopics: string[],
    sentimentDistribution: any,
    highlightedQuotes: any[],
  ): string {
    const sampleQuote = highlightedQuotes?.[0]?.text;
    const quoteText = sampleQuote
      ? ` One respondent noted: "${sampleQuote.substring(0, 80)}..."`
      : '';

    const sentimentLabel =
      sentimentDistribution.positive > 50
        ? 'positive'
        : sentimentDistribution.negative > 50
          ? 'negative'
          : 'neutral';

    return `Analysis of ${responseCount} responses to "${form.title}". Top themes: ${topTopics.slice(0, 3).join(', ')}.${quoteText} Overall sentiment is ${sentimentLabel}.`;
  }
}
