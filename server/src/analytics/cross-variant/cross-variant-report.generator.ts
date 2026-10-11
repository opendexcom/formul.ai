import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';
import {
  ComparativeReport,
  Citation,
  CrossVariantInsight,
  HypothesisEvaluation,
  QuestionDiffResult,
  SplitQuestionnaireDesign,
  VariantContextSnapshot,
  VariantInsight,
  VariantKey,
  VariantSection,
} from '../../projects/comparative-report.types';
import { MetricComparisonResult, VariantAnalyticsBundle } from './cross-variant-metrics.service';
import { AlignedTopicGroup } from '../../projects/comparative-report.types';

export interface ReportGenerationContext {
  projectName: string;
  hypotheses: string[];
  researchNotes?: string;
  researchDesignType?: 'standard_ab' | 'split_questionnaire';
  splitQuestionnaireDesign?: SplitQuestionnaireDesign;
  questionDiff: QuestionDiffResult;
  variantContext: VariantContextSnapshot[];
  bundles: VariantAnalyticsBundle[];
  alignedTopics: AlignedTopicGroup[];
  alignmentNotes: string;
  metricComparison: MetricComparisonResult;
  citations: Citation[];
  correlations: ComparativeReport['correlations'];
}

interface ParsedReportPayload {
  executiveSummary: string;
  variantSections: Array<{
    key: VariantKey;
    summary: string;
    insights: VariantInsight[];
  }>;
  crossVariantInsights: CrossVariantInsight[];
  hypothesisEvaluation: HypothesisEvaluation[];
}

