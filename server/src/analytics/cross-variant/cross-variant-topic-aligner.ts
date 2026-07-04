import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptBuilder } from '../utils/prompt.builder';
import { AlignedTopicGroup, VariantKey } from '../../projects/comparative-report.types';

export interface VariantTopicsInput {
  key: VariantKey;
  topTopics: string[];
  topicFrequencies: Record<string, number>;
}

@Injectable()
export class CrossVariantTopicAligner {
  constructor(
    private readonly aiService: AiService,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async alignTopics(variants: VariantTopicsInput[]): Promise<{
    groups: AlignedTopicGroup[];
    notes: string;
  }> {
    if (variants.length === 0) {
      return { groups: [], notes: 'No variants to align.' };
    }

    if (variants.length === 1) {
      const only = variants[0];
      return {
        groups: only.topTopics.map((topic) => ({
          unifiedLabel: topic,
          perVariant: [
            {
              key: only.key,
              originalTopic: topic,
              frequency: only.topicFrequencies[topic] ?? 0,
            },
          ],
        })),
        notes: 'Single variant; topics mapped directly.',
      };
    }

    try {
      const variables = this.promptBuilder.buildCrossVariantTopicAlignmentVariables(variants);
      const { content } = await this.aiService.invokeFlow(
        'analytics.cross_variant_topic_alignment',
        variables,
        { skipValidation: true, useJsonFormat: true },
      );
      const parsed = this.parseAlignmentResponse(content);
      if (parsed.groups.length > 0) {
        return parsed;
      }
    } catch (error) {
      console.warn('[CrossVariantTopicAligner] LLM alignment failed, using fallback:', error);
    }

    return this.fallbackAlignment(variants);
  }

  private parseAlignmentResponse(content: string): { groups: AlignedTopicGroup[]; notes: string } {
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as {
      groups?: AlignedTopicGroup[];
      notes?: string;
    };
    return {
      groups: parsed.groups ?? [],
      notes: parsed.notes ?? 'Topics aligned via LLM.',
    };
  }

  private fallbackAlignment(variants: VariantTopicsInput[]): {
    groups: AlignedTopicGroup[];
    notes: string;
  } {
    const labelToGroup = new Map<string, AlignedTopicGroup>();

    for (const variant of variants) {
      for (const topic of variant.topTopics) {
        const normalized = topic.trim().toLowerCase();
        const existing = [...labelToGroup.values()].find(
          (group) => group.unifiedLabel.trim().toLowerCase() === normalized,
        );
        const target =
          existing ??
          (() => {
            const group: AlignedTopicGroup = {
              unifiedLabel: topic,
              perVariant: [],
            };
            labelToGroup.set(topic, group);
            return group;
          })();

        target.perVariant.push({
          key: variant.key,
          originalTopic: topic,
          frequency: variant.topicFrequencies[topic] ?? 0,
        });
      }
    }

    return {
      groups: [...labelToGroup.values()],
      notes: 'Topics aligned via exact label matching fallback.',
    };
  }
}
