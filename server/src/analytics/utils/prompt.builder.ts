import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form } from '../../schemas/form.schema';
import { MlflowPromptService } from '../../mlflow/mlflow-prompt.service';
import { combinePromptForCache } from '../../mlflow/mlflow-trace-context';
import { extractQuestionFocusPhrases } from '../utils/topic-question-filter.util';
import { ResearchContext } from '../../projects/research-context.types';
import {
  ClosedQuestionComparison,
  QuestionDiffResult,
  SplitQuestionnaireDesign,
  VariantKey,
} from '../../projects/comparative-report.types';

@Injectable()
export class PromptBuilder {
  constructor(private readonly mlflowPrompts: MlflowPromptService) {}

  buildResearchContextSection(researchContext?: ResearchContext | null): string {
    if (!researchContext) {
      return '';
    }

    const sections: string[] = [];

    if (researchContext.hypotheses.length > 0) {
      sections.push(
        `RESEARCH HYPOTHESES TO EVALUATE:\n${researchContext.hypotheses
          .map((hypothesis, index) => `${index + 1}. ${hypothesis}`)
          .join('\n')}`,
      );
    }

    if (researchContext.projectResearchNotes) {
      sections.push(
        `PROJECT RESEARCH NOTES (internal only, not shown to respondents):\n${researchContext.projectResearchNotes}`,
      );
    }

    if (researchContext.variantInternalDescription) {
      sections.push(
        `VARIANT RESEARCH NOTES (internal only, not shown to respondents):\n${researchContext.variantInternalDescription}`,
      );
    }

    const variantMeta = [
      researchContext.variantKey ? `Variant key: ${researchContext.variantKey}` : null,
      researchContext.targetGroupName
        ? `Target audience: ${researchContext.targetGroupName}`
        : null,
      researchContext.projectName ? `Study: ${researchContext.projectName}` : null,
    ].filter(Boolean);

    if (variantMeta.length > 0) {
      sections.push(variantMeta.join('\n'));
    }

    if (sections.length === 0) {
      return '';
    }

    return `\n\nRESEARCH CONTEXT:\n${sections.join('\n\n')}\n`;
  }

  private formatRatingQuestionLine(question: Form['questions'][number]): string {
    if (question.reverseCoded) {
      return `- "${question.title}" (REVERSE-CODED: lower scores = more positive satisfaction; higher scores = more dissatisfaction)`;
    }
    return `- "${question.title}"`;
  }

  private buildRatingContext(ratingQuestions: Form['questions']): string {
    if (ratingQuestions.length === 0) return '';
    return `\nRATING QUESTIONS IN THIS SURVEY:\n${ratingQuestions
      .map((q) => this.formatRatingQuestionLine(q))
      .join('\n')}\n\nIMPORTANT: Consider rating values when determining sentiment. For reverse-coded items, treat low scores as positive.`;
  }

  private buildResponsesData(responses: ResponseDocument[], form: Form) {
    return responses.map((r) => {
      const normalizedAnswers = r.answers
        .map((ans) => {
          const question = form.questions.find((q) => q.id === ans.questionId);
          const qType = question?.type;
          const isTextual = qType === 'text' || qType === 'textarea';
          const normalized = (ans as any).metadata?.normalizedValue as
            | string
            | undefined;
          let displayValue: string = normalized ?? '';
          const v = (ans as any).value;
          if (typeof v === 'string') {
            displayValue = displayValue || v;
          } else if (Array.isArray(v)) {
            displayValue = displayValue || v.filter(Boolean).join(', ');
          } else if (v && typeof v === 'object') {
            displayValue =
              displayValue || (v.other ?? v.label ?? JSON.stringify(v));
          } else if (typeof v === 'number' || typeof v === 'boolean') {
            displayValue = displayValue || String(v);
          }
          if (!isTextual && (!displayValue || displayValue.length < 2)) {
            return null;
          }
          return {
            questionId: ans.questionId,
            questionTitle: question?.title,
            value: displayValue,
          };
        })
        .filter(Boolean) as Array<{
        questionId: string;
        questionTitle?: string;
        value: string;
      }>;
      const combinedText = normalizedAnswers.map((a) => a.value).join('\n');
      return {
        responseId: r._id.toString(),
        answers: normalizedAnswers,
        combinedText,
      };
    });
  }

