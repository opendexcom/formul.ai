import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form } from '../../schemas/form.schema';
import { MlflowPromptService } from '../../mlflow/mlflow-prompt.service';

@Injectable()
export class PromptBuilder {
  constructor(private readonly mlflowPrompts: MlflowPromptService) {}

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
    const responsesData = this.buildResponsesData(responses, form);
    const { prompt } = await this.mlflowPrompts.formatFlow(
      'analytics.topic_extraction',
      {
        responseCount: String(responses.length),
        responsesData: JSON.stringify(responsesData, null, 2),
      },
    );
    return prompt;
  }

  async buildOverallSentimentPrompt(
    responses: ResponseDocument[],
    form: Form,
  ): Promise<string> {
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

    const { prompt } = await this.mlflowPrompts.formatFlow('analytics.sentiment', {
      responseCount: String(responses.length),
      responsesData: JSON.stringify(responsesData, null, 2),
      ratingContext,
    });
    return prompt;
  }

  async buildQuoteExtractionPrompt(
    responses: ResponseDocument[],
    form: Form,
  ): Promise<string> {
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
    const { prompt } = await this.mlflowPrompts.formatFlow(
      'analytics.quote_extraction',
      {
        responseCount: String(responses.length),
        responsesData: JSON.stringify(responsesData, null, 2),
      },
    );
    return prompt;
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
    const summaryContext = this.buildSummaryContext(
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
    const { prompt } = await this.mlflowPrompts.formatFlow('analytics.summary', {
      summaryContext,
    });
    return prompt;
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
}
