import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsGenerator } from './recommendations.generator';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';

describe('RecommendationsGenerator', () => {
  let generator: RecommendationsGenerator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsGenerator,
        { provide: AiService, useValue: {} },
        { provide: PromptBuilder, useValue: {} },
      ],
    }).compile();

    generator = module.get<RecommendationsGenerator>(RecommendationsGenerator);
  });

  describe('generateRecommendations', () => {
    it('returns urgent recommendations for high negative topic sentiment', async () => {
      const topicSentiment = {
        Workload: { positive: 1, neutral: 0, negative: 4, total: 5 },
      };
      const sentimentDistribution = { positive: 20, neutral: 30, negative: 50 };
      const dataQuality = { overallScore: 0.7 };

      const result = await generator.generateRecommendations(
        sentimentDistribution,
        ['Workload'],
        dataQuality,
        undefined,
        topicSentiment,
      );

      const urgent = result.filter(r => r.priority === 'urgent');
      expect(urgent.length).toBeGreaterThan(0);
      expect(urgent.some(r => r.recommendation.includes('Workload'))).toBe(true);
    });

    it('returns maintain recommendation for positive topics', async () => {
      const topicSentiment = {
        Culture: { positive: 8, neutral: 1, negative: 1, total: 10 },
      };
      const sentimentDistribution = { positive: 50, neutral: 30, negative: 20 };
      const dataQuality = { overallScore: 0.8 };

      const result = await generator.generateRecommendations(
        sentimentDistribution,
        ['Culture'],
        dataQuality,
        undefined,
        topicSentiment,
      );

      const maintain = result.filter(r => r.priority === 'maintain');
      expect(maintain.some(r => r.recommendation.includes('Culture'))).toBe(true);
    });

    it('returns important recommendation when response quality is low', async () => {
      const dataQuality = { overallScore: 0.5 };
      const result = await generator.generateRecommendations(
        { positive: 40, neutral: 30, negative: 30 },
        [],
        dataQuality,
      );

      expect(result.some(r =>
        r.priority === 'important' && (
          r.recommendation.toLowerCase().includes('quality') ||
          r.recommendation.toLowerCase().includes('clarity')
        ),
      )).toBe(true);
    });
  });

  describe('prioritizeRecommendations', () => {
    it('sorts by urgent, important, maintain', () => {
      const recs = [
        { recommendation: 'M', priority: 'maintain' as const, basedOn: '', suggestedAction: '', expectedImpact: '', confidence: 'high' as const },
        { recommendation: 'U', priority: 'urgent' as const, basedOn: '', suggestedAction: '', expectedImpact: '', confidence: 'high' as const },
        { recommendation: 'I', priority: 'important' as const, basedOn: '', suggestedAction: '', expectedImpact: '', confidence: 'high' as const },
      ];
      const sorted = generator.prioritizeRecommendations(recs);

      expect(sorted[0].priority).toBe('urgent');
      expect(sorted[1].priority).toBe('important');
      expect(sorted[2].priority).toBe('maintain');
    });
  });

  describe('formatRecommendations', () => {
    it('formats list with priority and fields', () => {
      const recs = [
        {
          recommendation: 'Fix X',
          priority: 'urgent' as const,
          basedOn: 'data',
          suggestedAction: 'do Y',
          expectedImpact: 'better',
          confidence: 'high' as const,
        },
      ];
      const formatted = generator.formatRecommendations(recs);

      expect(formatted).toContain('[URGENT]');
      expect(formatted).toContain('Fix X');
      expect(formatted).toContain('Based on: data');
      expect(formatted).toContain('Action: do Y');
    });
  });
});
