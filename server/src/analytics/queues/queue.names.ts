export enum QueueName {
  ORCHESTRATION = 'analytics-orchestration',      // Main orchestrator
  RESPONSE_PROCESSING = 'response-processing',    // AI-powered response analysis
  TOPIC_CLUSTERING = 'topic-clustering',          // Topic canonicalization
  AGGREGATION = 'aggregation',                    // Statistics & correlations
  AI_GENERATION = 'ai-generation',                // GPT-4 summary/findings/recommendations
  DEAD_LETTER = 'analytics-dead-letter',          // Failed jobs routed here after exhausting retries
}

export interface OrchestrationJobData {
  taskId: string;
  formId: string;
  forceRefresh?: boolean;
}

export interface ResponseProcessingJobData {
  taskId: string;
  formId: string;
  responseIds: string[];        // Batch of responses to process
  batchIndex: number;           // For progress tracking
  totalBatches: number;
}

export interface TopicClusteringJobData {
  taskId: string;
  formId: string;
}

export interface AggregationJobData {
  taskId: string;
  formId: string;
}

export interface AIGenerationJobData {
  taskId: string;
  formId: string;
  generationType: 'summary' | 'findings' | 'recommendations';
  inputData: any;               // Aggregated data needed for generation
}

export interface DeadLetterJobData<T = any> {
  originalQueue: QueueName;
  jobName: string;
  jobId: string | number | undefined;
  taskId?: string;
  formId?: string;
  payload: T;
  failedReason: string;
  attemptsMade: number;
  maxAttempts?: number;
  stacktrace?: string[];
  failedAt: number;
}
