import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';
import { TrendAnalysis } from '../calculators/trend.calculator';

/**
 * Findings Generator
 * 
 * Generates key findings from analytics data
 * Uses algorithmic analysis (not LLM) to identify:
 * - Top topics and their significance
 * - Sentiment patterns (with emphasis on negative issues)
 * - Topics with concerning sentiment
 * - Trend-based findings
 * - Emotional tone distributions
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
    dataQuality: any,
    topicSentiment?: Record<string, { positive: number; neutral: number; negative: number; total: number }>,
    trends?: TrendAnalysis
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
    type?: 'positive' | 'negative' | 'neutral' | 'trend';
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
      type?: 'positive' | 'negative' | 'neutral' | 'trend';
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
        importance: 'high',
        type: 'neutral'
      });
    }

    // Finding 2: Sentiment overview with emphasis on negative if significant
    const dominantSentiment = sentiment.positive > sentiment.negative ? 'positive' : 
                               sentiment.negative > sentiment.positive ? 'negative' : 'neutral';
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
      importance: sentiment.negative > 30 ? 'high' : 'medium',
      type: dominantSentiment as 'positive' | 'negative' | 'neutral'
    });

    // Finding 3: Topics with HIGH NEGATIVE SENTIMENT (IMPORTANT - highlight problem areas)
    if (topicSentiment) {
      const negativeTopics = Object.entries(topicSentiment)
        .filter(([_, data]) => {
          const negPct = data.total > 0 ? (data.negative / data.total) : 0;
          return negPct > 0.4 && data.total >= 3; // More than 40% negative and at least 3 mentions
        })
        .sort((a, b) => (b[1].negative / b[1].total) - (a[1].negative / a[1].total))
        .slice(0, 3);

      for (const [topic, data] of negativeTopics) {
        const negPct = Math.round((data.negative / data.total) * 100);
        const negQuotes = representativeQuotes
          .filter(q => q.topics?.includes(topic) && q.sentiment === 'negative')
          .slice(0, 2)
          .map(q => q.text);

        keyFindings.push({
          finding: `"${topic}" has concerning sentiment: ${negPct}% negative (${data.negative}/${data.total} responses)`,
          evidence: {
            supportingQuotes: negQuotes,
            pattern: `Topic shows predominantly negative feedback`,
            significance: negPct / 100
          },
          confidence: data.total >= 5 ? 'high' : 'medium',
          basedOnResponses: data.total,
          importance: 'high',
          type: 'negative'
        });
      }
    }

    // Finding 4: Trend-based findings (if trends available)
    if (trends?.hasEnoughData) {
      // Worsening sentiment trends
      for (const shift of trends.sentimentShifts.filter(s => s.direction === 'worsening').slice(0, 2)) {
        keyFindings.push({
          finding: `⚠️ "${shift.topic}" sentiment declining: ${shift.fromLabel} → ${shift.toLabel}`,
          evidence: {
            supportingQuotes: [],
            pattern: shift.description
          },
          confidence: 'high',
          basedOnResponses: responses.length,
          importance: 'high',
          type: 'trend'
        });
      }

      // Emerging topics
      for (const emerging of trends.emergingTopics.slice(0, 1)) {
        keyFindings.push({
          finding: `📈 Emerging topic: "${emerging.topic}" (+${emerging.changePercentage}% in recent responses)`,
          evidence: {
            supportingQuotes: [],
            pattern: emerging.description
          },
          confidence: emerging.type === 'new' ? 'medium' : 'high',
          basedOnResponses: emerging.newerMentions,
          importance: 'medium',
          type: 'trend'
        });
      }
    }

    // Finding 5: Emotional tone (only if notable)
    if (dominantEmotionalTones.length > 0) {
      const negativeEmotions = ['frustrated', 'disappointed', 'angry', 'dissatisfied', 'concerned', 'worried'];
      const negativeTonesPresent = dominantEmotionalTones
        .slice(0, 5)
        .filter(t => negativeEmotions.some(ne => t.tone.toLowerCase().includes(ne)));

      if (negativeTonesPresent.length > 0) {
        const toneStr = negativeTonesPresent.map(t => `${t.tone} (${t.percentage}%)`).join(', ');
        keyFindings.push({
          finding: `Notable negative emotions detected: ${toneStr}`,
          evidence: {
            supportingQuotes: [],
            pattern: `Emotional tone analysis across ${responses.length} responses`
          },
          confidence: 'medium',
          basedOnResponses: responses.length,
          importance: 'high',
          type: 'negative'
        });
      }
    }

    // Finding 6: Response quality (only if problematic)
    const avgQuality = dataQuality.overallScore;
    if (avgQuality < 0.6) {
      keyFindings.push({
        finding: `Average response quality: ${(avgQuality * 100).toFixed(0)}%`,
        evidence: {
          supportingQuotes: [],
          pattern: `Quality metrics: completeness, depth, and clarity averaged across responses`
        },
        confidence: 'high',
        basedOnResponses: responses.length,
        importance: 'medium',
        type: 'neutral'
      });
    }

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
      const ct = r.metadata?.canonicalTopics;
      const topicsForQuote = (ct && ct.length > 0) ? ct : (r.metadata?.allTopics || []);
      if (responseQuotes && Array.isArray(responseQuotes)) {
        responseQuotes.forEach((q: any) => {
          quotes.push({
            text: q.text || q.quote || '',
            topics: topicsForQuote,
            sentiment: r.metadata?.overallSentiment?.label || 'neutral'
          });
        });
      } else if (responseQuotes?.keyQuotes && Array.isArray(responseQuotes.keyQuotes)) {
        responseQuotes.keyQuotes.forEach((q: any) => {
          quotes.push({
            text: q.quote || '',
            topics: topicsForQuote,
            sentiment: r.metadata?.overallSentiment?.label || 'neutral'
          });
        });
      }
    });

    return quotes.slice(0, limit);
  }
}
