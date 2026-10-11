export type VariantKey = 'main' | 'A' | 'B';

export type ResearchDesignType = 'standard_ab' | 'split_questionnaire';

export interface SplitQuestionnaireVariantDesign {
  modifiedQuestionIds: string[];
  excludedQuestionIds: string[];
  polarityFlippedQuestionIds: string[];
  /** variantQuestionId → originalQuestionId on source variant (usually main) */
  polarityPairs?: Record<string, string>;
}

export interface SplitQuestionnaireDesign {
  coreQuestionIds: string[];
  perVariant: Partial<Record<VariantKey, SplitQuestionnaireVariantDesign>>;
}

export interface QuestionTitleRef {
  questionId: string;
  title: string;
  reverseCoded?: boolean;
}

export type ComparativeReportStatus = 'idle' | 'generating' | 'complete' | 'error';

export type HypothesisVerdict =
  | 'supported'
  | 'partially_supported'
  | 'inconclusive'
  | 'not_supported';

export type CrossVariantInsightType = 'difference' | 'similarity' | 'unexpected';

export interface Citation {
  responseId: string;
  variantKey: string;
  formId: string;
  quote: string;
  questionId?: string;
  submittedAt?: string;
}

export interface QuestionFieldChange {
  questionId: string;
  field: string;
  before: string;
  after: string;
}

export interface VariantQuestionDiff {
  addedQuestionIds: string[];
  removedQuestionIds: string[];
  changedQuestions: QuestionFieldChange[];
}

export interface QuestionDiffResult {
  sharedQuestionIds: string[];
  perVariant: Partial<Record<VariantKey, VariantQuestionDiff>>;
  designInterpretation: string;
  polarityChanges?: QuestionFieldChange[];
  questionTitles?: QuestionTitleRef[];
}

export interface VariantContextSnapshot {
  key: VariantKey;
  formId: string;
  targetGroupName?: string;
  internalDescription?: string;
  responseCount: number;
  analyticsGeneratedAt?: string;
}

export interface VariantInsight {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
}

export interface VariantMetricsSnapshot {
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
    averageScore?: number;
  };
  topTopics?: string[];
  climate?: {
    positivityScore?: number;
    dominantTendency?: string;
  };
}

export interface VariantSection {
  key: VariantKey;
  formId: string;
  summary: string;
  insights: VariantInsight[];
  metricsSnapshot: VariantMetricsSnapshot;
}

export interface CrossVariantInsight {
  text: string;
  type: CrossVariantInsightType;
  relatedVariants: string[];
  citations: Citation[];
}

export interface HypothesisEvaluation {
  hypothesis: string;
  verdict: HypothesisVerdict;
  reasoning: string;
  citations: Citation[];
}

export interface CrossVariantCorrelation {
  description: string;
  metric: string;
  variants: string[];
  strength?: number;
  citations: Citation[];
}

export interface ComparativeReportMethodology {
  comparableQuestionIds: string[];
  topicAlignmentNotes?: string;
  limitations?: string[];
}

export interface ClosedQuestionComparison {
  questionId: string;
  questionTitle: string;
  perVariant: Array<{
    key: VariantKey;
    distribution: Record<string, number>;
    reverseCoded?: boolean;
  }>;
  normalizedForComparison?: boolean;
  reverseCodedVariants?: VariantKey[];
}

export interface AlignedTopicGroup {
  unifiedLabel: string;
  perVariant: Array<{
    key: VariantKey;
    originalTopic: string;
    frequency: number;
  }>;
}

export interface ComparativeReport {
  generatedAt: Date;
  status: ComparativeReportStatus;
  error?: string;
  cacheVersion: 1;
  questionDiff: QuestionDiffResult;
  variantContext: VariantContextSnapshot[];
  executiveSummary: string;
  variantSections: VariantSection[];
  crossVariantInsights: CrossVariantInsight[];
  hypothesisEvaluation: HypothesisEvaluation[];
  correlations: CrossVariantCorrelation[];
  methodology?: ComparativeReportMethodology;
  splitQuestionnaireDesign?: SplitQuestionnaireDesign;
  closedQuestionComparison?: ClosedQuestionComparison[];
}

export interface ComparativeReportReadiness {
  ready: boolean;
  variantCount: number;
  requiresMultipleVariants: boolean;
  variants: Array<{
    key: VariantKey;
    formId: string;
    hasAnalytics: boolean;
    responseCount: number;
    analyticsGeneratedAt?: string;
  }>;
}

export interface PaginatedProjectResponses {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
