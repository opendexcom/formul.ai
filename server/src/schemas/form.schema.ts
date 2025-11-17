import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FormDocument = Form & Document;

export enum QuestionType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  MULTIPLE_CHOICE = 'multiple_choice',
  CHECKBOX = 'checkbox',
  DROPDOWN = 'dropdown',
  EMAIL = 'email',
  NUMBER = 'number',
  DATE = 'date',
  TIME = 'time',
  RATING = 'rating',
}

@Schema()
export class Question {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: QuestionType })
  type: QuestionType;

  @Prop({ default: false })
  required: boolean;

  @Prop({ type: [String] })
  options?: string[];

  @Prop()
  order: number;

  @Prop({ type: Object })
  validation?: Record<string, any>;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema({ timestamps: true })
export class Form {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true,
    validate: {
      validator: function(v: any) {
        return Types.ObjectId.isValid(v) && (typeof v === 'string' || v instanceof Types.ObjectId);
      },
      message: 'createdBy must be a valid ObjectId'
    }
  })
  createdBy: Types.ObjectId;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: String })
  analyticsLock?: string; // Task ID that currently has analytics lock

  @Prop({ type: Date })
  analyticsLockStartedAt?: Date; // When the analytics lock was acquired

  @Prop({ type: Object })
  settings: {
    allowMultipleResponses: boolean;
    requireLogin: boolean;
    showProgressBar: boolean;
    customTheme?: {
      primaryColor?: string;
      backgroundColor?: string;
      fontFamily?: string;
    };
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  // Analytics cache with all 7 gaps fixed
  @Prop({ type: Object })
  analytics?: {
    lastUpdated: Date;
    totalResponsesAnalyzed: number;
    cacheVersion: number;
    
    // Methodology metadata
    methodology?: {
      approach: string;
      stages: string[];
      samplingStrategy: string;
      sampleSize: number;
      dataQualityScore: number;
      limitationsNoted: string[];
    };
    
    // Topic Analysis (GAP 4: Enhanced topics)
    topics: {
      distribution: Record<string, { count: number; percentage: number; associatedQuestions: string[]; sentimentBreakdown: { positive: number; neutral: number; negative: number } }>;
      topTopics: string[];
      topicTrends?: Array<{ date: Date; topics: string[] }>;
      
      // GAP 4: Enhanced structure for Topics & Themes Card
      dominantThemes: Array<{
        theme: string;
        frequency: number;
        sentiment: { positive: number; neutral: number; negative: number };
        representativeQuotes: string[];
        relatedQuestions: string[];
      }>;
      
      emergingThemes: Array<{
        theme: string;
        frequency: number;
        trend: 'growing' | 'rare';
        sentiment: { positive: number; neutral: number; negative: number };
        representativeQuotes: string[];
      }>;
      
      counterNarratives: Array<{
        narrative: string;
        frequency: number;
        contrast: string;
      }>;
      
      saturation?: {
        saturated: boolean;
        reasoning: string;
        missingPerspectives: string[];
      };
      
      cooccurrence?: Array<{
        topic1: string;
        topic2: string;
        frequency: number;
        relationship: string;
      }>;
      
      discourseFrames?: Array<{
        frame: string;
        frequency: number;
        characteristics: string;
      }>;
    };
    
    // Sentiment Analysis (GAP 6 & 7: Emotional tones and dominant tags)
    sentiment: {
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
      
      // GAP 6: Emotional tone distribution for Overall Climate Card
      emotionalTones: Array<{
        tone: string;
        percentage: number;
        contexts?: string[];
      }>;
      
      // GAP 7: Dominant topic tags (top 3-5) for Overall Climate Card
      dominantTags: string[];
      
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
      
      // Topic-sentiment correlations (added for analytics)
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
    };
    
    // Overall Response Climate (for Overall Climate Card)
    climate?: {
      positivityScore: number;
      sentimentBreakdown: { positive: number; neutral: number; negative: number };
      dominantTendency: string;
      semanticAxis?: {
        left: string;
        right: string;
        position: number;
      };
    };
    
    // Enhanced Correlation Analysis (GAP 1 & 2)
    correlations: {
      // GAP 1: Question-centric index for O(1) lookup (CRITICAL for Question Explorer)
      byQuestion: Record<string, {
        questionTitle: string;
        correlatesTo: Array<{
          questionId: string;
          questionTitle: string;
          correlation: number;
          type: 'partial' | 'bivariate';
          controlledFor?: string[];
          significance: number;
          effectSize: 'small' | 'medium' | 'large';
          pattern?: Record<string, Record<string, number>>;
          insight: string;
        }>;
      }>;
      
      // Keep existing for backwards compatibility
      questionPairs: Array<{
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
      }>;
      
      topCorrelations: any[];
      
      // NEW: Correlations between closed questions and topics from open questions
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
    };
    
    // GAP 3: Aggregated quotes for What People Say cards
    quotes: {
      representative: Array<{
        text: string;
        responseId: string;
        submittedAt: Date;
        topics: string[];
        sentiment: string;
        emotionalTone: string;
        representativeness: 'typical';
        depth: 'superficial' | 'moderate' | 'deep';
      }>;
      highQuality: Array<{
        text: string;
        responseId: string;
        submittedAt: Date;
        topics: string[];
        sentiment: string;
        emotionalTone: string;
        representativeness: 'typical' | 'deviant' | 'mixed';
        depth: 'deep';
      }>;
      deviant: Array<{
        text: string;
        responseId: string;
        submittedAt: Date;
        topics: string[];
        sentiment: string;
        emotionalTone: string;
        representativeness: 'deviant';
        depth: 'superficial' | 'moderate' | 'deep';
      }>;
    };
    
    // GAP 5: Aggregated deviant cases for Deviant Perspectives Card
    deviantCases: Array<{
      text: string;
      responseId: string;
      submittedAt: Date;
      howDeviant: string;
      significance: string;
      topics: string[];
      sentiment: string;
      frequency: number;
    }>;
    
    // Narrative Insights (GAP 8: Enhanced with evidence, confidence, action metadata)
    insights: {
      summary: string;
      
      // GAP 8: Enhanced findings structure for Key Insights Card
      keyFindings: Array<{
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
      }>;
      
      // GAP 8: Enhanced recommendations structure for Key Insights Card
      recommendations: Array<{
        recommendation: string;
        priority: 'urgent' | 'important' | 'maintain';
        basedOn: string;
        suggestedAction: string;
        expectedImpact: string;
        confidence: 'high' | 'medium' | 'low';
        rationale?: string;
        requiredActions?: string[];
      }>;
      
      trends?: Array<{
        trend: string;
        direction: 'up' | 'down' | 'stable' | 'increasing' | 'decreasing' | 'cyclical';
        confidence: number;
        strength?: number;
        evidence?: string;
      }>;
      
      anomalies?: Array<{
        description: string;
        affectedQuestions: string[];
        context?: string;
        possibleExplanations?: string[];
        requiresInvestigation?: boolean;
      }>;
      
      deviantCases?: Array<{
        description: string;
        examples: string[];
        possibleExplanations: string[];
        theoreticalImportance: string;
      }>;
      
      minorityPerspectives?: Array<{
        perspective: string;
        representedBy: string[];
        contrast: string;
      }>;
      
      narrativeShifts?: Array<{
        from: string;
        to: string;
        timeframe: string;
        possibleReasons: string[];
      }>;
    };
    
    // Validation metadata
    validation?: {
      convergences: Array<{ where: string; on: string }>;
      divergences: Array<{ where: string; divergence: string; possibleReasons: string[] }>;
      overallConfidence: number;
      limitations: string[];
    };
    
    // Question Statistics (basic, no LLM)
    questionStats?: Record<string, {
      responseCount: number;
      completionRate: number;
      mostCommon: any;
      distribution: Record<string, number>;
    }>;
  };
}

export const FormSchema = SchemaFactory.createForClass(Form);