  async buildTopicExtractionPrompt(
    responses: ResponseDocument[],
    form: Form,
  ): Promise<string> {
    const { prompt, systemPrompt } = await this.mlflowPrompts.formatFlow(
      'analytics.topic_extraction',
      this.getTopicExtractionVariables(responses, form),
    );
    return combinePromptForCache(prompt, systemPrompt);
  }

  getTopicExtractionVariables(responses: ResponseDocument[], form: Form) {
    return {
      responseCount: String(responses.length),
      responsesData: JSON.stringify(
        this.buildResponsesData(responses, form),
        null,
        2,
      ),
    };
  }

  async buildOverallSentimentPrompt(
    responses: ResponseDocument[],
    form: Form,
  ): Promise<string> {
    const { prompt, systemPrompt } = await this.mlflowPrompts.formatFlow(
      'analytics.sentiment',
      this.getOverallSentimentVariables(responses, form),
    );
    return combinePromptForCache(prompt, systemPrompt);
  }

  getOverallSentimentVariables(responses: ResponseDocument[], form: Form) {
    const ratingQuestions = form.questions.filter((q) => q.type === 'rating');
    const responsesData = responses.map((r) => {
      const base = this.buildResponsesData([r], form)[0];
      const ratingAnswers = ratingQuestions
        .map((rq) => {
          const answer = r.answers.find((a) => a.questionId === rq.id);
          if (answer?.value != null) {
            return { questionTitle: rq.title, value: answer.value };
          }
          return null;
        })
        .filter(Boolean);
      return {
        ...base,
        ratingAnswers: ratingAnswers.length > 0 ? ratingAnswers : undefined,
      };
    });

    const ratingContext =
      ratingQuestions.length > 0
        ? `\nRATING QUESTIONS IN THIS SURVEY:\n${ratingQuestions.map((q) => `- "${q.title}"`).join('\n')}\n\nIMPORTANT: Consider rating values when determining sentiment.`
        : '';

    return {
      responseCount: String(responses.length),
      responsesData: JSON.stringify(responsesData, null, 2),
      ratingContext,
    };
  }

  async buildQuoteExtractionPrompt(
    responses: ResponseDocument[],
    form: Form,
  ): Promise<string> {
    const { prompt, systemPrompt } = await this.mlflowPrompts.formatFlow(
      'analytics.quote_extraction',
      this.getQuoteExtractionVariables(responses, form),
    );
    return combinePromptForCache(prompt, systemPrompt);
  }

  getQuoteExtractionVariables(responses: ResponseDocument[], form: Form) {
    const responsesData = responses.map((r) => ({
      responseId: r._id.toString(),
      answers: r.answers.map((ans) => {
        const question = form.questions.find((q) => q.id === ans.questionId);
        return {
          questionId: ans.questionId,
          questionTitle: question?.title,
          value: ans.value,
        };
      }),
    }));
    return {
      responseCount: String(responses.length),
      responsesData: JSON.stringify(responsesData, null, 2),
    };
  }

