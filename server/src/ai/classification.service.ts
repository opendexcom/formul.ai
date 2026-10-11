import { Injectable, Logger } from '@nestjs/common';
import {
  JEV_DEFAULT_MODEL,
  resolveLlmTaskConfig,
  shouldSplitCombinedAnalysis,
  usesJevDecisions,
} from './llm-provider.config';
import {
  invokeJevDecisions,
  jevChoice,
  jevConfidence,
  jevScore01,
  type JevQuestion,
} from './jev-decisions.client';
import type { LlmUsage } from './llm.types';

export const SENTIMENT_LABELS = [
  'positive',
  'neutral',
  'negative',
  'ambivalent',
] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export const EMOTIONAL_TONES = [
  'satisfied',
  'frustrated',
  'mixed',
  'indifferent',
  'hopeful',
  'concerned',
  'grateful',
  'disappointed',
] as const;

const QUALITY_LEVELS = [
  'very low',
  'low',
  'moderate',
  'high',
  'very high',
] as const;

const SENTIMENT_CRITERIA: Record<SentimentLabel, string> = {
  positive: 'The respondent is pleased, approving, or optimistic about this.',
  neutral: 'The respondent is factual, mixed-to-flat, or does not take a side.',
  negative: 'The respondent is unhappy, critical, or dissatisfied.',
  ambivalent: 'The respondent expresses both clearly positive and negative feelings.',
};

const TONE_CRITERIA: Record<(typeof EMOTIONAL_TONES)[number], string> = {
  satisfied: 'Content or pleased overall.',
  frustrated: 'Annoyed or blocked by a problem.',
  mixed: 'Both positive and negative feelings.',
  indifferent: 'Little emotion or investment.',
  hopeful: 'Optimistic about improvement or the future.',
  concerned: 'Worried or cautious.',
  grateful: 'Thankful or appreciative.',
  disappointed: 'Let down relative to expectations.',
};

export interface ClassificationTopicInput {
  topic: string;
}

export interface ClassificationResponseInput {
  responseId: string;
  answersText: string;
  topics: ClassificationTopicInput[];
}

export interface ClassifiedTopicSentiment {
  topic: string;
  sentiment: SentimentLabel;
  score: number;
}

export interface ClassifiedResponse {
  responseId: string;
  overallSentiment: {
    sentiment: SentimentLabel;
    score: number;
    emotionalTone: string;
    confidence: number;
    reasoning: string;
  };
  topicSentiments: ClassifiedTopicSentiment[];
  responseQuality: {
    completeness: number;
    depth: number;
    clarity: number;
  };
}

export interface ClassifyChunkResult {
  results: ClassifiedResponse[];
  usage: LlmUsage[];
}

function sentimentScore(label: SentimentLabel, confidence: number): number {
  const base: Record<SentimentLabel, number> = {
    positive: 0.65,
    negative: -0.65,
    neutral: 0,
    ambivalent: 0,
  };
  return Math.round(base[label] * Math.max(confidence, 0.45) * 100) / 100;
}

