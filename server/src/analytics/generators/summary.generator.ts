import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';

/**
 * Summary Generator
 * 
 * Generates LLM-based executive summary of analytics results
 * Includes:
 * - Context preparation (topic quotes, closed question stats)
 * - LLM prompt construction
 * - Summary generation with fallback handling
 */
@Injectable()
export class SummaryGenerator {
  constructor(
    private aiService: AiService,
    private promptBuilder: PromptBuilder,
  ) {}

  /**
   * Generate comprehensive analytics summary using LLM
   */
  async generateAnalyticsSummary(
    form: Form | FormDocument,
    responses: ResponseDocument[],
    topTopics: string[],
    sentimentDistribution: any,
    keyFindings: any[],
    recommendations: any[],
    highlightedQuotes: any[],
    closedQuestionCorrelations: any[]
  ): Promise<string> {
    try {
      // Find responses related to most common topics for citations
      const topicToResponses = new Map<string, ResponseDocument[]>();
      
      // Group responses by their most common topics
      for (const response of responses) {
        const responseTopics = response.metadata?.allTopics || [];
        for (const topic of responseTopics.slice(0, 3)) { // Top 3 topics per response
          if (topTopics.includes(topic)) {
            if (!topicToResponses.has(topic)) {
              topicToResponses.set(topic, []);
            }
            const topicResponses = topicToResponses.get(topic);
            if (topicResponses) {
              topicResponses.push(response);
            }
          }
        }
      }

      // Get representative quotes for top 3 topics with highest response counts
      const topicQuotes = this.extractTopicQuotes(topTopics, topicToResponses);

      // Calculate closed question statistics
      const closedQuestionStats = this.calculateClosedQuestionStats(form, responses);

      // Format insights from closed question topic correlations
      const closedQuestionInsights = this.formatClosedQuestionInsights(closedQuestionCorrelations);

      // Build and execute prompt
      const prompt = this.promptBuilder.buildAnalyticsSummaryPrompt(
        form,
        topTopics,
        sentimentDistribution,
        responses.length,
        topicQuotes,
        closedQuestionStats,
        closedQuestionInsights
      );

      console.log('[SummaryGenerator] Sending prompt to AI service, prompt length:', prompt.length);
      const summary = await this.aiService['invokeModelRaw'](prompt, false); // Use plain text, not JSON format
      console.log('[SummaryGenerator] AI service returned summary, length:', summary?.length || 0);
      
      if (!summary || summary.trim().length === 0) {
        console.warn('[SummaryGenerator] AI service returned empty summary, using fallback');
        return this.generateFallbackSummary(
          form,
          responses.length,
          topTopics,
          sentimentDistribution,
          highlightedQuotes
        );
      }
      
      return summary.trim();
    } catch (error) {
      console.error('[SummaryGenerator] Error generating summary:', error);
      // Fallback to basic summary with quote if available
      return this.generateFallbackSummary(
        form,
        responses.length,
        topTopics,
        sentimentDistribution,
        highlightedQuotes
      );
    }
  }

  /**
   * Extract representative quotes for top topics
   */
  private extractTopicQuotes(
    topTopics: string[],
    topicToResponses: Map<string, ResponseDocument[]>
  ): Array<{ topic: string; quote: string; count: number }> {
    return topTopics.slice(0, 3).map(topic => {
      const relatedResponses = topicToResponses.get(topic) || [];
      if (relatedResponses.length > 0) {
        // Get a quote from the first related response
        const response = relatedResponses[0];
        const quote = response.metadata?.quotes?.keyQuotes?.[0];
        return quote ? { 
          topic, 
          quote: quote.quote, 
          count: relatedResponses.length 
        } : null;
      }
      return null;
    }).filter(Boolean) as Array<{ topic: string; quote: string; count: number }>;
  }

  /**
   * Calculate statistics for closed questions (dropdown, radio, checkbox)
   */
  private calculateClosedQuestionStats(
    form: Form | FormDocument,
    responses: ResponseDocument[]
  ): Array<{
    question: string;
    topAnswers: Array<{ value: string; count: number; percentage: number }>;
  }> {
    const closedQuestions = form.questions.filter(q => 
      ['dropdown', 'radio', 'checkbox'].includes(q.type)
    );

    return closedQuestions.map(q => {
      const answerCounts = new Map<string, number>();
      responses.forEach(r => {
        const answer = r.answers.find(a => a.questionId === q.id);
        if (answer?.value) {
          const values = Array.isArray(answer.value) ? answer.value : [answer.value];
          values.forEach(v => {
            const valStr = String(v);
            answerCounts.set(valStr, (answerCounts.get(valStr) || 0) + 1);
          });
        }
      });
      
      const sortedAnswers = Array.from(answerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Top 3 answers
      
      return {
        question: q.title,
        topAnswers: sortedAnswers.map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / responses.length) * 100)
        }))
      };
    });
  }

  /**
   * Format insights from closed question topic correlations
   */
  private formatClosedQuestionInsights(
    closedQuestionCorrelations: any[]
  ): Array<{
    question: string;
    answer: string;
    count: number;
    topTopic: string;
    topicPercentage: number;
  }> {
    // Safety check: return empty array if structure is not what we expect
    if (!Array.isArray(closedQuestionCorrelations) || closedQuestionCorrelations.length === 0) {
      return [];
    }

    return closedQuestionCorrelations
      .slice(0, 2) // Top 2 questions
      .map(qc => {
        // Check if qc has the expected structure
        if (!qc || !Array.isArray(qc.correlations) || qc.correlations.length === 0) {
          return null;
        }

        const topCorrelation = qc.correlations[0]; // Most common answer
        if (!topCorrelation) return null;
        
        // Check if topicDistribution exists and has items
        if (!Array.isArray(topCorrelation.topicDistribution) || topCorrelation.topicDistribution.length === 0) {
          return null;
        }

        const topTopic = topCorrelation.topicDistribution[0];
        if (!topTopic) return null;
        
        return {
          question: qc.questionTitle,
          answer: topCorrelation.answerValue,
          count: topCorrelation.responseCount,
          topTopic: topTopic.topic,
          topicPercentage: topTopic.percentage
        };
      })
      .filter(Boolean) as Array<{
        question: string;
        answer: string;
        count: number;
        topTopic: string;
        topicPercentage: number;
      }>;
  }

  /**
   * Generate fallback summary when LLM fails
   */
  private generateFallbackSummary(
    form: Form | FormDocument,
    responseCount: number,
    topTopics: string[],
    sentimentDistribution: any,
    highlightedQuotes: any[]
  ): string {
    const sampleQuote = highlightedQuotes?.[0]?.text;
    const quoteText = sampleQuote ? ` One respondent noted: "${sampleQuote.substring(0, 80)}..."` : '';
    
    const sentimentLabel = sentimentDistribution.positive > 50 
      ? 'positive' 
      : sentimentDistribution.negative > 50 
        ? 'negative' 
        : 'neutral';
    
    return `Analysis of ${responseCount} responses to "${form.title}". Top themes: ${topTopics.slice(0, 3).join(', ')}.${quoteText} Overall sentiment is ${sentimentLabel}.`;
  }
}
