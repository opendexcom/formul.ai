import { Injectable } from '@nestjs/common';
import { ResponseDocument } from '../../schemas/response.schema';
import { Form, FormDocument } from '../../schemas/form.schema';

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

    // Count topic co-occurrences
    responses.forEach(response => {
      const topics = response.metadata?.canonicalTopics || response.metadata?.allTopics || [];
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
          uniqueResponses
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
    const topicSentimentMap = new Map<string, {
      positive: number;
      neutral: number;
      negative: number;
      scores: number[];
    }>();

    // Aggregate sentiment data per topic
    responses.forEach(response => {
      const topics = response.metadata?.canonicalTopics || response.metadata?.allTopics || [];
      const sentiment = response.metadata?.overallSentiment;
      
      if (!sentiment || topics.length === 0) return;

      topics.forEach(topic => {
        if (!topicSentimentMap.has(topic)) {
          topicSentimentMap.set(topic, {
            positive: 0,
            neutral: 0,
            negative: 0,
            scores: []
          });
        }

        const data = topicSentimentMap.get(topic);
        if (!data) return;
        
        const label = sentiment.label || 'neutral';
        
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
      .map(([topic, data]) => {
        const total = data.positive + data.neutral + data.negative;
        const avgScore = data.scores.length > 0
          ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
          : 0;

        // Determine dominant sentiment
        let dominantSentiment = 'neutral';
        const posPercent = (data.positive / total) * 100;
        const negPercent = (data.negative / total) * 100;
        
        if (posPercent > 60) dominantSentiment = 'positive';
        else if (negPercent > 60) dominantSentiment = 'negative';
        else if (posPercent > 40 && negPercent < 20) dominantSentiment = 'mostly positive';
        else if (negPercent > 40 && posPercent < 20) dominantSentiment = 'mostly negative';
        else dominantSentiment = 'mixed';

        return {
          topic,
          sentiment: {
            positive: Math.round((data.positive / total) * 100),
            neutral: Math.round((data.neutral / total) * 100),
            negative: Math.round((data.negative / total) * 100),
          },
          averageScore: Math.round(avgScore * 100) / 100,
          dominantSentiment,
          responseCount: total
        };
      })
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
    responses: ResponseDocument[]
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
    // Identify closed questions (dropdown, radio, checkbox)
    const closedQuestions = form.questions.filter(q => 
      ['dropdown', 'radio', 'checkbox'].includes(q.type)
    );

    if (closedQuestions.length === 0) {
      return [];
    }

    const correlations = closedQuestions.map(question => {
      // Group responses by answer value
      const answerGroups = new Map<string, ResponseDocument[]>();

      responses.forEach(response => {
        const answer = response.answers.find(a => a.questionId === question.id);
        if (!answer || !answer.value) return;

        // Handle both single values and arrays (for checkbox questions)
        const values = Array.isArray(answer.value) ? answer.value : [answer.value];

        values.forEach(value => {
          const valueStr = String(value);
          if (!answerGroups.has(valueStr)) {
            answerGroups.set(valueStr, []);
          }
          answerGroups.get(valueStr)!.push(response);
        });
      });

      // Calculate topic distribution for each answer value
      const answerCorrelations = Array.from(answerGroups.entries()).map(([answerValue, groupResponses]) => {
        // Count topics across responses in this group
        const topicCounts = new Map<string, number>();
        
        groupResponses.forEach(response => {
          const topics = response.metadata?.canonicalTopics || response.metadata?.allTopics || [];
          topics.forEach(topic => {
            topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
          });
        });

        // Convert to distribution array
        const totalTopicMentions = Array.from(topicCounts.values()).reduce((sum, count) => sum + count, 0);
        const topicDistribution = Array.from(topicCounts.entries())
          .map(([topic, count]) => ({
            topic,
            percentage: totalTopicMentions > 0 ? Math.round((count / totalTopicMentions) * 100) : 0,
            count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10 topics per answer value

        return {
          answerValue,
          topicDistribution,
          responseCount: groupResponses.length
        };
      })
      .filter(ac => ac.responseCount >= 2) // Only include answer values with at least 2 responses
      .sort((a, b) => b.responseCount - a.responseCount);

      return {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        correlations: answerCorrelations
      };
    })
    .filter(qc => qc.correlations.length > 0); // Only include questions with meaningful correlations

    return correlations;
  }
}
