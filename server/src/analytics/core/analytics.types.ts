/**
 * Shared TypeScript types and interfaces for Analytics module
 */

// ===== Task Types =====

export interface AnalyticsTask {
  taskId: string;
  formId: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

export interface ProgressUpdate {
  type: 'start' | 'progress' | 'complete' | 'error' | 'responses_claimed' | 'responses_processing' | 'responses_processed';
  message: string;
  progress: number;
  taskId: string;
  stats?: ProcessingStats;
  processedResponseIds?: string[]; // IDs of responses claimed or processed in this batch
}

export interface ProcessingStats {
  processedResponses?: number;
  canonicalTopics?: number;
  totalTime?: number;
  [key: string]: any;
}

// ===== Processing Results =====

export interface ProcessingResult {
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  totalTime: number;
}

export interface ClusteringResult {
  canonicalTopics: string[];
  topicMapping: Record<string, string>;
  totalTime: number;
}

export interface AggregateResult {
  topicDistribution: TopicDistribution;
  sentimentMetrics: SentimentMetrics;
  correlations: CorrelationMetrics;
  keyFindings: Finding[];
  recommendations: Recommendation[];
  summary: string;
}

// ===== Analytics Data Structures =====

export interface TopicDistribution {
  [topic: string]: {
    count: number;
    percentage: number;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    representativeQuotes: string[];
    associatedQuestions: string[];
  };
}

export interface SentimentMetrics {
  overall: {
    positive: number;
    neutral: number;
    negative: number;
  };
  byQuestion: QuestionSentiment[];
  byTopic: TopicSentiment[];
}

export interface QuestionSentiment {
  questionId: string;
  questionText: string;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  averageScore: number;
}

export interface TopicSentiment {
  topic: string;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  averageScore: number;
}

export interface CorrelationMetrics {
  topicCooccurrence: TopicCooccurrence[];
  topicSentimentCorrelation: TopicSentimentCorrelation[];
  closedQuestionCorrelations: ClosedQuestionCorrelation[];
}

export interface TopicCooccurrence {
  topic1: string;
  topic2: string;
  count: number;
  percentage: number;
}

export interface TopicSentimentCorrelation {
  topic: string;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  averageSentiment: number;
}

export interface ClosedQuestionCorrelation {
  questionId: string;
  questionText: string;
  answer: string;
  topicPreferences: {
    topic: string;
    count: number;
    percentage: number;
  }[];
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  category: 'topic' | 'sentiment' | 'correlation' | 'pattern';
  confidence: number;
  supportingData: any;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  actionItems: string[];
}

// ===== Sampling Types =====

export interface SamplingStrategy {
  description: string;
  rationale: string;
  criteria: string[];
}

export interface DataQuality {
  totalResponses: number;
  validResponses: number;
  averageResponseLength: number;
  completionRate: number;
  textQuality: 'high' | 'medium' | 'low';
  overallScore: number; // Average quality score from 0-1
}

// ===== Response Processing Types =====

export interface ResponseMetadata {
  rawTopics?: string[];
  canonicalTopics?: string[];
  overallSentiment?: {
    label: 'positive' | 'neutral' | 'negative';
    score: number;
    confidence: number;
  };
  quotes?: string[];
  processingTaskId?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingError?: string;
}

// ===== Reprocess Options =====

export interface ReprocessOptions {
  forceReprocess?: boolean;
  onlyFailed?: boolean;
  specificResponseIds?: string[];
}

// ===== Analytics Result (Complete) =====

export interface AnalyticsResult {
  processing: ProcessingResult;
  clustering: ClusteringResult;
  aggregate: AggregateResult;
}

// ===== Topic Frequency Types =====

export interface TopicFrequency {
  [topic: string]: number;
}
