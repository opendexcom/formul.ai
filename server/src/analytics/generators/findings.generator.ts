import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';

/**
 * Findings Generator
 * 
 * Generates key findings from analytics data
 * Uses algorithmic analysis (not LLM) to identify:
 * - Top topics and their significance
 * - Sentiment patterns
 * - Emotional tone distributions
 * - Response quality metrics
 */
@Injectable()
export class FindingsGenerator {
  
  /**
   * Calculate confidence based on what percentage of responses support the finding
   * High coverage (>50%): high confidence - finding represents majority
   * Medium coverage (30-50%): medium confidence - finding represents significant portion
   * Low coverage (<30%): low confidence - finding represents minority
   */
  private calculateConfidenceFromCoverage(
    supportingResponses: number,
    totalResponses: number
  ): 'high' | 'medium' | 'low' {
    const coverage = (supportingResponses / totalResponses) * 100;
    
    if (coverage >= 50) return 'high';
    if (coverage >= 30) return 'medium';
    return 'low';
  }

  /**
   * Generate key findings based on analyzed data
   */
  generateKeyFindings(
    responses: ResponseDocument[],
    topTopics: string[],
    topicFrequencies: Record<string, any>,
    sentimentDistribution: any,
    representativeQuotes: any[],
    dominantEmotionalTones: Array<{ tone: string; percentage: number }>,
    dataQuality: any
  ): Array<{
    finding: string;
    evidence: {
      correlation?: number;
      significance?: number;
      supportingQuotes: string[];
      pattern: string;
    };
    confidence: 'high' | 'medium' | 'low';
    basedOnResponses: number;
    importance?: 'high' | 'medium' | 'low';
  }> {
    const keyFindings: Array<{
      finding: string;
      evidence: {
        correlation?: number;
        significance?: number;
        supportingQuotes: string[];
        pattern: string;
      };
      confidence: 'high' | 'medium' | 'low';
      basedOnResponses: number;
      importance?: 'high' | 'medium' | 'low';
    }> = [];
    
    const sentiment = sentimentDistribution;
    
    // Finding 1: Top topics
    if (topTopics.length > 0) {
      const topTopic = topTopics[0];
      const topicData = topicFrequencies[topTopic];
      keyFindings.push({
        finding: `Most discussed topic: "${topTopic}" (mentioned in ${topicData.percentage}% of responses)`,
        evidence: {
          supportingQuotes: representativeQuotes
            .filter(q => q.topics?.includes(topTopic))
            .slice(0, 3)
            .map(q => q.text),
          pattern: `Mentioned ${topicData.count} times across ${responses.length} responses`
        },
        confidence: this.calculateConfidenceFromCoverage(topicData.count, responses.length),
        basedOnResponses: topicData.count,
        importance: 'high'
      });
    }

    // Finding 2: Sentiment overview
    const dominantSentiment = sentiment.positive > sentiment.negative ? 'positive' : 
                               sentiment.negative > sentiment.positive ? 'negative' : 'neutral';
    // Confidence based on how dominant the sentiment is
    const sentimentDominance = Math.max(sentiment.positive, sentiment.negative, sentiment.neutral);
    const sentimentConfidence = sentimentDominance >= 50 ? 'high' : sentimentDominance >= 30 ? 'medium' : 'low';
    keyFindings.push({
      finding: `Overall sentiment is ${dominantSentiment} (${sentiment.positive}% positive, ${sentiment.neutral}% neutral, ${sentiment.negative}% negative)`,
      evidence: {
        supportingQuotes: representativeQuotes.slice(0, 3).map(q => q.text),
        pattern: `Sentiment distribution across ${responses.length} responses`,
        significance: Math.abs(sentiment.positive - sentiment.negative) / 100
      },
      confidence: sentimentConfidence,
      basedOnResponses: responses.length,
      importance: sentiment.negative > 30 ? 'high' : 'medium'
    });

    // Finding 3: Emotional tone
    if (dominantEmotionalTones.length > 0) {
      const topTones = dominantEmotionalTones
        .slice(0, 3)
        .map(t => `${t.tone} (${t.percentage}%)`)
        .join(', ');
      // Confidence based on top tone's percentage
      const topTonePercentage = dominantEmotionalTones[0].percentage;
      const toneConfidence = topTonePercentage >= 50 ? 'high' : topTonePercentage >= 30 ? 'medium' : 'low';
      keyFindings.push({
        finding: `Dominant emotional tones: ${topTones}`,
        evidence: {
          supportingQuotes: [],
          pattern: `Emotional tone distribution across ${responses.length} responses`
        },
        confidence: toneConfidence,
        basedOnResponses: responses.length
      });
    }

    // Finding 4: Response quality
    const avgQuality = dataQuality.overallScore;
    // Confidence based on response quality consistency (assume high quality = high confidence)
    const qualityConfidence = avgQuality >= 0.7 ? 'high' : avgQuality >= 0.5 ? 'medium' : 'low';
    keyFindings.push({
      finding: `Average response quality: ${(avgQuality * 100).toFixed(0)}%`,
      evidence: {
        supportingQuotes: [],
        pattern: `Quality metrics: completeness, depth, and clarity averaged across responses`
      },
      confidence: qualityConfidence,
      basedOnResponses: responses.length,
      importance: avgQuality < 0.6 ? 'high' : 'medium'
    });

    return keyFindings;
  }

  /**
   * Extract dominant emotional tones from responses
   */
  extractDominantEmotionalTones(
    responses: ResponseDocument[]
  ): Array<{ tone: string; count: number; percentage: number }> {
    const toneCounts = new Map<string, number>();
    
    responses.forEach(r => {
      const emotionalTone = r.metadata?.overallSentiment?.emotionalTone;
      if (emotionalTone) {
        toneCounts.set(emotionalTone, (toneCounts.get(emotionalTone) || 0) + 1);
      }
    });

    return Array.from(toneCounts.entries())
      .map(([tone, count]) => ({
        tone,
        count,
        percentage: Math.round((count / responses.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Extract representative quotes from responses
   */
  extractRepresentativeQuotes(
    responses: ResponseDocument[],
    limit: number = 20
  ): Array<{ text: string; topics: string[]; sentiment: string }> {
    const quotes: Array<{ text: string; topics: string[]; sentiment: string }> = [];
    
    responses.forEach(r => {
      const responseQuotes = r.metadata?.quotes;
      if (responseQuotes && Array.isArray(responseQuotes)) {
        responseQuotes.forEach((q: any) => {
          quotes.push({
            text: q.text || q.quote || '',
            topics: r.metadata?.canonicalTopics || r.metadata?.allTopics || [],
            sentiment: r.metadata?.overallSentiment?.label || 'neutral'
          });
        });
      } else if (responseQuotes?.keyQuotes && Array.isArray(responseQuotes.keyQuotes)) {
        responseQuotes.keyQuotes.forEach((q: any) => {
          quotes.push({
            text: q.quote || '',
            topics: r.metadata?.canonicalTopics || r.metadata?.allTopics || [],
            sentiment: r.metadata?.overallSentiment?.label || 'neutral'
          });
        });
      }
    });

    return quotes.slice(0, limit);
  }
}
