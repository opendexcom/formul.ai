import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';
import { normalizeSentimentLabel } from '../utils/topic-sentiment.util';

export interface TopicSentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export interface TopicSentimentCorrelationResult {
  topic: string;
  sentiment: TopicSentimentCounts;
  averageScore: number;
  dominantSentiment: string;
  responseCount: number;
}

/** Format raw sentiment counts into the canonical topic-correlation shape (percentages). */
export function formatTopicSentimentCorrelation(
  topic: string,
  counts: TopicSentimentCounts,
  averageScore: number,
): TopicSentimentCorrelationResult {
  const total = counts.positive + counts.neutral + counts.negative;
  if (total === 0) {
    return {
      topic,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      averageScore: 0,
      dominantSentiment: 'neutral',
      responseCount: 0,
    };
  }

  const posPercent = (counts.positive / total) * 100;
  const negPercent = (counts.negative / total) * 100;

  let dominantSentiment = 'neutral';
  if (posPercent > 60) dominantSentiment = 'positive';
  else if (negPercent > 60) dominantSentiment = 'negative';
  else if (posPercent > 40 && negPercent < 20)
    dominantSentiment = 'mostly positive';
  else if (negPercent > 40 && posPercent < 20)
    dominantSentiment = 'mostly negative';
  else dominantSentiment = 'mixed';

  return {
    topic,
    sentiment: {
      positive: Math.round(posPercent),
      neutral: Math.round((counts.neutral / total) * 100),
      negative: Math.round(negPercent),
    },
    averageScore: Math.round(averageScore * 100) / 100,
    dominantSentiment,
    responseCount: total,
  };
}

/** Convert stored topic correlation (percentages or legacy counts) to raw counts. */
export function topicCorrelationToCountBreakdown(correlation: {
  sentiment: TopicSentimentCounts;
  responseCount?: number;
}): TopicSentimentCounts & { total: number } {
  const raw = correlation.sentiment;
  const sum = raw.positive + raw.neutral + raw.negative;
  const total = correlation.responseCount ?? sum;

  if (total > 0 && sum <= total) {
    return {
      positive: raw.positive,
      neutral: raw.neutral,
      negative: raw.negative,
      total,
    };
  }

  return {
    positive: Math.round((raw.positive / 100) * total),
    neutral: Math.round((raw.neutral / 100) * total),
    negative: Math.round((raw.negative / 100) * total),
    total,
  };
}

/**
 * Correlation Calculator
 *
 * Calculates various correlations and relationships in the data:
 * - Topic co-occurrence (which topics appear together)
 * - Topic-sentiment correlation (sentiment patterns per topic)
 * - Closed question-topic correlations (demographic patterns)
 */
@Injectable()
export class CorrelationCalculator {
  /**
   * Calculate topic co-occurrence matrix
   * Shows which topics frequently appear together in the same response
   */
  calculateTopicCooccurrence(responses: ResponseDocument[]): Array<{
    topic1: string;
    topic2: string;
    frequency: number;
    relationship: string;
    uniqueResponses: number;
  }> {
    const cooccurrenceMap = new Map<string, number>();
    const topicPairCounts = new Map<string, Set<string>>();

    // Count topic co-occurrences - enforce canonicalTopics only
    responses.forEach((response) => {
      const topics = response.metadata?.canonicalTopics || [];
      if (topics.length < 2) return;

      // For each pair of topics in this response
      for (let i = 0; i < topics.length; i++) {
        for (let j = i + 1; j < topics.length; j++) {
          const topic1 = topics[i];
          const topic2 = topics[j];

          // Create consistent key (alphabetically sorted)
          const key = [topic1, topic2].sort().join('|||');

          cooccurrenceMap.set(key, (cooccurrenceMap.get(key) || 0) + 1);

          // Track unique response IDs for this pair
          if (!topicPairCounts.has(key)) {
            topicPairCounts.set(key, new Set());
          }
          const pairSet = topicPairCounts.get(key);
          if (pairSet && response._id) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            pairSet.add(String(response._id));
          }
        }
      }
    });

    // Convert to array and sort by frequency
    const cooccurrences = Array.from(cooccurrenceMap.entries())
      .map(([key, frequency]) => {
        const [topic1, topic2] = key.split('|||');
        const uniqueResponses = topicPairCounts.get(key)?.size || 0;

        // Determine relationship strength
        let relationship = 'weak';
        if (frequency >= 5) relationship = 'strong';
        else if (frequency >= 3) relationship = 'moderate';

        return {
          topic1,
          topic2,
          frequency,
          relationship,
          uniqueResponses,
        };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20); // Top 20 co-occurrences

    return cooccurrences;
  }

