import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';

/**
 * Sentiment Calculator
 * 
 * Calculates sentiment-related metrics:
 * - Overall sentiment distribution
 * - Per-question sentiment (calculated mathematically, not via LLM)
 * - Sentiment scores and breakdowns
 */
@Injectable()
export class SentimentCalculator {
  
  /**
   * Calculate overall sentiment distribution across all responses
   */
  calculateSentimentDistribution(responses: ResponseDocument[]): {
    positive: number;
    neutral: number;
    negative: number;
    averageScore: number;
  } {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    let totalScore = 0;
    let validSentimentCount = 0;

    responses.forEach(r => {
      if (r.metadata?.overallSentiment) {
        const label = r.metadata.overallSentiment.label;
        if (label === 'positive') counts.positive++;
        else if (label === 'negative') counts.negative++;
        else counts.neutral++;
        
        if (typeof r.metadata.overallSentiment.score === 'number') {
          totalScore += r.metadata.overallSentiment.score;
          validSentimentCount++;
        }
      }
    });

    const total = responses.length;
    return {
      positive: total > 0 ? Math.round((counts.positive / total) * 100) : 0,
      neutral: total > 0 ? Math.round((counts.neutral / total) * 100) : 0,
      negative: total > 0 ? Math.round((counts.negative / total) * 100) : 0,
      averageScore: validSentimentCount > 0 ? totalScore / validSentimentCount : 0,
    };
  }

  /**
   * Calculate sentiment breakdown per topic
   */
  calculateTopicSentimentBreakdown(responses: ResponseDocument[]): Record<string, {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }> {
    const topicSentiment: Record<string, {
      positive: number;
      neutral: number;
      negative: number;
      total: number;
    }> = {};

    responses.forEach(response => {
      const topics = response.metadata?.canonicalTopics || response.metadata?.allTopics || [];
      const sentiment = response.metadata?.overallSentiment;
      
      if (!sentiment) return;

      const label = sentiment.label || 'neutral';
      
      topics.forEach(topic => {
        if (!topicSentiment[topic]) {
          topicSentiment[topic] = {
            positive: 0,
            neutral: 0,
            negative: 0,
            total: 0
          };
        }

        if (label === 'positive') topicSentiment[topic].positive++;
        else if (label === 'negative') topicSentiment[topic].negative++;
        else topicSentiment[topic].neutral++;
        
        topicSentiment[topic].total++;
      });
    });

    return topicSentiment;
  }

  /**
   * Calculate dominant sentiment for each topic
   */
  calculateDominantSentimentPerTopic(responses: ResponseDocument[]): Record<string, {
    dominantSentiment: string;
    confidence: number;
    distribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
  }> {
    const breakdown = this.calculateTopicSentimentBreakdown(responses);
    const result: Record<string, any> = {};

    Object.entries(breakdown).forEach(([topic, sentiments]) => {
      const total = sentiments.total;
      const posPercent = (sentiments.positive / total) * 100;
      const negPercent = (sentiments.negative / total) * 100;
      const neuPercent = (sentiments.neutral / total) * 100;

      let dominantSentiment = 'neutral';
      let confidence = neuPercent / 100;

      if (posPercent > 60) {
        dominantSentiment = 'positive';
        confidence = posPercent / 100;
      } else if (negPercent > 60) {
        dominantSentiment = 'negative';
        confidence = negPercent / 100;
      } else if (posPercent > 40 && negPercent < 20) {
        dominantSentiment = 'mostly positive';
        confidence = posPercent / 100;
      } else if (negPercent > 40 && posPercent < 20) {
        dominantSentiment = 'mostly negative';
        confidence = negPercent / 100;
      } else {
        dominantSentiment = 'mixed';
        confidence = 1 - (Math.max(posPercent, negPercent, neuPercent) / 100);
      }

      result[topic] = {
        dominantSentiment,
        confidence,
        distribution: {
          positive: Math.round(posPercent),
          neutral: Math.round(neuPercent),
          negative: Math.round(negPercent)
        }
      };
    });

    return result;
  }

  /**
   * Calculate sentiment polarity score (-1 to 1)
   * Weighted average considering positive as +1, neutral as 0, negative as -1
   */
  calculateSentimentPolarity(responses: ResponseDocument[]): number {
    let weightedSum = 0;
    let totalResponses = 0;

    responses.forEach(r => {
      if (r.metadata?.overallSentiment?.score !== undefined) {
        weightedSum += r.metadata.overallSentiment.score;
        totalResponses++;
      }
    });

    return totalResponses > 0 ? weightedSum / totalResponses : 0;
  }

  /**
   * Identify extreme sentiments (very positive or very negative)
   */
  identifyExtremeSentiments(responses: ResponseDocument[], threshold: number = 0.7): {
    veryPositive: ResponseDocument[];
    veryNegative: ResponseDocument[];
  } {
    const veryPositive: ResponseDocument[] = [];
    const veryNegative: ResponseDocument[] = [];

    responses.forEach(response => {
      const sentiment = response.metadata?.overallSentiment;
      if (!sentiment || typeof sentiment.score !== 'number') return;

      if (sentiment.score >= threshold) {
        veryPositive.push(response);
      } else if (sentiment.score <= -threshold) {
        veryNegative.push(response);
      }
    });

    return {
      veryPositive: veryPositive.slice(0, 10), // Top 10
      veryNegative: veryNegative.slice(0, 10)  // Top 10
    };
  }
}