  getCombinedAnalysisVariables(
    responses: ResponseDocument[],
    form: Form,
    researchContext?: ResearchContext | null,
    knownCanonicalTopics: string[] = [],
  ) {
    const ratingQuestions = form.questions.filter((q) => q.type === 'rating');
    const responsesData = responses.map((r) => {
      const base = this.buildResponsesData([r], form)[0];
      const ratingAnswers = ratingQuestions
        .map((rq) => {
          const answer = r.answers.find((a) => a.questionId === rq.id);
          if (answer?.value != null) {
            return { questionTitle: rq.title, value: answer.value };
          }
          return null;
        })
        .filter(Boolean);
      return {
        ...base,
        answers: [
          ...base.answers,
          ...(ratingAnswers.length > 0
            ? ratingAnswers.map((ra) => ({
                questionId: '',
                questionTitle: ra!.questionTitle,
                value: String(ra!.value),
              }))
            : []),
        ],
        ratingAnswers: ratingAnswers.length > 0 ? ratingAnswers : undefined,
      };
    });

    const ratingContext =
      ratingQuestions.length > 0
        ? `\nRATING QUESTIONS IN THIS SURVEY:\n${ratingQuestions.map((q) => `- "${q.title}"`).join('\n')}\n\nIMPORTANT: Consider rating values when determining sentiment.`
        : '';

    const openEndedQuestions = form.questions.filter((q) =>
      ['text', 'textarea'].includes(q.type),
    );
    const questionContext =
      openEndedQuestions.length > 0
        ? `\nOPEN-ENDED QUESTIONS IN THIS SURVEY (responses include questionTitle per answer):\n${openEndedQuestions.map((q) => `- "${q.title}"`).join('\n')}\n\nIMPORTANT: Do not emit topics that only repeat these question subjects. Extract the specific ideas, concerns, and sub-themes inside each answer instead.`
        : '';

    const researchSection = this.buildResearchContextSection(researchContext);

    const canonicalVocabularySection =
      knownCanonicalTopics.length > 0
        ? `\nCANONICAL TOPIC VOCABULARY (reuse these exact labels when the theme matches — do not create synonyms):\n${knownCanonicalTopics.map((t) => `- "${t}"`).join('\n')}`
        : '';

    return {
      responseCount: String(responses.length),
      responsesData: JSON.stringify(responsesData, null, 2),
      ratingContext,
      questionContext: `${questionContext}${canonicalVocabularySection}${researchSection}`,
    };
  }

  async buildTopicClusteringPrompt(rawTopics: string[]): Promise<string> {
    const { prompt } = await this.mlflowPrompts.formatFlow(
      'analytics.topic_clustering',
      { rawTopics: JSON.stringify(rawTopics, null, 2) },
    );
    return prompt;
  }

  async buildAnalyticsSummaryPrompt(
    form: Form,
    topTopics: string[],
    sentimentDistribution: any,
    responseCount: number,
    topicQuotes: Array<{ topic: string; quote: string; count: number }>,
    closedQuestionStats: any[],
    closedQuestionInsights: any[],
    negativeTopics?: Array<{
      topic: string;
      negativePercentage: number;
      count: number;
    }>,
    trends?: {
      emergingTopics?: Array<{ topic: string; description: string }>;
      decliningTopics?: Array<{ topic: string; description: string }>;
      sentimentShifts?: Array<{
        topic: string;
        direction: string;
        description: string;
      }>;
    },
  ): Promise<string> {
    const variables = this.buildAnalyticsSummaryVariables(
      form,
      topTopics,
      sentimentDistribution,
      responseCount,
      topicQuotes,
      closedQuestionStats,
      closedQuestionInsights,
      negativeTopics,
      trends,
    );
    const { prompt } = await this.mlflowPrompts.formatFlow(
      'analytics.summary',
      variables,
    );
    return prompt;
  }

  /** Variables for invokeFlow('analytics.summary', …) and MLflow prompt registry. */
  buildAnalyticsSummaryVariables(
    form: Form,
    topTopics: string[],
    sentimentDistribution: any,
    responseCount: number,
    topicQuotes: Array<{ topic: string; quote: string; count: number }>,
    closedQuestionStats: any[],
    closedQuestionInsights: any[],
    negativeTopics?: Array<{
      topic: string;
      negativePercentage: number;
      count: number;
    }>,
    trends?: {
      emergingTopics?: Array<{ topic: string; description: string }>;
      decliningTopics?: Array<{ topic: string; description: string }>;
      sentimentShifts?: Array<{
        topic: string;
        direction: string;
        description: string;
      }>;
    },
    researchContext?: ResearchContext | null,
  ): { summaryContext: string } {
    return {
      summaryContext: this.buildSummaryContext(
        form,
        topTopics,
        sentimentDistribution,
        responseCount,
        topicQuotes,
        closedQuestionStats,
        closedQuestionInsights,
        negativeTopics,
        trends,
        researchContext,
      ),
    };
  }

