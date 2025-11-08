import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form } from '../../schemas/form.schema';
import { SamplingStrategy, DataQuality, TopicFrequency } from '../core/analytics.types';

/**
 * Statistics Calculator
 * 
 * Provides statistical calculations and analysis:
 * - Topic frequency analysis
 * - Data quality assessment
 * - Theoretical sampling strategies
 * - Distribution calculations
 */
@Injectable()
export class StatisticsCalculator {
  
  /**
   * Calculate topic frequencies across responses
   * Uses canonical topics (already clustered) for accurate counts
   */
  calculateTopicFrequencies(responses: ResponseDocument[]): Record<string, {
    count: number;
    percentage: number;
    associatedQuestions: string[];
    sentimentBreakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  }> {
    const frequency: Record<string, {
      count: number;
      percentage: number;
      associatedQuestions: string[];
      sentimentBreakdown: {
        positive: number;
        neutral: number;
        negative: number;
      };
    }> = {};

    responses.forEach(r => {
      // Use canonicalTopics if available, otherwise fall back to allTopics
      const topics = r.metadata?.canonicalTopics || r.metadata?.allTopics || [];
      
      // Track unique topics per response (don't count duplicates within same response)
      const uniqueTopics = new Set(topics);
      
      uniqueTopics.forEach(topic => {
        if (!frequency[topic]) {
          frequency[topic] = {
            count: 0,
            percentage: 0,
            associatedQuestions: [],
            sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
          };
        }
        frequency[topic].count++;

        // Track sentiment
        if (r.metadata?.overallSentiment) {
          const sentiment = r.metadata.overallSentiment.label;
          if (sentiment === 'positive') frequency[topic].sentimentBreakdown.positive++;
          else if (sentiment === 'negative') frequency[topic].sentimentBreakdown.negative++;
          else frequency[topic].sentimentBreakdown.neutral++;
        }
      });
    });

    // Calculate percentages
    const totalResponses = responses.length;
    Object.keys(frequency).forEach(topic => {
      frequency[topic].percentage = Math.round((frequency[topic].count / totalResponses) * 100);
    });

    return frequency;
  }

  /**
   * Calculate topic distribution from canonical topics
   * This is the primary method used for aggregate analytics
   */
  calculateTopicDistributionFromResponses(
    responses: ResponseDocument[],
    canonicalTopics: string[]
  ): Record<string, {
    count: number;
    percentage: number;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    representativeQuotes: string[];
    associatedQuestions: string[];
  }> {
    const distribution: Record<string, any> = {};

    // Initialize all canonical topics
    canonicalTopics.forEach(topic => {
      distribution[topic] = {
        count: 0,
        percentage: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        representativeQuotes: [],
        associatedQuestions: []
      };
    });

    // Count how many responses contain each canonical topic
    responses.forEach(response => {
      // Use canonicalTopics if available, otherwise fall back to allTopics
      const responseTopics = Array.isArray(response.metadata?.canonicalTopics) 
        ? response.metadata.canonicalTopics 
        : (response.metadata?.allTopics || []);
      
      const sentiment = response.metadata?.overallSentiment?.label || 'neutral';
      const quotes = response.metadata?.quotes;
      
      // Track each unique canonical topic from this response (ensure it's a string)
      const uniqueTopics = new Set(responseTopics.filter(t => typeof t === 'string'));
      
      uniqueTopics.forEach(topic => {
        if (distribution[topic]) {
          distribution[topic].count++;
          
          // Track sentiment
          if (sentiment === 'positive') distribution[topic].sentiment.positive++;
          else if (sentiment === 'negative') distribution[topic].sentiment.negative++;
          else distribution[topic].sentiment.neutral++;
          
          // Collect representative quotes (limit to 5 per topic)
          if (quotes && Array.isArray(quotes) && quotes.length > 0 && distribution[topic].representativeQuotes.length < 5) {
            distribution[topic].representativeQuotes.push(quotes[0]);
          }
        }
      });
    });

    // Calculate percentages
    const totalResponses = responses.length;
    Object.keys(distribution).forEach(topic => {
      const count = distribution[topic].count;
      distribution[topic].percentage = Math.round((count / totalResponses) * 100);
    });

    return distribution;
  }

