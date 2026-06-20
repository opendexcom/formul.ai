import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Response, ResponseDocument } from '../../schemas/response.schema';
import { formatTopicSentimentCorrelation } from '../calculators/correlation.calculator';
import {
  filterDiscoveredTopics,
  isQuestionEchoTopic,
} from './topic-question-filter.util';

const TREND_SAMPLE_SIZE = parseInt(
  process.env.ANALYTICS_TREND_SAMPLE_SIZE ?? '2000',
  10,
);
const CLOSED_QUESTION_SAMPLE_SIZE = parseInt(
  process.env.ANALYTICS_CLOSED_QUESTION_SAMPLE_SIZE ?? '5000',
  10,
);
const QUOTE_FETCH_LIMIT = parseInt(
  process.env.ANALYTICS_QUOTE_FETCH_LIMIT ?? '100',
  10,
);

@Injectable()
export class AnalyticsAggregationService {
  constructor(
    @InjectModel(Response.name)
    private readonly responseModel: Model<ResponseDocument>,
  ) {}

  private formMatch(formId: string) {
    return {
      formId: new Types.ObjectId(formId),
      'metadata.processedForAnalytics': true,
    };
  }

  async countProcessedResponses(formId: string): Promise<number> {
    return this.responseModel.countDocuments(this.formMatch(formId)).exec();
  }