  private buildSummaryContext(
    form: Form,
    topTopics: string[],
    sentimentDistribution: any,
    responseCount: number,
    topicQuotes: Array<{ topic: string; quote: string; count: number }>,
    closedQuestionStats: any[],
    closedQuestionInsights: any[],
    negativeTopics?: Array<{
      topic: string;
      negativePercentage: number;
      count: number;
    }>,
    trends?: {
      emergingTopics?: Array<{ topic: string; description: string }>;
      decliningTopics?: Array<{ topic: string; description: string }>;
      sentimentShifts?: Array<{
        topic: string;
        direction: string;
        description: string;
      }>;
    },
    researchContext?: ResearchContext | null,
  ): string {
    const negativeTopicsSection =
      negativeTopics && negativeTopics.length > 0
        ? `\nTOPICS WITH CONCERNING SENTIMENT (require attention):\n${negativeTopics
            .map(
              (nt) =>
                `- "${nt.topic}": ${nt.negativePercentage}% negative (${nt.count} responses)`,
            )
            .join('\n')}`
        : '';

    let trendsSection = '';
    if (trends?.sentimentShifts?.length || trends?.emergingTopics?.length) {
      trendsSection = '\nTRENDS DETECTED:';
      if (trends.sentimentShifts?.length) {
        trendsSection += '\nSentiment Changes:';
        trends.sentimentShifts.forEach((s) => {
          trendsSection += `\n- ${s.description}`;
        });
      }
      if (trends.emergingTopics?.length) {
        trendsSection += '\nEmerging Topics:';
        trends.emergingTopics.forEach((e) => {
          trendsSection += `\n- ${e.description}`;
        });
      }
    }

    return `FORM CONTEXT (for understanding direction, do NOT repeat in summary):
- Title: "${form.title}"
- Description: "${form.description || 'No description provided'}"
- Questions: ${form.questions.length} questions
${this.buildResearchContextSection(researchContext)}
ANALYSIS RESULTS:
- Total responses: ${responseCount}
- Main topics discussed: ${topTopics.slice(0, 3).join(', ')}
- Sentiment: ${sentimentDistribution.positive}% positive, ${sentimentDistribution.neutral}% neutral, ${sentimentDistribution.negative}% negative

${
  closedQuestionStats.length > 0
    ? `CLOSED QUESTION RESPONSES:\n${closedQuestionStats
        .map((d: any) => {
          if (d.questionType === 'rating' && d.averageRating !== undefined) {
            return `${d.question} (Rating): Average ${d.averageRating}/5 - Distribution: ${d.topAnswers.map((a: any) => `${a.value} stars (${a.percentage}%)`).join(', ')}`;
          }
          return `${d.question}: ${d.topAnswers.map((a: any) => `${a.value} (${a.percentage}%)`).join(', ')}`;
        })
        .join('\n')}`
    : ''
}

${
  closedQuestionInsights.length > 0
    ? `TOPIC PATTERNS BY RESPONSE:\n${closedQuestionInsights
        .map(
          (di: any) =>
            `• ${di.answer} (${di.count} responses) primarily discuss ${di.topTopic} (${di.topicPercentage}% of their topics)`,
        )
        .join('\n')}`
    : ''
}

Sample responses from top topics:
${topicQuotes.map((tq) => `• ${tq.topic} (${tq.count} responses): "${tq.quote}"`).join('\n')}
${negativeTopicsSection}${trendsSection}`;
  }

