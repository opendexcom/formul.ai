import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';
import { ResponseDocument } from '../../schemas/response.schema';
import { TrendAnalysis } from '../calculators/trend.calculator';

/**
 * Recommendations Generator
 * 
 * Generates actionable recommendations based on analytics data
 * Uses rule-based logic AND LLM to identify:
 * - Issues requiring urgent attention (negative sentiment)
 * - Topic-specific action items
 * - Trend-based recommendations (emerging issues, declining satisfaction)
 * - Successful practices to maintain
 */
@Injectable()
export class RecommendationsGenerator {
  
  constructor(
    private aiService: AiService,
    private promptBuilder: PromptBuilder,
  ) {}
  
  /**
   * Generate recommendations based on analyzed data
   */
  async generateRecommendations(
    sentimentDistribution: any,
    topTopics: string[],
    dataQuality: any,
    responses?: ResponseDocument[],
    topicSentiment?: Record<string, { positive: number; neutral: number; negative: number; total: number }>,
    trends?: TrendAnalysis
  ): Promise<Array<{
    recommendation: string;
    priority: 'urgent' | 'important' | 'maintain';
    basedOn: string;
    suggestedAction: string;
    expectedImpact: string;
    confidence: 'high' | 'medium' | 'low';
  }>> {
    const recommendations: Array<{
      recommendation: string;
      priority: 'urgent' | 'important' | 'maintain';
      basedOn: string;
      suggestedAction: string;
      expectedImpact: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    const sentiment = sentimentDistribution;
    const avgQuality = dataQuality.overallScore;

    // 1. Identify topics with high negative sentiment (URGENT)
    if (topicSentiment) {
      const negativeTopics = Object.entries(topicSentiment)
        .filter(([_, data]) => data.negative > data.positive && data.total >= 3)
        .sort((a, b) => (b[1].negative / b[1].total) - (a[1].negative / a[1].total))
        .slice(0, 3);

      for (const [topic, data] of negativeTopics) {
        const negPct = Math.round((data.negative / data.total) * 100);
        recommendations.push({
          recommendation: `Address concerns about "${topic}"`,
          priority: 'urgent',
          basedOn: `${negPct}% negative sentiment (${data.negative}/${data.total} responses) when discussing "${topic}"`,
          suggestedAction: `Review responses mentioning "${topic}" to identify specific pain points and develop targeted improvements`,
          expectedImpact: `Resolving "${topic}" issues could shift ${data.negative} responses from negative to positive`,
          confidence: data.total >= 5 ? 'high' : 'medium'
        });
      }
    }

    // 2. Trend-based recommendations (URGENT for worsening, IMPORTANT for emerging)
    if (trends?.hasEnoughData) {
      // Worsening sentiment on topics
      for (const shift of trends.sentimentShifts.filter(s => s.direction === 'worsening')) {
        recommendations.push({
          recommendation: `Investigate declining satisfaction with "${shift.topic}"`,
          priority: 'urgent',
          basedOn: shift.description,
          suggestedAction: `Compare recent responses about "${shift.topic}" with older ones to identify what changed`,
          expectedImpact: `Early intervention can prevent further deterioration of "${shift.topic}" sentiment`,
          confidence: 'high'
        });
      }

      // Emerging topics that need attention
      for (const emerging of trends.emergingTopics.slice(0, 2)) {
        recommendations.push({
          recommendation: `Monitor and respond to emerging topic: "${emerging.topic}"`,
          priority: 'important',
          basedOn: emerging.description,
          suggestedAction: `Analyze what's driving increased discussion of "${emerging.topic}" and whether it requires action`,
          expectedImpact: `Proactively addressing emerging topics shows responsiveness to user concerns`,
          confidence: emerging.type === 'new' ? 'medium' : 'high'
        });
      }
    }

    // 3. Overall negative sentiment (URGENT)
    if (sentiment.negative > 30) {
      // Find the top negative topics to make recommendation specific
      const negativeTopicNames = topicSentiment 
        ? Object.entries(topicSentiment)
            .filter(([_, data]) => data.negative > data.positive)
            .slice(0, 3)
            .map(([topic]) => topic)
        : [];

      recommendations.push({
        recommendation: 'Address systemic issues causing widespread dissatisfaction',
        priority: 'urgent',
        basedOn: `${sentiment.negative}% of all responses express negative sentiment`,
        suggestedAction: negativeTopicNames.length > 0 
          ? `Focus on improving: ${negativeTopicNames.join(', ')}. These topics show the highest negative sentiment.`
          : 'Conduct deeper analysis of negative responses to identify root causes',
        expectedImpact: 'Reducing negative sentiment by 10% could significantly improve overall perception',
        confidence: 'high'
      });
    }

    // 4. Positive topics to maintain (MAINTAIN)
    if (topicSentiment) {
      const positiveTopics = Object.entries(topicSentiment)
        .filter(([_, data]) => data.positive > data.negative * 2 && data.total >= 3)
        .sort((a, b) => (b[1].positive / b[1].total) - (a[1].positive / a[1].total))
        .slice(0, 2);

      if (positiveTopics.length > 0) {
        const topicNames = positiveTopics.map(([topic]) => `"${topic}"`).join(', ');
        recommendations.push({
          recommendation: `Maintain strengths in ${topicNames}`,
          priority: 'maintain',
          basedOn: `These topics consistently receive positive feedback`,
          suggestedAction: `Document what makes ${topicNames} successful and apply similar approaches elsewhere`,
          expectedImpact: 'Leverage proven strengths to improve weaker areas',
          confidence: 'high'
        });
      }
    }

    // 5. Improving sentiment trends (MAINTAIN)
    if (trends?.hasEnoughData) {
      for (const shift of trends.sentimentShifts.filter(s => s.direction === 'improving').slice(0, 1)) {
        recommendations.push({
          recommendation: `Continue improvements on "${shift.topic}"`,
          priority: 'maintain',
          basedOn: shift.description,
          suggestedAction: `Identify what actions drove the improvement and replicate for other areas`,
          expectedImpact: 'Sustained positive momentum builds long-term satisfaction',
          confidence: 'high'
        });
      }
    }

    // 6. Low response quality (IMPORTANT)
    if (avgQuality < 0.6) {
      recommendations.push({
        recommendation: 'Improve question clarity to get better insights',
        priority: 'important',
        basedOn: `Response quality score is ${(avgQuality * 100).toFixed(0)}%, indicating unclear questions or respondent confusion`,
        suggestedAction: 'Review questions for ambiguity, add examples or guidance, consider simplifying complex questions',
        expectedImpact: 'Higher quality responses lead to more actionable insights',
        confidence: 'high'
      });
    }

    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Prioritize recommendations based on urgency and impact
   */
  prioritizeRecommendations(
    recommendations: Array<{
      recommendation: string;
      priority: 'urgent' | 'important' | 'maintain';
      basedOn: string;
      suggestedAction: string;
      expectedImpact: string;
      confidence: 'high' | 'medium' | 'low';
    }>
  ): Array<{
    recommendation: string;
    priority: 'urgent' | 'important' | 'maintain';
    basedOn: string;
    suggestedAction: string;
    expectedImpact: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const priorityOrder = { urgent: 1, important: 2, maintain: 3 };
    return recommendations.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Format recommendations for display
   */
  formatRecommendations(
    recommendations: Array<{
      recommendation: string;
      priority: 'urgent' | 'important' | 'maintain';
      basedOn: string;
      suggestedAction: string;
      expectedImpact: string;
      confidence: 'high' | 'medium' | 'low';
    }>
  ): string {
    return recommendations
      .map((rec, idx) => {
        let formatted = `${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}\n`;
        formatted += `   Based on: ${rec.basedOn}\n`;
        formatted += `   Action: ${rec.suggestedAction}\n`;
        formatted += `   Impact: ${rec.expectedImpact}\n`;
        formatted += `   Confidence: ${rec.confidence}\n`;
        return formatted;
      })
      .join('\n');
  }
}