  async aggregateTopicFrequencies(
    formId: string,
    questionFocusPhrases: string[] = [],
  ): Promise<
    Record<
      string,
      {
        count: number;
        percentage: number;
        associatedQuestions: string[];
        sentimentBreakdown: {
          positive: number;
          neutral: number;
          negative: number;
        };
      }
    >
  > {
    const totalResponses = await this.countProcessedResponses(formId);
    if (totalResponses === 0) return {};

    const rows = await this.responseModel
      .aggregate<{
        _id: string;
        count: number;
        positive: number;
        neutral: number;
        negative: number;
      }>([
        { $match: this.formMatch(formId) },
        {
          $project: {
            topics: {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $ifNull: ['$metadata.canonicalTopics', []],
                      },
                    },
                    0,
                  ],
                },
                '$metadata.canonicalTopics',
                {
                  $cond: [
                    {
                      $gt: [
                        {
                          $size: {
                            $ifNull: ['$metadata.discoveredTopics', []],
                          },
                        },
                        0,
                      ],
                    },
                    '$metadata.discoveredTopics',
                    { $ifNull: ['$metadata.allTopics', []] },
                  ],
                },
              ],
            },
            sentiment: '$metadata.overallSentiment.label',
          },
        },
        { $unwind: '$topics' },
        {
          $group: {
            _id: '$topics',
            count: { $sum: 1 },
            positive: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] },
            },
            neutral: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'neutral'] }, 1, 0] },
            },
            negative: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] },
            },
          },
        },
      ])
      .exec();

    const frequency: Record<
      string,
      {
        count: number;
        percentage: number;
        associatedQuestions: string[];
        sentimentBreakdown: {
          positive: number;
          neutral: number;
          negative: number;
        };
      }
    > = {};

    for (const row of rows) {
      if (
        questionFocusPhrases.length > 0 &&
        isQuestionEchoTopic(row._id, questionFocusPhrases)
      ) {
        continue;
      }

      frequency[row._id] = {
        count: row.count,
        percentage: Math.round((row.count / totalResponses) * 100),
        associatedQuestions: [],
        sentimentBreakdown: {
          positive: row.positive,
          neutral: row.neutral,
          negative: row.negative,
        },
      };
    }

    return frequency;
  }

  async aggregateSentimentDistribution(formId: string): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    averageScore: number;
  }> {
    const totalResponses = await this.countProcessedResponses(formId);
    if (totalResponses === 0) {
      return { positive: 0, neutral: 0, negative: 0, averageScore: 0 };
    }

    const [row] = await this.responseModel
      .aggregate<{
        positive: number;
        neutral: number;
        negative: number;
        totalScore: number;
        scoreCount: number;
      }>([
        { $match: this.formMatch(formId) },
        {
          $group: {
            _id: null,
            positive: {
              $sum: {
                $cond: [
                  {
                    $eq: ['$metadata.overallSentiment.label', 'positive'],
                  },
                  1,
                  0,
                ],
              },
            },
            neutral: {
              $sum: {
                $cond: [
                  {
                    $eq: ['$metadata.overallSentiment.label', 'neutral'],
                  },
                  1,
                  0,
                ],
              },
            },
            negative: {
              $sum: {
                $cond: [
                  {
                    $eq: ['$metadata.overallSentiment.label', 'negative'],
                  },
                  1,
                  0,
                ],
              },
            },
            totalScore: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      { $type: '$metadata.overallSentiment.score' },
                      'double',
                    ],
                  },
                  '$metadata.overallSentiment.score',
                  {
                    $cond: [
                      {
                        $eq: [
                          { $type: '$metadata.overallSentiment.score' },
                          'int',
                        ],
                      },
                      '$metadata.overallSentiment.score',
                      0,
                    ],
                  },
                ],
              },
            },
            scoreCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      { $type: '$metadata.overallSentiment.score' },
                      ['double', 'int', 'long', 'decimal'],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();

    if (!row) {
      return { positive: 0, neutral: 0, negative: 0, averageScore: 0 };
    }

    return {
      positive: Math.round((row.positive / totalResponses) * 100),
      neutral: Math.round((row.neutral / totalResponses) * 100),
      negative: Math.round((row.negative / totalResponses) * 100),
      averageScore:
        row.scoreCount > 0 ? row.totalScore / row.scoreCount : 0,
    };
  }

  async aggregateEmotionalTones(
    formId: string,
    limit = 5,
  ): Promise<Array<{ tone: string; percentage: number }>> {
    const rows = await this.responseModel
      .aggregate<{ _id: string; count: number }>([
        { $match: this.formMatch(formId) },
        {
          $match: {
            'metadata.overallSentiment.emotionalTone': {
              $exists: true,
              $type: 'string',
              $ne: '',
            },
          },
        },
        {
          $group: {
            _id: '$metadata.overallSentiment.emotionalTone',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .exec();

    const totalTones = rows.reduce((sum, row) => sum + row.count, 0);
    if (totalTones === 0) return [];

    return rows.map((row) => ({
      tone: row._id,
      percentage: Math.round((row.count / totalTones) * 100),
    }));
  }

  async aggregateCanonicalTopics(formId: string): Promise<string[]> {
    return this.responseModel.distinct('metadata.canonicalTopics', {
      ...this.formMatch(formId),
      'metadata.canonicalTopics.0': { $exists: true },
    });
  }

  /** Merge per-response raw→canonical mappings for cross-label UI filtering. */
  async aggregateTopicMapping(formId: string): Promise<Record<string, string>> {
    const merged: Record<string, string> = {};
    const rows = await this.responseModel
      .find({
        ...this.formMatch(formId),
        'metadata.topicMapping': { $exists: true, $ne: {} },
      })
      .select('metadata.topicMapping')
      .lean()
      .exec();

    for (const row of rows) {
      const mapping = (row as { metadata?: { topicMapping?: Record<string, string> } })
        .metadata?.topicMapping;
      if (!mapping) continue;
      for (const [raw, canonical] of Object.entries(mapping)) {
        if (typeof canonical === 'string' && raw.trim()) {
          merged[raw.trim().toLowerCase()] = canonical;
        }
      }
    }

    return merged;
  }

  async streamTopicCooccurrence(
    formId: string,
    limit = 20,
  ): Promise<
    Array<{
      topic1: string;
      topic2: string;
      frequency: number;
      relationship: string;
      uniqueResponses: number;
    }>
  > {
    const cooccurrenceMap = new Map<string, number>();
    const topicPairCounts = new Map<string, Set<string>>();

    const cursor = this.responseModel
      .find(this.formMatch(formId))
      .select(
        'metadata.discoveredTopics metadata.canonicalTopics metadata.allTopics metadata.quotes metadata.topicMapping',
      )
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const metadata = (doc as any).metadata;
      const primaryTopics =
        metadata?.discoveredTopics?.length > 0
          ? metadata.discoveredTopics
          : metadata?.canonicalTopics?.length > 0
            ? metadata.canonicalTopics
            : metadata?.allTopics || [];
      const topics = this.collectTopicsForCooccurrence({
        ...metadata,
        canonicalTopics: primaryTopics,
      });
      if (topics.length < 2) continue;

      for (let i = 0; i < topics.length; i++) {
        for (let j = i + 1; j < topics.length; j++) {
          const topic1 = topics[i];
          const topic2 = topics[j];
          const key = [topic1, topic2].sort().join('|||');
          cooccurrenceMap.set(key, (cooccurrenceMap.get(key) || 0) + 1);

          if (!topicPairCounts.has(key)) {
            topicPairCounts.set(key, new Set());
          }
          topicPairCounts.get(key)!.add(String((doc as any)._id));
        }
      }
    }

    return Array.from(cooccurrenceMap.entries())
      .map(([key, frequency]) => {
        const [topic1, topic2] = key.split('|||');
        const uniqueResponses = topicPairCounts.get(key)?.size || 0;
        let relationship = 'weak';
        if (frequency >= 5) relationship = 'strong';
        else if (frequency >= 3) relationship = 'moderate';

        return { topic1, topic2, frequency, relationship, uniqueResponses };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  async aggregateTopicSentimentCorrelation(
    formId: string,
    limit = 15,
    questionFocusPhrases: string[] = [],
  ): Promise<
    Array<{
      topic: string;
      sentiment: { positive: number; neutral: number; negative: number };
      averageScore: number;
      dominantSentiment: string;
      responseCount: number;
    }>
  > {
    const topicSpecificCount = await this.responseModel
      .countDocuments({
        ...this.formMatch(formId),
        'metadata.canonicalTopicSentiments.0': { $exists: true },
      })
      .exec();

    const rows =
      topicSpecificCount > 0
        ? await this.aggregateTopicSentimentFromTopicSpecific(formId, limit)
        : await this.aggregateTopicSentimentFromOverall(formId, limit);

    return rows
      .map((row) =>
        formatTopicSentimentCorrelation(
          row._id,
          {
            positive: row.positive,
            neutral: row.neutral,
            negative: row.negative,
          },
          row.scoreCount > 0 ? row.totalScore / row.scoreCount : 0,
        ),
      )
      .filter(
        (row) =>
          questionFocusPhrases.length === 0 ||
          !isQuestionEchoTopic(row.topic, questionFocusPhrases),
      )
      .sort((a, b) => b.responseCount - a.responseCount);
  }

  private async aggregateTopicSentimentFromTopicSpecific(
    formId: string,
    limit: number,
  ) {
    return this.responseModel
      .aggregate<{
        _id: string;
        positive: number;
        neutral: number;
        negative: number;
        totalScore: number;
        scoreCount: number;
      }>([
        { $match: this.formMatch(formId) },
        { $unwind: '$metadata.canonicalTopicSentiments' },
        {
          $group: {
            _id: '$metadata.canonicalTopicSentiments.topic',
            positive: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      '$metadata.canonicalTopicSentiments.label',
                      'positive',
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            neutral: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$metadata.canonicalTopicSentiments.label',
                      ['neutral', 'ambivalent'],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            negative: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      '$metadata.canonicalTopicSentiments.label',
                      'negative',
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalScore: { $sum: '$metadata.canonicalTopicSentiments.score' },
            scoreCount: { $sum: 1 },
          },
        },
        { $sort: { positive: -1, neutral: -1, negative: -1 } },
        { $limit: limit },
      ])
      .exec();
  }

  private async aggregateTopicSentimentFromOverall(
    formId: string,
    limit: number,
  ) {
    return this.responseModel
      .aggregate<{
        _id: string;
        positive: number;
        neutral: number;
        negative: number;
        totalScore: number;
        scoreCount: number;
      }>([
        { $match: this.formMatch(formId) },
        {
          $project: {
            topics: {
              $cond: [
                {
                  $gt: [
                    { $size: { $ifNull: ['$metadata.discoveredTopics', []] } },
                    0,
                  ],
                },
                '$metadata.discoveredTopics',
                { $ifNull: ['$metadata.canonicalTopics', []] },
              ],
            },
            sentiment: '$metadata.overallSentiment.label',
            score: '$metadata.overallSentiment.score',
          },
        },
        { $unwind: '$topics' },
        {
          $group: {
            _id: '$topics',
            positive: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] },
            },
            neutral: {
              $sum: {
                $cond: [
                  { $in: ['$sentiment', ['neutral', 'ambivalent']] },
                  1,
                  0,
                ],
              },
            },
            negative: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] },
            },
            totalScore: {
              $sum: {
                $cond: [
                  {
                    $in: [{ $type: '$score' }, ['double', 'int', 'long', 'decimal']],
                  },
                  '$score',
                  0,
                ],
              },
            },
            scoreCount: {
              $sum: {
                $cond: [
                  {
                    $in: [{ $type: '$score' }, ['double', 'int', 'long', 'decimal']],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { positive: -1, neutral: -1, negative: -1 } },
        { $limit: limit },
      ])
      .exec();
  }

  async fetchRepresentativeQuoteDocs(
    formId: string,
    limit = QUOTE_FETCH_LIMIT,
  ): Promise<
    Array<{
      _id: Types.ObjectId;
      submittedAt?: Date;
      metadata?: ResponseDocument['metadata'];
    }>
  > {
    return this.responseModel
      .find({
        ...this.formMatch(formId),
        'metadata.quotes.keyQuotes.0': { $exists: true },
      })
      .select('metadata.quotes metadata.overallSentiment submittedAt')
      .sort({ submittedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async fetchTrendSample(formId: string): Promise<ResponseDocument[]> {
    const total = await this.countProcessedResponses(formId);
    if (total <= TREND_SAMPLE_SIZE) {
      const docs = await this.responseModel
        .find(this.formMatch(formId))
        .select('submittedAt metadata.canonicalTopics metadata.overallSentiment')
        .sort({ submittedAt: 1 })
        .lean()
        .exec();
      return docs as unknown as ResponseDocument[];
    }

    const sampled = await this.responseModel
      .aggregate([
        { $match: this.formMatch(formId) },
        { $sample: { size: TREND_SAMPLE_SIZE } },
        {
          $project: {
            submittedAt: 1,
            'metadata.canonicalTopics': 1,
            'metadata.overallSentiment': 1,
          },
        },
      ])
      .exec();

    return sampled as ResponseDocument[];
  }

  async fetchClosedQuestionSample(formId: string): Promise<ResponseDocument[]> {
    const total = await this.countProcessedResponses(formId);
    if (total <= CLOSED_QUESTION_SAMPLE_SIZE) {
      const docs = await this.responseModel
        .find(this.formMatch(formId))
        .select('answers metadata.canonicalTopics')
        .lean()
        .exec();
      return docs as unknown as ResponseDocument[];
    }

    const sampled = await this.responseModel
      .aggregate([
        { $match: this.formMatch(formId) },
        { $sample: { size: CLOSED_QUESTION_SAMPLE_SIZE } },
        {
          $project: {
            answers: 1,
            'metadata.canonicalTopics': 1,
          },
        },
      ])
      .exec();

    return sampled as ResponseDocument[];
  }

  async aggregateDataQualitySummary(formId: string): Promise<{
    totalResponses: number;
    avgCompleteness: number;
    qualityCount: number;
  }> {
    const [row] = await this.responseModel
      .aggregate<{
        totalResponses: number;
        avgCompleteness: number;
        qualityCount: number;
      }>([
        { $match: this.formMatch(formId) },
        {
          $group: {
            _id: null,
            totalResponses: { $sum: 1 },
            avgCompleteness: {
              $avg: '$metadata.quotes.responseQuality.completeness',
            },
            qualityCount: {
              $sum: {
                $cond: [
                  {
                    $ifNull: [
                      '$metadata.quotes.responseQuality.completeness',
                      false,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();

    return (
      row ?? { totalResponses: 0, avgCompleteness: 0.5, qualityCount: 0 }
    );
  }

  async fetchEmergingThemesSample(
    formId: string,
  ): Promise<ResponseDocument[]> {
    const total = await this.countProcessedResponses(formId);
    const sampleSize = Math.min(Math.max(200, Math.ceil(Math.sqrt(total) * 10)), 2000);

    if (total <= sampleSize) {
      const docs = await this.responseModel
        .find(this.formMatch(formId))
        .select(
          'metadata.canonicalTopics metadata.allTopics metadata.quotes submittedAt',
        )
        .sort({ submittedAt: 1 })
        .lean()
        .exec();
      return docs as unknown as ResponseDocument[];
    }

    const sampled = await this.responseModel
      .aggregate([
        { $match: this.formMatch(formId) },
        { $sample: { size: sampleSize } },
        {
          $project: {
            submittedAt: 1,
            'metadata.canonicalTopics': 1,
            'metadata.allTopics': 1,
            'metadata.quotes': 1,
          },
        },
      ])
      .exec();

    return sampled.sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
    ) as ResponseDocument[];
  }

  /** Topics used for within-response co-occurrence (canonical + mapped quote themes). */
  private collectTopicsForCooccurrence(
    metadata?: ResponseDocument['metadata'],
  ): string[] {
    const topics = new Set<string>();
    const mapping = (metadata?.topicMapping || {}) as Record<string, string>;

    const toCanonical = (topic: string): string => {
      const trimmed = topic.trim();
      if (!trimmed) return '';
      return mapping[trimmed.toLowerCase()] || trimmed;
    };

    const primary = metadata?.canonicalTopics?.length
      ? metadata.canonicalTopics
      : (metadata?.allTopics || []).map(toCanonical).filter(Boolean);

    for (const topic of primary) {
      if (typeof topic === 'string' && topic.trim()) {
        topics.add(toCanonical(topic));
      }
    }

    for (const quote of metadata?.quotes?.keyQuotes || []) {
      for (const theme of quote.relatedTopics || []) {
        if (typeof theme === 'string' && theme.trim()) {
          topics.add(toCanonical(theme));
        }
      }
    }

    return Array.from(topics).filter(Boolean);
  }
}