  buildMultiVariantResearchContextSection(context: {
    projectName: string;
    hypotheses: string[];
    researchNotes?: string;
    variants: Array<{
      key: string;
      targetGroupName?: string;
      internalDescription?: string;
      responseCount: number;
    }>;
  }): string {
    const sections: string[] = [];
    if (context.hypotheses.length > 0) {
      sections.push(
        `RESEARCH HYPOTHESES:\n${context.hypotheses
          .map((hypothesis, index) => `${index + 1}. ${hypothesis}`)
          .join('\n')}`,
      );
    }
    if (context.researchNotes) {
      sections.push(`PROJECT RESEARCH NOTES:\n${context.researchNotes}`);
    }
    sections.push(
      `VARIANT CONTEXT:\n${context.variants
        .map(
          (variant) =>
            `- ${variant.key}: target="${variant.targetGroupName ?? 'General'}", responses=${variant.responseCount}${variant.internalDescription ? `, notes="${variant.internalDescription}"` : ''}`,
        )
        .join('\n')}`,
    );
    sections.push(`Study: ${context.projectName}`);
    return `\n\nRESEARCH CONTEXT:\n${sections.join('\n\n')}\n`;
  }

  buildCrossVariantTopicAlignmentVariables(
    variants: Array<{
      key: string;
      topTopics: string[];
      topicFrequencies: Record<string, number>;
    }>,
  ): { alignmentContext: string } {
    const alignmentContext = variants
      .map(
        (variant) =>
          `Variant ${variant.key}:\n${variant.topTopics
            .map((topic) => `- ${topic} (count: ${variant.topicFrequencies[topic] ?? 0})`)
            .join('\n')}`,
      )
      .join('\n\n');
    return { alignmentContext };
  }

  buildSplitDesignContextSection(options: {
    researchDesignType?: 'standard_ab' | 'split_questionnaire';
    splitQuestionnaireDesign?: SplitQuestionnaireDesign;
    questionDiff: QuestionDiffResult;
    closedQuestionComparison?: ClosedQuestionComparison[];
  }): string {
    const { researchDesignType, splitQuestionnaireDesign, questionDiff, closedQuestionComparison } =
      options;

    if (researchDesignType !== 'split_questionnaire' && !splitQuestionnaireDesign) {
      const reverseCoded = (questionDiff.questionTitles ?? []).filter((q) => q.reverseCoded);
      if (reverseCoded.length === 0) {
        return '';
      }
      return `\nREVERSE-CODED ITEMS:\n${reverseCoded
        .map((q) => `- [${q.questionId}] "${q.title}" — invert scores before cross-variant comparison`)
        .join('\n')}\n`;
    }

    const titleFor = (questionId: string) => {
      const ref = questionDiff.questionTitles?.find((q) => q.questionId === questionId);
      return ref ? `"${ref.title}"` : questionId;
    };

    const sections: string[] = ['SPLIT-QUESTIONNAIRE DESIGN:'];
    sections.push(`- Design type: ${researchDesignType ?? 'split_questionnaire'}`);
    sections.push(
      `- Core questions (${splitQuestionnaireDesign?.coreQuestionIds.length ?? 0}): ${
        splitQuestionnaireDesign?.coreQuestionIds
          .map((id) => `[${id}] ${titleFor(id)}`)
          .join('; ') || 'none recorded'
      }`,
    );

    const perVariant = splitQuestionnaireDesign?.perVariant ?? {};
    for (const key of ['main', 'A', 'B'] as VariantKey[]) {
      const design = perVariant[key];
      if (!design) continue;
      const lines: string[] = [`Variant ${key}:`];
      if (design.modifiedQuestionIds.length > 0) {
        lines.push(
          `  Modified: ${design.modifiedQuestionIds.map((id) => `[${id}] ${titleFor(id)}`).join('; ')}`,
        );
      }
      if (design.polarityFlippedQuestionIds.length > 0) {
        lines.push(
          `  Polarity-flipped (reverse-coded): ${design.polarityFlippedQuestionIds
            .map((id) => `[${id}] ${titleFor(id)} — interpret responses as inverted vs main`)
            .join('; ')}`,
        );
      }
      if (design.excludedQuestionIds.length > 0) {
        lines.push(
          `  Excluded: ${design.excludedQuestionIds.map((id) => `[${id}] ${titleFor(id)}`).join('; ')}`,
        );
      }
      if (lines.length > 1) sections.push(lines.join('\n'));
    }

    sections.push(`- Detected actual diff: ${questionDiff.designInterpretation}`);

    const reverseCodedTitles = (questionDiff.questionTitles ?? []).filter((q) => q.reverseCoded);
    if (reverseCodedTitles.length > 0) {
      sections.push(
        `- Reverse-coded items for comparison: ${reverseCodedTitles
          .map((q) => `[${q.questionId}] "${q.title}"`)
          .join('; ')}`,
      );
    }

    if (closedQuestionComparison?.length) {
      const normalized = closedQuestionComparison.filter((q) => q.normalizedForComparison);
      if (normalized.length > 0) {
        sections.push(
          `- Closed-question comparisons normalized for reverse coding: ${normalized
            .map(
              (q) =>
                `"${q.questionTitle}" (variants: ${(q.reverseCodedVariants ?? []).join(', ')})`,
            )
            .join('; ')}`,
        );
      }
    }

    return `\n${sections.join('\n')}\n`;
  }

