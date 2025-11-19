import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';

/**
 * Recommendations Generator
 * 
 * Generates actionable recommendations based on analytics data
 * Uses rule-based logic AND LLM to identify:
 * - Issues requiring urgent attention (negative sentiment)
 * - Topic consolidation opportunities (LLM-based intelligent analysis)
 * - Question quality improvements
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
    dataQuality: any
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

    // Recommendation 1: Address negative sentiment
    if (sentiment.negative > 30) {
      recommendations.push({
        recommendation: 'Address issues causing negative sentiment',
        priority: 'urgent',
        basedOn: `${sentiment.negative}% of responses show negative sentiment`,
        suggestedAction: 'Review negative responses and identify common pain points or concerns',
        expectedImpact: 'Improved user satisfaction and response quality',
        confidence: 'high'
      });
    }

    // Recommendation 2: Consolidate topics (LLM-enhanced)
    if (topTopics.length >= 8) {
      const consolidationAnalysis = await this.analyzeTopicConsolidation(topTopics);
      
      recommendations.push({
        recommendation: consolidationAnalysis.recommendation,
        priority: 'important',
        basedOn: consolidationAnalysis.basedOn,
        suggestedAction: consolidationAnalysis.suggestedAction,
        expectedImpact: consolidationAnalysis.expectedImpact,
        confidence: consolidationAnalysis.confidence
      });
    }

    // Recommendation 3: Improve question quality
    if (avgQuality < 0.6) {
      recommendations.push({
        recommendation: 'Improve question clarity or provide more guidance to respondents',
        priority: 'important',
        basedOn: `Response quality score is ${(avgQuality * 100).toFixed(0)}%, indicating potential confusion or unclear questions`,
        suggestedAction: 'Review and refine questions to elicit more detailed and relevant responses',
        expectedImpact: 'Higher quality responses and more actionable insights',
        confidence: 'high'
      });
    }

    // Recommendation 4: Maintain positive sentiment
    if (sentiment.positive > 70) {
      recommendations.push({
        recommendation: 'Maintain current practices',
        priority: 'maintain',
        basedOn: `${sentiment.positive}% positive sentiment indicates strong engagement`,
        suggestedAction: 'Document successful strategies for future reference',
        expectedImpact: 'Sustained high-quality responses and user satisfaction',
        confidence: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Use LLM to analyze if topics truly need consolidation or if they're already well-clustered
   */
  private async analyzeTopicConsolidation(
    topics: string[]
  ): Promise<{
    recommendation: string;
    basedOn: string;
    suggestedAction: string;
    expectedImpact: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    try {
      const prompt = this.promptBuilder.buildTopicConsolidationAnalysisPrompt(topics);
      const resultRaw = await this.aiService['invokeModelRaw'](prompt);
      const result = JSON.parse(resultRaw);

      return {
        recommendation: result.recommendation || 'Consider consolidating or categorizing topics',
        basedOn: result.basedOn || `${topics.length} distinct topics identified, which may indicate scattered focus`,
        suggestedAction: result.suggestedAction || `Group related topics into 3-5 main themes for clearer insights`,
        expectedImpact: result.expectedImpact || 'More focused analysis and actionable insights',
        confidence: result.confidence || 'medium'
      };
    } catch (error) {
      console.error('[analyzeTopicConsolidation] LLM analysis failed, using fallback:', error);
      
      // Fallback to rule-based recommendation
      const targetThemes = topics.length >= 15 ? '3-5' : topics.length >= 10 ? '4-6' : '5-7';
      return {
        recommendation: 'Consider consolidating or categorizing topics',
        basedOn: `${topics.length} distinct topics identified, which may indicate scattered focus`,
        suggestedAction: `Group related topics into ${targetThemes} main themes for clearer insights`,
        expectedImpact: 'More focused analysis and actionable insights',
        confidence: 'medium'
      };
    }
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
