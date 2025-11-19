// Analytics type definitions matching backend schema

export interface AnalyticsData {
  lastUpdated: Date;
  totalResponsesAnalyzed: number;
  cacheVersion?: number;
  sentiment: SentimentAnalytics;
  correlations: CorrelationsAnalytics;
  topics: TopicsAnalytics;
  climate?: ClimateAnalytics;
  insights: InsightsAnalytics;
  quotes: QuotesAnalytics;
  deviantCases: DeviantCase[];
  methodology?: MethodologyInfo;
  validation?: ValidationInfo;
  questionStats?: Record<string, QuestionStats>;
}

export interface ClimateAnalytics {
  positivityScore: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  dominantTendency: string;
  semanticAxis?: { left: string; right: string; position: number };
}

export interface SentimentAnalytics {
  overall: {
    positive: number;
    neutral: number;
    negative: number;
    averageScore: number;
  };
  byQuestion: Record<string, {
    positive: number;
    neutral: number;
    negative: number;
    averageScore: number;
  }>;
  trend?: 'improving' | 'stable' | 'declining';
  emotionalTones: Array<{
    tone: string;
    percentage: number;
    contexts?: string[];
  }>;
  dominantTags: string[];
  topicCorrelations?: Array<{
    topic: string;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    averageScore: number;
    dominantSentiment: string;
    responseCount: number;
  }>;
  targets?: Array<{
    target: string;
    avgSentiment: 'positive' | 'neutral' | 'negative';
    frequency: number;
    sentimentRange: 'narrow' | 'wide';
    representativeQuotes: string[];
  }>;
  patterns?: {
    polarization: string;
    ambivalence: string;
    intensityDistribution: string;
  };
}

export interface CorrelationsAnalytics {
  byQuestion: Record<string, QuestionCorrelations>;
  questionPairs: CorrelationPair[];
  topCorrelations: any[];
  closedQuestionTopics?: Array<{
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
  }>;
  topicToRating?: Array<{
    topic: string;
    ratingQuestionId: string;
    averageRating: number;
    correlation: number;
  }>;
  sentimentToChoice?: Array<{
    choiceQuestionId: string;
    choice: string;
    averageSentiment: number;
  }>;
}

export interface QuestionCorrelations {
  questionTitle: string;
  correlatesTo: CorrelationDetail[];
}

export interface CorrelationDetail {
  questionId: string;
  questionTitle: string;
  correlation: number;
  type: 'partial' | 'bivariate';
  controlledFor?: string[];
  significance: number;
  effectSize: 'small' | 'medium' | 'large';
  pattern?: Record<string, Record<string, number>>;
  insight: string;
}

export interface CorrelationPair {
  question1Id: string;
  question1Title: string;
  question2Id: string;
  question2Title: string;
  correlationType: 'numeric' | 'categorical' | 'topic-based' | 'sentiment-based';
  correlation: number;
  strength: 'strong' | 'moderate' | 'weak' | 'very weak';
  insight: string;
  samples?: Array<{ value1: any; value2: any }>;
  type?: 'partial' | 'bivariate';
  controlledFor?: string[];
  significance?: number;
  effectSize?: 'small' | 'medium' | 'large';
  pattern?: Record<string, Record<string, number>>;
}

export interface TopicsAnalytics {
  distribution: Record<string, {
    count: number;
    percentage: number;
    associatedQuestions: string[];
    sentimentBreakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  }>;
  topTopics: string[];
  topicTrends?: Array<{ date: Date; topics: string[] }>;
  dominantThemes: Theme[];
  emergingThemes: EmergingTheme[];
  counterNarratives: CounterNarrative[];
  cooccurrence?: Array<{
    topic1: string;
    topic2: string;
    frequency: number;
    relationship: string;
  }>;
  saturation?: {
    saturated: boolean;
    reasoning: string;
    missingPerspectives: string[];
  };
  discourseFrames?: Array<{
    frame: string;
    frequency: number;
    characteristics: string;
  }>;
}