  buildCrossVariantHypothesisVariables(context: {
    projectName: string;
    hypotheses: string[];
    researchNotes?: string;
    questionDiff: QuestionDiffResult;
    researchDesignType?: 'standard_ab' | 'split_questionnaire';
    splitQuestionnaireDesign?: SplitQuestionnaireDesign;
    closedQuestionComparison?: ClosedQuestionComparison[];
    variantContext: Array<{
      key: string;
      targetGroupName?: string;
      internalDescription?: string;
      responseCount: number;
    }>;
    metricComparison: {
      variantMetrics: Array<{
        key: string;
        metricsSnapshot: {
          sentiment?: { positive: number; neutral: number; negative: number };
          topTopics?: string[];
        };
      }>;
      topicFrequencyComparison: Array<{
        unifiedLabel: string;
        perVariant: Array<{ key: string; frequency: number }>;
      }>;
    };
    citations: Array<{
      responseId: string;
      variantKey: string;
      quote: string;
    }>;
  }): { hypothesisContext: string } {
    const research = this.buildMultiVariantResearchContextSection({
      projectName: context.projectName,
      hypotheses: context.hypotheses,
      researchNotes: context.researchNotes,
      variants: context.variantContext,
    });
    const metrics = context.metricComparison.variantMetrics
      .map(
        (variant) =>
          `${variant.key}: sentiment P${variant.metricsSnapshot.sentiment?.positive ?? 0}/N${variant.metricsSnapshot.sentiment?.neutral ?? 0}/Neg${variant.metricsSnapshot.sentiment?.negative ?? 0}; topics: ${(variant.metricsSnapshot.topTopics ?? []).slice(0, 5).join(', ')}`,
      )
      .join('\n');
    const topicDeltas = context.metricComparison.topicFrequencyComparison
      .slice(0, 10)
      .map(
        (topic) =>
          `${topic.unifiedLabel}: ${topic.perVariant.map((v) => `${v.key}=${v.frequency}`).join(', ')}`,
      )
      .join('\n');
    const quotes = context.citations
      .slice(0, 40)
      .map((c) => `[${c.variantKey}/${c.responseId}] "${c.quote}"`)
      .join('\n');

    const splitDesign = this.buildSplitDesignContextSection({
      researchDesignType: context.researchDesignType,
      splitQuestionnaireDesign: context.splitQuestionnaireDesign,
      questionDiff: context.questionDiff,
      closedQuestionComparison: context.closedQuestionComparison,
    });

    const hypothesisContext = `${research}
QUESTION DESIGN: ${context.questionDiff.designInterpretation}
Shared questions: ${context.questionDiff.sharedQuestionIds.length}
${splitDesign}
VARIANT METRICS:
${metrics}

TOPIC FREQUENCY COMPARISON:
${topicDeltas}

SAMPLE CITATIONS:
${quotes}`;
    return { hypothesisContext };
  }