  /**
   * Calculate topic-sentiment correlations
   * Shows which topics are associated with which sentiments
   */
  calculateTopicSentimentCorrelation(responses: ResponseDocument[]): Array<{
    topic: string;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    averageScore: number;
    dominantSentiment: string;
    responseCount: number;
  }> {
    const topicSentimentMap = new Map<
      string,
      {
        positive: number;
        neutral: number;
        negative: number;
        scores: number[];
      }
    >();

    // Prefer topic-specific sentiment; fall back to overall response sentiment
    responses.forEach((response) => {
      const topicSpecific = response.metadata?.canonicalTopicSentiments;
      if (topicSpecific?.length) {
        for (const entry of topicSpecific) {
          if (!entry?.topic) continue;
          if (!topicSentimentMap.has(entry.topic)) {
            topicSentimentMap.set(entry.topic, {
              positive: 0,
              neutral: 0,
              negative: 0,
              scores: [],
            });
          }
          const data = topicSentimentMap.get(entry.topic);
          if (!data) continue;

          const label = normalizeSentimentLabel(entry.label);
          if (label === 'positive') data.positive++;
          else if (label === 'negative') data.negative++;
          else data.neutral++;

          if (typeof entry.score === 'number') {
            data.scores.push(entry.score);
          }
        }
        return;
      }

      const topics = response.metadata?.canonicalTopics || [];
      const sentiment = response.metadata?.overallSentiment;

      if (!sentiment || topics.length === 0) return;

      topics.forEach((topic) => {
        if (!topicSentimentMap.has(topic)) {
          topicSentimentMap.set(topic, {
            positive: 0,
            neutral: 0,
            negative: 0,
            scores: [],
          });
        }

        const data = topicSentimentMap.get(topic);
        if (!data) return;

        const label = normalizeSentimentLabel(sentiment.label);

        if (label === 'positive') data.positive++;
        else if (label === 'negative') data.negative++;
        else data.neutral++;

        if (typeof sentiment.score === 'number') {
          data.scores.push(sentiment.score);
        }
      });
    });

    // Convert to array with calculated metrics
    const correlations = Array.from(topicSentimentMap.entries())
      .map(([topic, data]) =>
        formatTopicSentimentCorrelation(
          topic,
          {
            positive: data.positive,
            neutral: data.neutral,
            negative: data.negative,
          },
          data.scores.length > 0
            ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
            : 0,
        ),
      )
      .sort((a, b) => b.responseCount - a.responseCount)
      .slice(0, 15); // Top 15 topics

    return correlations;
  }

  /**
   * Calculate correlations between closed question answers and topics from open questions
   * This reveals demographic patterns and answer preferences related to discussion topics
   */
  calculateClosedQuestionTopicCorrelations(
    form: Form | FormDocument,
    responses: ResponseDocument[],
  ): Array<{
    questionId: string;
    questionTitle: string;
    questionType: string;
    correlations: Array<{
      answerValue: string;
      topicDistribution: Array<{
        topic: string;
        percentage: number;
        count: number;
      }>;
      responseCount: number;
    }>;
  }> {
    // Identify closed questions (multiple_choice, checkbox, dropdown, rating)
    const closedQuestions = form.questions.filter((q) =>
      ['multiple_choice', 'checkbox', 'dropdown', 'rating'].includes(q.type),
    );

    if (closedQuestions.length === 0) {
      return [];
    }

    const correlations = closedQuestions
      .map((question) => {
        // Group responses by answer value
        const answerGroups = new Map<string, ResponseDocument[]>();

        responses.forEach((response) => {
          const answer = response.answers.find(
            (a) => a.questionId === question.id,
          );
          if (!answer || !answer.value) return;

          // Handle both single values and arrays (for checkbox questions)
          const values = Array.isArray(answer.value)
            ? answer.value
            : [answer.value];

          values.forEach((value) => {
            const valueStr = String(value);
            if (!answerGroups.has(valueStr)) {
              answerGroups.set(valueStr, []);
            }
            answerGroups.get(valueStr)!.push(response);
          });
        });

        // Calculate topic distribution for each answer value
        const answerCorrelations = Array.from(answerGroups.entries())
          .map(([answerValue, groupResponses]) => {
            // Count topics across responses in this group
            const topicCounts = new Map<string, number>();

            groupResponses.forEach((response) => {
              const topics = response.metadata?.canonicalTopics || [];
              topics.forEach((topic) => {
                topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
              });
            });

            // Convert to distribution array
            const totalTopicMentions = Array.from(topicCounts.values()).reduce(
              (sum, count) => sum + count,
              0,
            );
            const topicDistribution = Array.from(topicCounts.entries())
              .map(([topic, count]) => ({
                topic,
                percentage:
                  totalTopicMentions > 0
                    ? Math.round((count / totalTopicMentions) * 100)
                    : 0,
                count,
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10); // Top 10 topics per answer value

            return {
              answerValue,
              topicDistribution,
              responseCount: groupResponses.length,
            };
          })
          .filter((ac) => ac.responseCount >= 2) // Only include answer values with at least 2 responses
          .sort((a, b) => b.responseCount - a.responseCount);

        return {
          questionId: question.id,
          questionTitle: question.title,
          questionType: question.type,
          correlations: answerCorrelations,
        };
      })
      .filter((qc) => qc.correlations.length > 0); // Only include questions with meaningful correlations

    return correlations;
  }
}
