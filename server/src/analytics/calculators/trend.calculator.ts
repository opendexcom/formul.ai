import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';

/**
 * Trend Calculator
 *
 * Detects temporal patterns and changes over time:
 * - Emerging topics (new topics appearing recently)
 * - Declining topics (topics becoming less frequent)
 * - Sentiment shifts (topics changing from positive to negative or vice versa)
 * - Response volume trends
 */
@Injectable()
export class TrendCalculator {
  /**
   * Calculate all temporal trends from responses
   */
  calculateTrends(
    responses: ResponseDocument[],
    canonicalTopics: string[],
  ): TrendAnalysis {
    if (responses.length < 5) {
      return {
        hasEnoughData: false,
        message: 'Need at least 5 responses for trend analysis',
        emergingTopics: [],
        decliningTopics: [],
        sentimentShifts: [],
        volumeTrend: 'stable',
        periodComparison: null,
      };
    }

    // Sort responses by submission date
    const sortedResponses = [...responses].sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
    );

    // Split into two periods (older half vs newer half)
    const midPoint = Math.floor(sortedResponses.length / 2);
    const olderResponses = sortedResponses.slice(0, midPoint);
    const newerResponses = sortedResponses.slice(midPoint);

    // Calculate topic frequencies for each period
    const olderTopicFreq = this.calculateTopicFrequencies(
      olderResponses,
      canonicalTopics,
    );
    const newerTopicFreq = this.calculateTopicFrequencies(
      newerResponses,
      canonicalTopics,
    );

    // Calculate sentiment per topic for each period
    const olderTopicSentiment = this.calculateTopicSentiment(olderResponses);
    const newerTopicSentiment = this.calculateTopicSentiment(newerResponses);

    // Detect emerging topics (significantly more frequent in newer period)
    const emergingTopics = this.detectEmergingTopics(
      olderTopicFreq,
      newerTopicFreq,
    );

    // Detect declining topics (significantly less frequent in newer period)
    const decliningTopics = this.detectDecliningTopics(
      olderTopicFreq,
      newerTopicFreq,
    );

    // Detect sentiment shifts
    const sentimentShifts = this.detectSentimentShifts(
      olderTopicSentiment,
      newerTopicSentiment,
    );

    // Calculate overall volume trend
    const volumeTrend = this.calculateVolumeTrend(sortedResponses);

    // Period comparison metadata
    const periodComparison = {
      olderPeriod: {
        start: new Date(olderResponses[0]?.submittedAt),
        end: new Date(olderResponses[olderResponses.length - 1]?.submittedAt),
        responseCount: olderResponses.length,
      },
      newerPeriod: {
        start: new Date(newerResponses[0]?.submittedAt),
        end: new Date(newerResponses[newerResponses.length - 1]?.submittedAt),
        responseCount: newerResponses.length,
      },
    };