  buildCrossVariantReportVariables(
    context: {
      projectName: string;
      hypotheses: string[];
      researchNotes?: string;
      questionDiff: QuestionDiffResult;
      researchDesignType?: 'standard_ab' | 'split_questionnaire';
      splitQuestionnaireDesign?: SplitQuestionnaireDesign;
      closedQuestionComparison?: ClosedQuestionComparison[];
      variantContext: Array<{
        key: string;
        targetGroupName?: string;
        internalDescription?: string;
        responseCount: number;
      }>;
      bundles: Array<{
        key: string;
        form: { analytics?: { insights?: { summary?: string; keyFindings?: Array<{ finding: string }> } } };
      }>;
      metricComparison: {
        variantMetrics: Array<{
          key: string;
          metricsSnapshot: {
            sentiment?: { positive: number; neutral: number; negative: number };
            topTopics?: string[];
          };
        }>;
      };
      citations: Array<{
        responseId: string;
        variantKey: string;
        formId: string;
        quote: string;
        questionId?: string;
      }>;
      correlations: Array<{ description: string; variants: string[] }>;
    },
    hypothesisEvaluation: Array<{
      hypothesis: string;
      verdict: string;
      reasoning: string;
    }>,
  ): { reportContext: string } {
    const research = this.buildMultiVariantResearchContextSection({
      projectName: context.projectName,
      hypotheses: context.hypotheses,
      researchNotes: context.researchNotes,
      variants: context.variantContext,
    });
    const perVariantSummaries = context.bundles
      .map((bundle) => {
        const summary = bundle.form.analytics?.insights?.summary ?? '';
        const findings =
          bundle.form.analytics?.insights?.keyFindings
            ?.slice(0, 3)
            .map((f) => f.finding)
            .join('; ') ?? '';
        return `Variant ${bundle.key}:\nSummary: ${summary}\nFindings: ${findings}`;
      })
      .join('\n\n');
    const citations = context.citations
      .slice(0, 50)
      .map(
        (c) =>
          `{ "responseId": "${c.responseId}", "variantKey": "${c.variantKey}", "formId": "${c.formId}", "quote": ${JSON.stringify(c.quote)}, "questionId": ${c.questionId ? `"${c.questionId}"` : 'null'} }`,
      )
      .join(',\n');
    const hypothesisBlock = hypothesisEvaluation
      .map((h) => `- ${h.hypothesis}: ${h.verdict} — ${h.reasoning}`)
      .join('\n');

    const splitDesign = this.buildSplitDesignContextSection({
      researchDesignType: context.researchDesignType,
      splitQuestionnaireDesign: context.splitQuestionnaireDesign,
      questionDiff: context.questionDiff,
      closedQuestionComparison: context.closedQuestionComparison,
    });

    const reportContext = `${research}
DESIGN: ${context.questionDiff.designInterpretation}
${splitDesign}
PER-VARIANT ANALYTICS:
${perVariantSummaries}

HYPOTHESIS EVALUATION (preliminary):
${hypothesisBlock}

CORRELATIONS:
${context.correlations.map((c) => c.description).join('\n')}

AVAILABLE CITATIONS (use these exact IDs in output):
[
${citations}
]`;
    return { reportContext };
  }