function asSentiment(value: string | undefined): SentimentLabel {
  if (value && (SENTIMENT_LABELS as readonly string[]).includes(value)) {
    return value as SentimentLabel;
  }
  return 'neutral';
}

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  isJevEnabled(): boolean {
    return usesJevDecisions('classification');
  }

  shouldSplitCombinedAnalysis(): boolean {
    return shouldSplitCombinedAnalysis();
  }

  async classifyResponses(
    responses: ClassificationResponseInput[],
    options: { sessionId?: string } = {},
  ): Promise<ClassifyChunkResult> {
    const usage: LlmUsage[] = [];
    const results: ClassifiedResponse[] = [];
    for (const response of responses) {
      const classified = await this.classifyOne(response, options.sessionId);
      results.push(classified.result);
      if (classified.usage) usage.push(classified.usage);
    }
    return { results, usage };
  }

  async labelCluster(
    clusterTopics: string[],
    options: { sessionId?: string } = {},
  ): Promise<{ label: string | null; usage?: LlmUsage }> {
    const unique = [
      ...new Set(clusterTopics.map((t) => t.trim()).filter(Boolean)),
    ];
    if (unique.length === 0) {
      return { label: null };
    }
    if (unique.length === 1) {
      return { label: unique[0] };
    }
    if (!this.isJevEnabled()) {
      return { label: null };
    }

    const config = resolveLlmTaskConfig('classification');
    const criteria: Record<string, string> = {};
    const keyToLabel = new Map<string, string>();
    unique.forEach((label, index) => {
      const key = `opt_${index}`;
      criteria[key] = label;
      keyToLabel.set(key, label);
    });

    const result = await invokeJevDecisions({
      apiKey: config.apiKey!,
      model: config.models.classification || JEV_DEFAULT_MODEL,
      state: { clusterMembers: unique },
      questions: {
        canonical: {
          type: 'choice',
          instructions:
            'Pick the single clearest canonical label from these already-grouped topic phrases. Prefer the most specific shared meaning.',
          criteria,
        },
      },
      sessionId: options.sessionId,
      referer: config.httpReferer,
      title: config.appTitle,
    });

    const choice = jevChoice(result.answers, 'canonical');
    const label = (choice && keyToLabel.get(choice)) || choice || null;
    return { label, usage: result.usage };
  }

  private async classifyOne(
    response: ClassificationResponseInput,
    sessionId?: string,
  ): Promise<{ result: ClassifiedResponse; usage?: LlmUsage }> {
    const config = resolveLlmTaskConfig('classification');
    const questions: Record<string, JevQuestion> = {
      sentiment: {
        type: 'choice',
        instructions:
          'Overall sentiment of this survey response across all answers.',
        criteria: SENTIMENT_CRITERIA,
      },
      tone: {
        type: 'choice',
        instructions: 'Dominant emotional tone of the respondent.',
        criteria: TONE_CRITERIA,
      },
      completeness: {
        type: 'score',
        instructions: 'How completely does the response answer the questions?',
        criteria: [...QUALITY_LEVELS],
      },
      depth: {
        type: 'score',
        instructions: 'How much substance and detail does the response have?',
        criteria: [...QUALITY_LEVELS],
      },
      clarity: {
        type: 'score',
        instructions: 'How clear and coherent is the writing?',
        criteria: [...QUALITY_LEVELS],
      },
    };

    response.topics.forEach((topic, index) => {
      questions[`topic_${index}_sentiment`] = {
        type: 'choice',
        instructions: `Sentiment specifically about the topic "${topic.topic}" in this response (not overall mood).`,
        criteria: SENTIMENT_CRITERIA,
      };
    });

    const jev = await invokeJevDecisions({
      apiKey: config.apiKey!,
      model: config.models.classification || JEV_DEFAULT_MODEL,
      state: {
        responseId: response.responseId,
        answers: response.answersText,
        topics: response.topics.map((t) => t.topic),
      },
      questions,
      sessionId,
      referer: config.httpReferer,
      title: config.appTitle,
    });

    const sentiment = asSentiment(jevChoice(jev.answers, 'sentiment'));
    const confidence = jevConfidence(jev.answers, 'sentiment');
    const tone = jevChoice(jev.answers, 'tone') || 'mixed';
    const score = sentimentScore(sentiment, confidence);

    const topicSentiments = response.topics.map((topic, index) => {
      const label = asSentiment(
        jevChoice(jev.answers, `topic_${index}_sentiment`),
      );
      const topicConf = jevConfidence(jev.answers, `topic_${index}_sentiment`);
      return {
        topic: topic.topic,
        sentiment: label,
        score: sentimentScore(label, topicConf),
      };
    });

    return {
      result: {
        responseId: response.responseId,
        overallSentiment: {
          sentiment,
          score,
          emotionalTone: tone,
          confidence,
          reasoning: `Classified as ${sentiment} (confidence ${confidence.toFixed(2)}).`,
        },
        topicSentiments,
        responseQuality: {
          completeness: jevScore01(
            jev.answers,
            'completeness',
            QUALITY_LEVELS.length,
          ),
          depth: jevScore01(jev.answers, 'depth', QUALITY_LEVELS.length),
          clarity: jevScore01(jev.answers, 'clarity', QUALITY_LEVELS.length),
        },
      },
      usage: jev.usage,
    };
  }
}