    return {
      hasEnoughData: true,
      emergingTopics,
      decliningTopics,
      sentimentShifts,
      volumeTrend,
      periodComparison,
    };
  }

  /**
   * Calculate topic frequencies for a set of responses
   */
  private calculateTopicFrequencies(
    responses: ResponseDocument[],
    canonicalTopics: string[],
  ): Map<string, number> {
    const frequencies = new Map<string, number>();

    // Initialize with all canonical topics
    canonicalTopics.forEach((topic) => frequencies.set(topic, 0));

    responses.forEach((r) => {
      const topics = r.metadata?.canonicalTopics || [];
      topics.forEach((topic) => {
        frequencies.set(topic, (frequencies.get(topic) || 0) + 1);
      });
    });

    return frequencies;
  }

  /**
   * Calculate average sentiment per topic for a set of responses
   */
  private calculateTopicSentiment(responses: ResponseDocument[]): Map<
    string,
    {
      avgScore: number;
      count: number;
      distribution: { positive: number; neutral: number; negative: number };
    }
  > {
    const topicSentiment = new Map<
      string,
      { scores: number[]; labels: string[] }
    >();

    responses.forEach((r) => {
      const topics = r.metadata?.canonicalTopics || [];
      const sentiment = r.metadata?.overallSentiment;

      if (!sentiment) return;

      topics.forEach((topic) => {
        if (!topicSentiment.has(topic)) {
          topicSentiment.set(topic, { scores: [], labels: [] });
        }
        const data = topicSentiment.get(topic)!;
        data.scores.push(sentiment.score || 0);
        data.labels.push(sentiment.label || 'neutral');
      });
    });

    // Convert to averages
    const result = new Map<
      string,
      {
        avgScore: number;
        count: number;
        distribution: { positive: number; neutral: number; negative: number };
      }
    >();

    topicSentiment.forEach((data, topic) => {
      const avgScore =
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const distribution = {
        positive: data.labels.filter((l) => l === 'positive').length,
        neutral: data.labels.filter((l) => l === 'neutral').length,
        negative: data.labels.filter((l) => l === 'negative').length,
      };
      result.set(topic, { avgScore, count: data.scores.length, distribution });
    });

    return result;
  }

  /**
   * Detect topics that are appearing more frequently in recent responses
   */
  private detectEmergingTopics(
    olderFreq: Map<string, number>,
    newerFreq: Map<string, number>,
  ): EmergingTopic[] {
    const emerging: EmergingTopic[] = [];

    newerFreq.forEach((newerCount, topic) => {
      const olderCountForTopic = olderFreq.get(topic) || 0;

      // Emerging: appears in newer period but not (or rarely) in older period
      // Or: significantly higher percentage in newer period
      if (newerCount >= 2) {
        if (olderCountForTopic === 0) {
          emerging.push({
            topic,
            type: 'new',
            newerMentions: newerCount,
            olderMentions: olderCountForTopic,
            changePercentage: 100,
            description: `"${topic}" is a new topic that emerged in recent responses`,
          });
        } else {
          const growthRate =
            ((newerCount - olderCountForTopic) / olderCountForTopic) * 100;
          if (growthRate >= 50 && newerCount >= olderCountForTopic + 2) {
            emerging.push({
              topic,
              type: 'growing',
              newerMentions: newerCount,
              olderMentions: olderCountForTopic,
              changePercentage: Math.round(growthRate),
              description: `"${topic}" is being discussed ${Math.round(growthRate)}% more in recent responses`,
            });
          }
        }
      }
    });

    return emerging
      .sort((a, b) => b.changePercentage - a.changePercentage)
      .slice(0, 5);
  }

  /**
   * Detect topics that are appearing less frequently in recent responses
   */
  private detectDecliningTopics(
    olderFreq: Map<string, number>,
    newerFreq: Map<string, number>,
  ): DecliningTopic[] {
    const declining: DecliningTopic[] = [];

    olderFreq.forEach((olderCountForTopic, topic) => {
      const newerCountForTopic = newerFreq.get(topic) || 0;

      if (olderCountForTopic >= 2) {
        if (newerCountForTopic === 0) {
          declining.push({
            topic,
            type: 'disappeared',
            olderMentions: olderCountForTopic,
            newerMentions: newerCountForTopic,
            changePercentage: -100,
            description: `"${topic}" is no longer being discussed in recent responses`,
          });
        } else {
          const declineRate =
            ((newerCountForTopic - olderCountForTopic) / olderCountForTopic) *
            100;
          if (
            declineRate <= -50 &&
            olderCountForTopic >= newerCountForTopic + 2
          ) {
            declining.push({
              topic,
              type: 'declining',
              olderMentions: olderCountForTopic,
              newerMentions: newerCountForTopic,
              changePercentage: Math.round(declineRate),
              description: `"${topic}" is being discussed ${Math.round(Math.abs(declineRate))}% less in recent responses`,
            });
          }
        }
      }
    });

    return declining
      .sort((a, b) => a.changePercentage - b.changePercentage)
      .slice(0, 5);
  }

  /**
   * Detect topics where sentiment has shifted significantly
   */
  private detectSentimentShifts(
    olderSentiment: Map<
      string,
      {
        avgScore: number;
        count: number;
        distribution: { positive: number; neutral: number; negative: number };
      }
    >,
    newerSentiment: Map<
      string,
      {
        avgScore: number;
        count: number;
        distribution: { positive: number; neutral: number; negative: number };
      }
    >,
  ): SentimentShift[] {
    const shifts: SentimentShift[] = [];

    // Compare topics that exist in both periods
    newerSentiment.forEach((newerData, topic) => {
      const olderData = olderSentiment.get(topic);

      if (olderData && olderData.count >= 2 && newerData.count >= 2) {
        const scoreDiff = newerData.avgScore - olderData.avgScore;

        // Significant shift: score changed by more than 0.3 (on -1 to 1 scale)
        if (Math.abs(scoreDiff) >= 0.3) {
          const direction = scoreDiff > 0 ? 'improving' : 'worsening';
          const fromLabel = this.scoreToLabel(olderData.avgScore);
          const toLabel = this.scoreToLabel(newerData.avgScore);

          shifts.push({
            topic,
            direction,
            fromScore: Math.round(olderData.avgScore * 100) / 100,
            toScore: Math.round(newerData.avgScore * 100) / 100,
            scoreDiff: Math.round(scoreDiff * 100) / 100,
            fromLabel,
            toLabel,
            description:
              direction === 'improving'
                ? `"${topic}" sentiment has improved from ${fromLabel} to ${toLabel}`
                : `"${topic}" sentiment has worsened from ${fromLabel} to ${toLabel}`,
          });
        }
      }
    });

    return shifts
      .sort((a, b) => Math.abs(b.scoreDiff) - Math.abs(a.scoreDiff))
      .slice(0, 5);
  }

  /**
   * Convert score to sentiment label
   */
  private scoreToLabel(score: number): string {
    if (score > 0.2) return 'positive';
    if (score < -0.2) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate overall response volume trend
   */
  private calculateVolumeTrend(
    sortedResponses: ResponseDocument[],
  ): 'increasing' | 'stable' | 'decreasing' {
    if (sortedResponses.length < 10) return 'stable';

    // Compare response rate between first half and second half of the time period
    const midIndex = Math.floor(sortedResponses.length / 2);

    const firstHalf = sortedResponses.slice(0, midIndex);
    const secondHalf = sortedResponses.slice(midIndex);

    const firstPeriodDays =
      this.getDaysBetween(
        new Date(firstHalf[0].submittedAt),
        new Date(firstHalf[firstHalf.length - 1].submittedAt),
      ) || 1;

    const secondPeriodDays =
      this.getDaysBetween(
        new Date(secondHalf[0].submittedAt),
        new Date(secondHalf[secondHalf.length - 1].submittedAt),
      ) || 1;

    const firstRate = firstHalf.length / firstPeriodDays;
    const secondRate = secondHalf.length / secondPeriodDays;

    const changeRate = (secondRate - firstRate) / firstRate;

    if (changeRate > 0.2) return 'increasing';
    if (changeRate < -0.2) return 'decreasing';
    return 'stable';
  }

  /**
   * Get number of days between two dates
   */
  private getDaysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Type definitions
export interface TrendAnalysis {
  hasEnoughData: boolean;
  message?: string;
  emergingTopics: EmergingTopic[];
  decliningTopics: DecliningTopic[];
  sentimentShifts: SentimentShift[];
  volumeTrend: 'increasing' | 'stable' | 'decreasing';
  periodComparison: {
    olderPeriod: { start: Date; end: Date; responseCount: number };
    newerPeriod: { start: Date; end: Date; responseCount: number };
  } | null;
}

export interface EmergingTopic {
  topic: string;
  type: 'new' | 'growing';
  newerMentions: number;
  olderMentions: number;
  changePercentage: number;
  description: string;
}

export interface DecliningTopic {
  topic: string;
  type: 'disappeared' | 'declining';
  olderMentions: number;
  newerMentions: number;
  changePercentage: number;
  description: string;
}

export interface SentimentShift {
  topic: string;
  direction: 'improving' | 'worsening';
  fromScore: number;
  toScore: number;
  scoreDiff: number;
  fromLabel: string;
  toLabel: string;
  description: string;
}