  buildStudySynthesisVariables(
    context: {
      projectName: string;
      hypotheses: string[];
      researchNotes?: string;
      researchDesignType?: 'standard_ab' | 'split_questionnaire';
      splitQuestionnaireDesign?: SplitQuestionnaireDesign;
      questionDiff: QuestionDiffResult;
      metricComparison: {
        variantMetrics: Array<{
          key: string;
          metricsSnapshot: {
            sentiment?: { positive: number; neutral: number; negative: number };
            topTopics?: string[];
          };
        }>;
        closedQuestionComparison: ClosedQuestionComparison[];
      };
      bundles: Array<{
        key: string;
        form: { analytics?: { insights?: { summary?: string; keyFindings?: Array<{ finding: string }> } } };
      }>;
      rolledUpMetrics: {
        totalResponses: number;
        dominantTopics: Array<{ topic: string; count: number }>;
        coreQuestionMetrics?: Array<{ questionId: string; title: string }>;
        branchSpecificMetrics?: Array<{ variantKey: string; topTopics: string[]; summary?: string }>;
      };
      variantContext: Array<{ key: string; targetGroupName?: string; responseCount: number }>;
    },
    hypothesisEvaluation: Array<{ hypothesis: string; verdict: string; reasoning: string }>,
  ): { studyContext: string } {
    const research = this.buildMultiVariantResearchContextSection({
      projectName: context.projectName,
      hypotheses: context.hypotheses,
      researchNotes: context.researchNotes,
      variants: context.variantContext,
    });

    const splitDesign = this.buildSplitDesignContextSection({
      researchDesignType: context.researchDesignType,
      splitQuestionnaireDesign: context.splitQuestionnaireDesign,
      questionDiff: context.questionDiff,
      closedQuestionComparison: context.metricComparison.closedQuestionComparison,
    });

    const perVariantSummaries = context.bundles
      .map((bundle) => {
        const summary = bundle.form.analytics?.insights?.summary ?? '';
        const findings =
          bundle.form.analytics?.insights?.keyFindings
            ?.slice(0, 3)
            .map((f) => f.finding)
            .join('; ') ?? '';
        return `Variant ${bundle.key}:\nSummary: ${summary}\nFindings: ${findings}`;
      })
      .join('\n\n');

    const metrics = context.metricComparison.variantMetrics
      .map(
        (variant) =>
          `${variant.key}: sentiment P${variant.metricsSnapshot.sentiment?.positive ?? 0}/N${variant.metricsSnapshot.sentiment?.neutral ?? 0}/Neg${variant.metricsSnapshot.sentiment?.negative ?? 0}; topics: ${(variant.metricsSnapshot.topTopics ?? []).slice(0, 5).join(', ')}`,
      )
      .join('\n');

    const dominantTopics = context.rolledUpMetrics.dominantTopics
      .slice(0, 10)
      .map((t) => `${t.topic} (${t.count})`)
      .join(', ');

    const coreQuestions =
      context.rolledUpMetrics.coreQuestionMetrics
        ?.map((q) => `[${q.questionId}] ${q.title}`)
        .join('; ') ?? 'none';

    const branchFindings =
      context.rolledUpMetrics.branchSpecificMetrics
        ?.map(
          (b) =>
            `Branch ${b.variantKey}: topics=${b.topTopics.join(', ')}; ${b.summary ?? ''}`,
        )
        .join('\n') ?? '';

    const hypothesisBlock = hypothesisEvaluation
      .map((h) => `- ${h.hypothesis}: ${h.verdict} — ${h.reasoning}`)
      .join('\n');

    const studyContext = `${research}
STUDY SYNTHESIS TASK: Synthesize what was learned from this study as a whole. Focus on study-level conclusions, not variant-to-variant comparison.
Total responses: ${context.rolledUpMetrics.totalResponses}
DESIGN: ${context.questionDiff.designInterpretation}
${splitDesign}
DOMINANT STUDY TOPICS: ${dominantTopics || 'none'}
CORE QUESTIONS: ${coreQuestions}

VARIANT METRICS:
${metrics}

PER-VARIANT ANALYTICS:
${perVariantSummaries}

${branchFindings ? `BRANCH-SPECIFIC:\n${branchFindings}\n` : ''}
HYPOTHESIS EVALUATION (preliminary):
${hypothesisBlock}

Return JSON with: executiveSummary (string), studyInsights (array of { text, confidence: high|medium|low, scope: core|branch|study, variantKey? }).`;

    return { studyContext };
  }
}
