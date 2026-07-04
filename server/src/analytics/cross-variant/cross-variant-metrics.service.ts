import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { Form, QuestionType } from '../../schemas/form.schema';
import { ProjectVariant } from '../../schemas/project.schema';
import {
  AlignedTopicGroup,
  ClosedQuestionComparison,
  CrossVariantCorrelation,
  Citation,
  VariantKey,
  VariantMetricsSnapshot,
} from '../../projects/comparative-report.types';
import {
  getRatingBounds,
  reverseCodeDistribution,
} from '../utils/reverse-code.util';

export interface VariantAnalyticsBundle {
  key: VariantKey;
  formId: Types.ObjectId;
  form: Form;
  variant: ProjectVariant;
  responseCount: number;
}

export interface MetricComparisonResult {
  variantMetrics: Array<{
    key: VariantKey;
    metricsSnapshot: VariantMetricsSnapshot;
    sentimentDelta?: { positive: number; neutral: number; negative: number };
  }>;
  closedQuestionComparison: ClosedQuestionComparison[];
  topicFrequencyComparison: Array<{
    unifiedLabel: string;
    perVariant: Array<{ key: VariantKey; frequency: number }>;
  }>;
}

@Injectable()
export class CrossVariantMetricsService {
  buildMetricComparison(
    bundles: VariantAnalyticsBundle[],
    alignedTopics: AlignedTopicGroup[],
    sharedQuestionIds: string[],
  ): MetricComparisonResult {
    const baseline = bundles[0]?.form.analytics?.sentiment?.overall;
    const variantMetrics = bundles.map((bundle) => {
      const overall = bundle.form.analytics?.sentiment?.overall;
      const metricsSnapshot: VariantMetricsSnapshot = {
        sentiment: overall
          ? {
              positive: overall.positive ?? 0,
              neutral: overall.neutral ?? 0,
              negative: overall.negative ?? 0,
              averageScore: overall.averageScore,
            }
          : undefined,
        topTopics: bundle.form.analytics?.topics?.topTopics?.slice(0, 8) ?? [],
        climate: bundle.form.analytics?.climate
          ? {
              positivityScore: bundle.form.analytics.climate.positivityScore,
              dominantTendency: bundle.form.analytics.climate.dominantTendency,
            }
          : undefined,
      };

      const sentimentDelta =
        baseline && overall
          ? {
              positive: (overall.positive ?? 0) - (baseline.positive ?? 0),
              neutral: (overall.neutral ?? 0) - (baseline.neutral ?? 0),
              negative: (overall.negative ?? 0) - (baseline.negative ?? 0),
            }
          : undefined;

      return { key: bundle.key, metricsSnapshot, sentimentDelta };
    });

    const closedQuestionComparison = sharedQuestionIds
      .map((questionId) => {
        const firstForm = bundles[0]?.form;
        const question = firstForm?.questions.find((q) => q.id === questionId);
        if (
          !question ||
          (question.type !== QuestionType.MULTIPLE_CHOICE &&
            question.type !== QuestionType.CHECKBOX &&
            question.type !== QuestionType.DROPDOWN &&
            question.type !== QuestionType.RATING)
        ) {
          return null;
        }

        const perVariant = bundles.map((bundle) => {
          const stats = bundle.form.analytics?.questionStats?.[questionId];
          const bundleQuestion = bundle.form.questions.find((q) => q.id === questionId);
          const distribution: Record<string, number> = {};
          if (stats?.distribution) {
            for (const [answer, count] of Object.entries(stats.distribution)) {
              distribution[answer] = count as number;
            }
          }

          let normalizedDistribution = distribution;
          if (question.type === QuestionType.RATING && bundleQuestion?.reverseCoded) {
            const { min, max } = getRatingBounds(bundleQuestion.validation);
            normalizedDistribution = reverseCodeDistribution(distribution, min, max);
          }

          return {
            key: bundle.key,
            distribution: normalizedDistribution,
            reverseCoded: bundleQuestion?.reverseCoded ?? false,
          };
        });

        const reverseCodedVariants = perVariant
          .filter((entry) => entry.reverseCoded)
          .map((entry) => entry.key);

        return {
          questionId,
          questionTitle: question.title,
          perVariant,
          normalizedForComparison: reverseCodedVariants.length > 0,
          reverseCodedVariants,
        };
      })
      .filter(Boolean) as MetricComparisonResult['closedQuestionComparison'];

    const topicFrequencyComparison = alignedTopics.map((group) => ({
      unifiedLabel: group.unifiedLabel,
      perVariant: group.perVariant.map((entry) => ({
        key: entry.key,
        frequency: entry.frequency,
      })),
    }));

    return {
      variantMetrics,
      closedQuestionComparison,
      topicFrequencyComparison,
    };
  }

  buildCorrelationSummaries(
    bundles: VariantAnalyticsBundle[],
    citations: Citation[],
  ): CrossVariantCorrelation[] {
    const results: CrossVariantCorrelation[] = [];

    for (const bundle of bundles) {
      const topCorrelations = bundle.form.analytics?.correlations?.topCorrelations ?? [];
      for (const correlation of topCorrelations.slice(0, 3)) {
        results.push({
          description: `${bundle.key}: ${correlation.topic1} ↔ ${correlation.topic2} (${correlation.relationship ?? 'related'})`,
          metric: 'topic_correlation',
          variants: [bundle.key],
          strength: correlation.strength,
          citations: citations.filter((c) => c.variantKey === bundle.key).slice(0, 2),
        });
      }
    }

    if (bundles.length >= 2) {
      const sentimentGaps = bundles.map((bundle) => ({
        key: bundle.key,
        negative: bundle.form.analytics?.sentiment?.overall?.negative ?? 0,
        positive: bundle.form.analytics?.sentiment?.overall?.positive ?? 0,
      }));
      const maxNegative = Math.max(...sentimentGaps.map((s) => s.negative));
      const minNegative = Math.min(...sentimentGaps.map((s) => s.negative));
      if (maxNegative - minNegative >= 10) {
        const high = sentimentGaps.find((s) => s.negative === maxNegative);
        const low = sentimentGaps.find((s) => s.negative === minNegative);
        results.push({
          description: `Negative sentiment differs between ${low?.key} (${low?.negative.toFixed(1)}%) and ${high?.key} (${high?.negative.toFixed(1)}%).`,
          metric: 'sentiment_delta',
          variants: [low!.key, high!.key],
          strength: maxNegative - minNegative,
          citations: citations.slice(0, 2),
        });
      }
    }

    return results.slice(0, 8);
  }
}