@Injectable()
export class CrossVariantReportGenerator {
  constructor(
    private readonly aiService: AiService,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async generateReport(context: ReportGenerationContext): Promise<{
    executiveSummary: string;
    variantSections: VariantSection[];
    crossVariantInsights: CrossVariantInsight[];
    hypothesisEvaluation: HypothesisEvaluation[];
  }> {
    let hypothesisEvaluation: HypothesisEvaluation[] = [];

    try {
      const hypothesisVariables = this.promptBuilder.buildCrossVariantHypothesisVariables(context);
      const { content: hypothesisContent } = await this.aiService.invokeFlow(
        'analytics.cross_variant_hypothesis',
        hypothesisVariables,
        { skipValidation: true, useJsonFormat: true },
      );
      hypothesisEvaluation = this.parseHypothesisResponse(hypothesisContent, context.hypotheses);
    } catch (error) {
      console.warn('[CrossVariantReportGenerator] Hypothesis evaluation failed:', error);
      hypothesisEvaluation = this.fallbackHypothesisEvaluation(context);
    }

    try {
      const reportVariables = this.promptBuilder.buildCrossVariantReportVariables(
        context,
        hypothesisEvaluation,
      );
      const { content } = await this.aiService.invokeFlow(
        'analytics.cross_variant_report',
        reportVariables,
        { skipValidation: true, useJsonFormat: true },
      );
      const parsed = this.parseReportResponse(content);
      return this.mergeReport(parsed, context, hypothesisEvaluation);
    } catch (error) {
      console.warn('[CrossVariantReportGenerator] Report synthesis failed, using fallback:', error);
      return this.fallbackReport(context, hypothesisEvaluation);
    }
  }

  private parseHypothesisResponse(
    content: string,
    hypotheses: string[],
  ): HypothesisEvaluation[] {
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as {
      hypothesisEvaluation?: HypothesisEvaluation[];
    };
    if (parsed.hypothesisEvaluation?.length) {
      return parsed.hypothesisEvaluation;
    }
    return hypotheses.map((hypothesis) => ({
      hypothesis,
      verdict: 'inconclusive' as const,
      reasoning: 'Insufficient structured evaluation output.',
      citations: [],
    }));
  }

  private parseReportResponse(content: string): ParsedReportPayload {
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as ParsedReportPayload;
    return {
      executiveSummary: parsed.executiveSummary ?? '',
      variantSections: parsed.variantSections ?? [],
      crossVariantInsights: parsed.crossVariantInsights ?? [],
      hypothesisEvaluation: parsed.hypothesisEvaluation ?? [],
    };
  }

  private mergeReport(
    parsed: ParsedReportPayload,
    context: ReportGenerationContext,
    hypothesisEvaluation: HypothesisEvaluation[],
  ): {
    executiveSummary: string;
    variantSections: VariantSection[];
    crossVariantInsights: CrossVariantInsight[];
    hypothesisEvaluation: HypothesisEvaluation[];
  } {
    const variantSections: VariantSection[] = context.bundles.map((bundle) => {
      const section = parsed.variantSections.find((s) => s.key === bundle.key);
      const metrics = context.metricComparison.variantMetrics.find((m) => m.key === bundle.key);
      return {
        key: bundle.key,
        formId: String(bundle.formId),
        summary: section?.summary ?? bundle.form.analytics?.insights?.summary ?? '',
        insights: (section?.insights ?? []).slice(0, 4),
        metricsSnapshot: metrics?.metricsSnapshot ?? {},
      };
    });

    return {
      executiveSummary: parsed.executiveSummary,
      variantSections,
      crossVariantInsights: (parsed.crossVariantInsights ?? []).slice(0, 4),
      hypothesisEvaluation:
        parsed.hypothesisEvaluation?.length > 0
          ? parsed.hypothesisEvaluation
          : hypothesisEvaluation,
    };
  }

  private fallbackHypothesisEvaluation(
    context: ReportGenerationContext,
  ): HypothesisEvaluation[] {
    if (context.hypotheses.length === 0) return [];
    return context.hypotheses.map((hypothesis) => ({
      hypothesis,
      verdict: 'inconclusive',
      reasoning:
        'Automated hypothesis evaluation could not be completed. Review per-variant analytics and citations manually.',
      citations: context.citations.slice(0, 2),
    }));
  }

  private fallbackReport(
    context: ReportGenerationContext,
    hypothesisEvaluation: HypothesisEvaluation[],
  ): {
    executiveSummary: string;
    variantSections: VariantSection[];
    crossVariantInsights: CrossVariantInsight[];
    hypothesisEvaluation: HypothesisEvaluation[];
  } {
    const variantSections: VariantSection[] = context.bundles.map((bundle) => {
      const metrics = context.metricComparison.variantMetrics.find((m) => m.key === bundle.key);
      const findings = bundle.form.analytics?.insights?.keyFindings ?? [];
      return {
        key: bundle.key,
        formId: String(bundle.formId),
        summary: bundle.form.analytics?.insights?.summary ?? `Summary for variant ${bundle.key}.`,
        insights: findings.slice(0, 4).map((finding) => ({
          text: finding.finding,
          confidence: finding.confidence,
          citations: (finding.evidence?.supportingQuotes ?? []).slice(0, 2).map((quote, index) => ({
            responseId: `fallback-${bundle.key}-${index}`,
            variantKey: bundle.key,
            formId: String(bundle.formId),
            quote,
          })),
        })),
        metricsSnapshot: metrics?.metricsSnapshot ?? {},
      };
    });

    const crossVariantInsights: CrossVariantInsight[] = context.metricComparison.topicFrequencyComparison
      .filter((topic) => {
        const freqs = topic.perVariant.map((v) => v.frequency);
        return Math.max(...freqs) - Math.min(...freqs) > 0;
      })
      .slice(0, 4)
      .map((topic) => ({
        text: `Topic "${topic.unifiedLabel}" shows different frequency across variants.`,
        type: 'difference' as const,
        relatedVariants: topic.perVariant.map((v) => v.key),
        citations: context.citations.slice(0, 2),
      }));

    return {
      executiveSummary: `Comparative analysis across ${context.bundles.length} variant(s) for ${context.projectName}. ${context.questionDiff.designInterpretation}`,
      variantSections,
      crossVariantInsights,
      hypothesisEvaluation,
    };
  }
}