export interface Theme {
  theme: string;
  frequency: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  representativeQuotes: string[];
  relatedQuestions: string[];
}

export interface EmergingTheme {
  theme: string;
  frequency: number;
  trend: 'growing' | 'rare';
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  representativeQuotes: string[];
}

export interface CounterNarrative {
  narrative: string;
  frequency: number;
  contrast: string;
}

export interface InsightsAnalytics {
  summary: string;
  keyFindings: KeyFinding[];
  recommendations: Recommendation[];
  trends?: Trend[];
  anomalies?: Anomaly[];
  deviantCases?: DeviantCaseInsight[];
  minorityPerspectives?: MinorityPerspective[];
  narrativeShifts?: NarrativeShift[];
}

export interface KeyFinding {
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
  methodologicalNote?: string;
  limitations?: string;
}

export interface Recommendation {
  recommendation: string;
  priority: 'urgent' | 'important' | 'maintain';
  basedOn: string;
  suggestedAction: string;
  expectedImpact: string;
  confidence: 'high' | 'medium' | 'low';
  rationale?: string;
  requiredActions?: string[];
}

export interface Trend {
  trend: string;
  direction: 'up' | 'down' | 'stable' | 'increasing' | 'decreasing' | 'cyclical';
  confidence: number;
  strength?: number;
  evidence?: string;
}

export interface Anomaly {
  description: string;
  affectedQuestions: string[];
  context?: string;
  possibleExplanations?: string[];
  requiresInvestigation?: boolean;
}

export interface DeviantCaseInsight {
  description: string;
  examples: string[];
  possibleExplanations: string[];
  theoreticalImportance: string;
}

export interface MinorityPerspective {
  perspective: string;
  representedBy: string[];
  contrast: string;
}

export interface NarrativeShift {
  from: string;
  to: string;
  timeframe: string;
  possibleReasons: string[];
}

export interface QuotesAnalytics {
  representative: Quote[];
  highQuality: Quote[];
  deviant: Quote[];
}

export interface Quote {
  text: string;
  responseId: string;
  submittedAt: Date;
  topics: string[];
  sentiment: string;
  emotionalTone: string;
  representativeness: 'typical' | 'deviant' | 'mixed';
  depth: 'superficial' | 'moderate' | 'deep';
}

export interface DeviantCase {
  text: string;
  responseId: string;
  submittedAt: Date;
  howDeviant: string;
  significance: string;
  topics: string[];
  sentiment: string;
  frequency: number;
}

export interface MethodologyInfo {
  approach: string;
  stages: string[];
  samplingStrategy: string;
  sampleSize: number;
  dataQualityScore: number;
  limitationsNoted: string[];
}

export interface ValidationInfo {
  convergences: Array<{ where: string; on: string }>;
  divergences: Array<{ where: string; divergence: string; possibleReasons: string[] }>;
  overallConfidence: number;
  limitations: string[];
}

export interface QuestionStats {
  responseCount: number;
  completionRate: number;
  mostCommon: any;
  distribution: Record<string, number>;
}

// Response metadata for filtering
export interface ResponseMetadata {
  hasTextContent: boolean;
  extractedKeywords: string[];
  processedForAnalytics: boolean;
  processingTaskId?: string; // Task ID if currently being processed
  lastAnalyzed?: Date;
  overallSentiment?: {
    label: 'positive' | 'neutral' | 'negative' | 'ambivalent';
    score: number;
    emotionalTone?: string;
    confidence: number;
  };
  allTopics?: string[];
  qualityScore?: number;
  topics?: any[];
  sentiment?: any;
  discourse?: any;
  quotes?: any;
  fullTextPreserved?: boolean;
}

export interface ResponseWithMetadata {
  _id: string;
  formId: string;
  respondentEmail?: string;
  answers: any[];
  submittedAt: Date;
  metadata: ResponseMetadata;
}