  /**
   * Assess data quality of responses
   */
  assessDataQuality(responses: ResponseDocument[]): DataQuality {
    let totalQuality = 0;
    let qualityCount = 0;
    let totalLength = 0;
    let validResponsesCount = 0;

    responses.forEach(r => {
      // Check if response has quote quality metadata
      if (r.metadata?.quotes?.responseQuality) {
        totalQuality += r.metadata.quotes.responseQuality.completeness;
        qualityCount++;
      }

      // Calculate average response length
      r.answers.forEach(ans => {
        if (typeof ans.value === 'string' && ans.value.trim().length > 0) {
          totalLength += ans.value.length;
          validResponsesCount++;
        }
      });
    });

    const averageResponseLength = validResponsesCount > 0 
      ? totalLength / validResponsesCount 
      : 0;

    const completionRate = responses.length > 0 
      ? (validResponsesCount / (responses.length * (responses[0]?.answers.length || 1))) 
      : 0;

    // Calculate overall quality score from response metadata (0-1 range)
    const overallScore = qualityCount > 0 
      ? totalQuality / qualityCount 
      : 0.5; // Default to medium quality if no quality data

    let textQuality: 'high' | 'medium' | 'low' = 'medium';
    if (averageResponseLength > 200) textQuality = 'high';
    else if (averageResponseLength < 50) textQuality = 'low';

    return {
      totalResponses: responses.length,
      validResponses: validResponsesCount,
      averageResponseLength: Math.round(averageResponseLength),
      completionRate: Math.round(completionRate * 100) / 100,
      textQuality,
      overallScore: Math.round(overallScore * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Determine theoretical sampling strategy based on dataset characteristics
   */
  determineTheoreticalSampling(
    responses: ResponseDocument[],
    form: Form
  ): SamplingStrategy {
    const strategy: SamplingStrategy = {
      description: '',
      rationale: '',
      criteria: [],
    };

    if (responses.length <= 50) {
      strategy.description = 'Complete sample';
      strategy.rationale = 'Small dataset allows complete analysis of all responses';
      strategy.criteria = ['all'];
    } else if (responses.length <= 200) {
      strategy.description = 'Maximum variation sampling';
      strategy.rationale = 'Medium dataset - select diverse responses representing different perspectives';
      strategy.criteria = [
        'maximum_variation',
        'typical_cases',
        'extreme_cases'
      ];
    } else {
      strategy.description = 'Theoretical sampling with maximum variation';
      strategy.rationale = 'Large dataset - ensure diverse perspectives and saturation of themes';
      strategy.criteria = [
        'maximum_variation',
        'deviant_cases',
        'typical_cases',
        'extreme_cases',
        'information_rich',
        'temporal_coverage',
      ];
    }

    return strategy;
  }

  /**
   * Execute theoretical sampling strategy
   * Selects a representative subset of responses for detailed analysis
   */
  theoreticalSample(
    responses: ResponseDocument[],
    strategy: SamplingStrategy
  ): ResponseDocument[] {
    if (strategy.criteria.includes('all')) {
      return responses;
    }

    // Calculate target sample size based on total responses
    // Target: sqrt(n) * 10, with min 50 and max 200
    const targetSize = Math.min(
      Math.max(50, Math.ceil(Math.sqrt(responses.length) * 10)),
      200
    );

    // Stratified sampling across different criteria
    const recent = responses.slice(0, Math.floor(targetSize * 0.3)); // 30% recent
    const oldest = responses.slice(-Math.floor(targetSize * 0.2)); // 20% oldest
    
    // Random sample for the rest (50%)
    const shuffled = [...responses].sort(() => Math.random() - 0.5);
    const random = shuffled.slice(0, Math.floor(targetSize * 0.5));

    // Combine and remove duplicates
    const combined = [...recent, ...oldest, ...random];
    const unique = Array.from(
      new Map(combined.map(r => [r._id?.toString(), r])).values()
    );

    return unique.slice(0, targetSize);
  }

  /**
   * Calculate basic descriptive statistics for numeric data
   */
  calculateDescriptiveStats(values: number[]): {
    mean: number;
    median: number;
    mode: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    if (values.length === 0) {
      return { mean: 0, median: 0, mode: 0, stdDev: 0, min: 0, max: 0 };
    }

    // Mean
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Median
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    // Mode
    const frequency = new Map<number, number>();
    values.forEach(val => {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    });
    const mode = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    // Standard Deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Min/Max
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      mode,
      stdDev: Math.round(stdDev * 100) / 100,
      min,
      max
    };
  }

  /**
   * Identify emerging themes from topic frequencies
   * Emerging themes are those that are either:
   * 1. Growing in frequency (appear more in recent responses)
   * 2. Rare but significant (low frequency but high quality/depth)
   */
  identifyEmergingThemes(
    responses: ResponseDocument[],
    topicFrequencies: Record<string, {
      count: number;
      percentage: number;
      associatedQuestions: string[];
      sentimentBreakdown: { positive: number; neutral: number; negative: number };
    }>
  ): Array<{
    theme: string;
    frequency: number;
    trend: 'growing' | 'rare';
    sentiment: { positive: number; neutral: number; negative: number };
    representativeQuotes: string[];
  }> {
    const emergingThemes: Array<{
      theme: string;
      frequency: number;
      trend: 'growing' | 'rare';
      sentiment: { positive: number; neutral: number; negative: number };
      representativeQuotes: string[];
    }> = [];

    // Skip if not enough data
    if (responses.length < 10) return emergingThemes;

    // Split responses into recent and older (50/50 split)
    const midpoint = Math.floor(responses.length / 2);
    const olderResponses = responses.slice(0, midpoint);
    const recentResponses = responses.slice(midpoint);

    // Calculate topic frequency in each half
    const olderFreq = this.calculateTopicFrequenciesForSubset(olderResponses);
    const recentFreq = this.calculateTopicFrequenciesForSubset(recentResponses);

    // Identify growing themes (appearing more in recent responses)
    Object.keys(topicFrequencies).forEach(topic => {
      const oldCount = olderFreq[topic]?.count || 0;
      const recentCount = recentFreq[topic]?.count || 0;
      const totalCount = topicFrequencies[topic].count;

      // Growing theme: appears at least 2x more in recent half
      if (recentCount > oldCount * 1.5 && recentCount >= 3) {
        const quotes = this.extractRepresentativeQuotesForTopic(recentResponses, topic);
        emergingThemes.push({
          theme: topic,
          frequency: totalCount,
          trend: 'growing',
          sentiment: topicFrequencies[topic].sentimentBreakdown,
          representativeQuotes: quotes.slice(0, 2),
        });
      }
      
      // Rare but significant theme: low frequency (< 5% of responses) but present
      if (topicFrequencies[topic].percentage < 5 && topicFrequencies[topic].percentage >= 2) {
        const quotes = this.extractRepresentativeQuotesForTopic(responses, topic);
        if (quotes.length > 0) {
          emergingThemes.push({
            theme: topic,
            frequency: totalCount,
            trend: 'rare',
            sentiment: topicFrequencies[topic].sentimentBreakdown,
            representativeQuotes: quotes.slice(0, 2),
          });
        }
      }
    });

    // Sort by frequency (descending) and return top 5
    return emergingThemes
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }

  /**
   * Calculate topic frequencies for a subset of responses
   */
  private calculateTopicFrequenciesForSubset(responses: ResponseDocument[]): Record<string, { count: number }> {
    const freq: Record<string, { count: number }> = {};
    
    responses.forEach(r => {
      const topics = r.metadata?.canonicalTopics || r.metadata?.allTopics || [];
      const uniqueTopics = new Set(topics);
      
      uniqueTopics.forEach(topic => {
        if (!freq[topic]) freq[topic] = { count: 0 };
        freq[topic].count++;
      });
    });
    
    return freq;
  }

  /**
   * Extract representative quotes for a specific topic
   */
  private extractRepresentativeQuotesForTopic(responses: ResponseDocument[], topic: string): string[] {
    const quotes: string[] = [];
    
    for (const response of responses) {
      const topics = response.metadata?.canonicalTopics || response.metadata?.allTopics || [];
      if (topics.includes(topic)) {
        // Get key quotes from this response
        const keyQuotes = response.metadata?.quotes?.keyQuotes || [];
        for (const quoteObj of keyQuotes) {
          const quoteText = typeof quoteObj === 'string' ? quoteObj : (quoteObj.quote || '');
          if (quoteText && quoteText.length > 20 && quoteText.length < 200) {
            quotes.push(quoteText);
            if (quotes.length >= 3) break;
          }
        }
      }
      if (quotes.length >= 3) break;
    }
    
    return quotes;
  }

  /**
   * Calculate climate data with semantic axis based on topics and sentiment
   * This provides the data for the "Overall Response Climate" card
   */
  calculateClimateData(
    responses: ResponseDocument[],
    topTopics: string[],
    sentimentDistribution: { positive: number; neutral: number; negative: number; averageScore: number },
    emotionalTones: Array<{ tone: string; percentage: number }>
  ): {
    positivityScore: number;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
    dominantTendency: string;
    semanticAxis?: { left: string; right: string; position: number };
  } {
    // Calculate positivity score (0-100)
    // Formula: (positive% + neutral% * 0.5) 
    // This gives full weight to positive, half weight to neutral, no weight to negative
    const positivityScore = Math.round(
      sentimentDistribution.positive + (sentimentDistribution.neutral * 0.5)
    );
    
    // Determine dominant tendency based on positive-negative balance
    const tendencyValue = (sentimentDistribution.positive - sentimentDistribution.negative) / 100;
    const dominantTendency = tendencyValue > 0.2 ? 'positive' : tendencyValue < -0.2 ? 'negative' : 'neutral';
    
    // Create semantic axis from emotional tones or topics
    let semanticAxis: { left: string; right: string; position: number } | undefined;
    
    if (emotionalTones.length >= 2) {
      // Use dominant emotional tones to create a semantic axis
      const leftTone = emotionalTones[0]?.tone || 'concerned';
      const rightTone = emotionalTones.length > 1 ? emotionalTones[1]?.tone : 'satisfied';
      
      semanticAxis = {
        left: leftTone,
        right: rightTone,
        position: (tendencyValue + 1) / 2 // Normalize -1..1 to 0..1
      };
    } else if (topTopics.length >= 2) {
      // Fallback to topics if not enough emotional tones
      semanticAxis = {
        left: topTopics[0] || 'negative',
        right: topTopics[1] || 'positive',
        position: (tendencyValue + 1) / 2
      };
    }
    
    return {
      positivityScore,
      sentimentBreakdown: {
        positive: sentimentDistribution.positive,
        neutral: sentimentDistribution.neutral,
        negative: sentimentDistribution.negative
      },
      dominantTendency,
      semanticAxis
    };
  }
}
