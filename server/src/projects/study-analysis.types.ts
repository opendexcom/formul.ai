import {
  Citation,
  ClosedQuestionComparison,
  HypothesisEvaluation,
  VariantKey,
} from './comparative-report.types';

export type StudyAnalysisStatus = 'idle' | 'generating' | 'complete' | 'error';

export interface StudyAnalysisVariantMetrics {
  key: VariantKey;
  responseCount: number;
  topTopics: string[];
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface StudyAnalysisCoreQuestionMetric {
  questionId: string;
  title: string;
  perVariant: Array<{
    key: VariantKey;
    distribution?: Record<string, number>;
    reverseCoded?: boolean;
  }>;
}

export interface StudyAnalysisBranchMetric {
  variantKey: VariantKey;
  exclusiveQuestionIds: string[];
  topTopics: string[];
  summary?: string;
}

export interface StudyAnalysisRolledUpMetrics {
  totalResponses: number;
  researchDesignType?: 'standard_ab' | 'split_questionnaire';
  variants: StudyAnalysisVariantMetrics[];
  dominantTopics: Array<{ topic: string; count: number }>;
  coreQuestionMetrics?: StudyAnalysisCoreQuestionMetric[];
  branchSpecificMetrics?: StudyAnalysisBranchMetric[];
}

export interface StudyAnalysisInsight {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  scope: 'core' | 'branch' | 'study';
  variantKey?: VariantKey;
  citations?: Citation[];
}

export interface StudyAnalysis {
  status: StudyAnalysisStatus;
  generatedAt: Date;
  cacheVersion: 1;
  executiveSummary: string;
  hypothesisEvaluation: HypothesisEvaluation[];
  studyInsights: StudyAnalysisInsight[];
  rolledUpMetrics: StudyAnalysisRolledUpMetrics;
  error?: string;
}

export interface StudyAnalysisReadiness {
  ready: boolean;
  message?: string;
  variants: Array<{
    key: VariantKey;
    formId: string;
    hasAnalytics: boolean;
    responseCount: number;
    analyticsGeneratedAt?: string;
  }>;
}

export interface StudyAnalysisResponse {
  projectId: string;
  readiness: StudyAnalysisReadiness;
  analytics: StudyAnalysis | null;
}
