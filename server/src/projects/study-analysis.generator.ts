import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PromptBuilder } from '../analytics/utils/prompt.builder';
import {
  HypothesisEvaluation,
  QuestionDiffResult,
  SplitQuestionnaireDesign,
  VariantKey,
} from './comparative-report.types';
import { VariantAnalyticsBundle, MetricComparisonResult } from '../analytics/cross-variant/cross-variant-metrics.service';
import {
  StudyAnalysisInsight,
  StudyAnalysisRolledUpMetrics,
} from './study-analysis.types';

export interface StudySynthesisContext {
  projectName: string;
  hypotheses: string[];
  researchNotes?: string;
  researchDesignType?: 'standard_ab' | 'split_questionnaire';
  splitQuestionnaireDesign?: SplitQuestionnaireDesign;
  questionDiff: QuestionDiffResult;
  metricComparison: MetricComparisonResult;
  bundles: VariantAnalyticsBundle[];
  rolledUpMetrics: StudyAnalysisRolledUpMetrics;
  variantContext: Array<{
    key: VariantKey;
    targetGroupName?: string;
    responseCount: number;
  }>;
}

interface ParsedStudySynthesis {
  executiveSummary: string;
  studyInsights: StudyAnalysisInsight[];
  coreFindings?: string[];
  branchFindings?: Array<{ variantKey: VariantKey; findings: string[] }>;
}

@Injectable()
export class StudyAnalysisGenerator {
  constructor(
    private readonly aiService: AiService,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async generateStudyAnalysis(context: StudySynthesisContext): Promise<{
    executiveSummary: string;
    hypothesisEvaluation: HypothesisEvaluation[];
    studyInsights: StudyAnalysisInsight[];
  }> {
    const hypothesisEvaluation = await this.evaluateHypotheses(context);
    const synthesis = await this.synthesizeStudy(context, hypothesisEvaluation);
    return {
      executiveSummary: synthesis.executiveSummary,
      hypothesisEvaluation,
      studyInsights: synthesis.studyInsights,
    };
  }

  private async evaluateHypotheses(
    context: StudySynthesisContext,
  ): Promise<HypothesisEvaluation[]> {
    if (context.hypotheses.length === 0) {
      return [];
    }

    try {
      const hypothesisVariables = this.promptBuilder.buildCrossVariantHypothesisVariables({
        projectName: context.projectName,
        hypotheses: context.hypotheses,
        researchNotes: context.researchNotes,
        questionDiff: context.questionDiff,
        researchDesignType: context.researchDesignType,
        splitQuestionnaireDesign: context.splitQuestionnaireDesign,
        closedQuestionComparison: context.metricComparison.closedQuestionComparison,
        variantContext: context.variantContext,
        metricComparison: context.metricComparison,
        citations: [],
      });
      const { content } = await this.aiService.invokeFlow(
        'analytics.cross_variant_hypothesis',
        hypothesisVariables,
        { skipValidation: true, useJsonFormat: true },
      );
      return this.parseHypothesisResponse(content, context.hypotheses);
    } catch (error) {
      console.warn('[StudyAnalysisGenerator] Hypothesis evaluation failed:', error);
      return context.hypotheses.map((hypothesis) => ({
        hypothesis,
        verdict: 'inconclusive' as const,
        reasoning:
          'Automated hypothesis evaluation could not be completed. Review variant analytics manually.',
        citations: [],
      }));
    }
  }

  private async synthesizeStudy(
    context: StudySynthesisContext,
    hypothesisEvaluation: HypothesisEvaluation[],
  ): Promise<ParsedStudySynthesis> {
    try {
      const variables = this.promptBuilder.buildStudySynthesisVariables(
        context,
        hypothesisEvaluation,
      );
      const { content } = await this.aiService.invokeFlow(
        'analytics.study_synthesis',
        variables,
        { skipValidation: true, useJsonFormat: true },
      );
      return this.parseSynthesisResponse(content);
    } catch (error) {
      console.warn('[StudyAnalysisGenerator] Study synthesis failed, using fallback:', error);
      return this.fallbackSynthesis(context, hypothesisEvaluation);
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

  private parseSynthesisResponse(content: string): ParsedStudySynthesis {
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as {
      executiveSummary?: string;
      studyInsights?: Array<{
        text: string;
        confidence?: string;
        scope?: string;
        variantKey?: VariantKey;
      }>;
    };
    return {
      executiveSummary: parsed.executiveSummary ?? '',
      studyInsights: (parsed.studyInsights ?? []).map((insight) => ({
        text: insight.text,
        confidence: (insight.confidence as StudyAnalysisInsight['confidence']) ?? 'medium',
        scope: (insight.scope as StudyAnalysisInsight['scope']) ?? 'study',
        variantKey: insight.variantKey,
        citations: [],
      })),
    };
  }

  private fallbackSynthesis(
    context: StudySynthesisContext,
    hypothesisEvaluation: HypothesisEvaluation[],
  ): ParsedStudySynthesis {
    const variantSummaries = context.bundles
      .map(
        (bundle) =>
          `Variant ${bundle.key} (${bundle.responseCount} responses): ${bundle.form.analytics?.insights?.summary ?? 'No summary available.'}`,
      )
      .join(' ');

    const topTopics = context.rolledUpMetrics.dominantTopics
      .slice(0, 5)
      .map((t) => t.topic)
      .join(', ');

    const executiveSummary = [
      `Study "${context.projectName}" synthesized ${context.rolledUpMetrics.totalResponses} responses across ${context.bundles.length} variant(s).`,
      variantSummaries,
      topTopics ? `Dominant themes: ${topTopics}.` : '',
      hypothesisEvaluation.length > 0
        ? `Hypothesis review: ${hypothesisEvaluation.map((h) => `${h.verdict} for "${h.hypothesis.slice(0, 60)}..."`).join('; ')}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    const studyInsights: StudyAnalysisInsight[] = [];

    for (const bundle of context.bundles) {
      const findings = bundle.form.analytics?.insights?.keyFindings ?? [];
      for (const finding of findings.slice(0, 2)) {
        studyInsights.push({
          text: finding.finding,
          confidence: (finding.confidence as StudyAnalysisInsight['confidence']) ?? 'medium',
          scope: context.researchDesignType === 'split_questionnaire' ? 'branch' : 'study',
          variantKey: bundle.key,
          citations: [],
        });
      }
    }

    if (context.rolledUpMetrics.coreQuestionMetrics?.length) {
      studyInsights.unshift({
        text: `Core questions (${context.rolledUpMetrics.coreQuestionMetrics.length}) were aggregated across branches for study-wide findings.`,
        confidence: 'high',
        scope: 'core',
      });
    }

    return { executiveSummary, studyInsights };
  }
}
