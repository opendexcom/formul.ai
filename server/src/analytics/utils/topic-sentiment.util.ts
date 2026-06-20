export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'ambivalent';

export interface TopicSentimentEntry {
  topic: string;
  label: SentimentLabel;
  score: number;
}

export interface TopicDetailWithSentiment {
  topic: string;
  sentiment?: string;
  score?: number;
  isPrimary?: boolean;
}

export function normalizeSentimentLabel(
  value?: string,
): SentimentLabel {
  const label = (value || 'neutral').toLowerCase();
  if (label === 'positive') return 'positive';
  if (label === 'negative') return 'negative';
  if (label === 'ambivalent') return 'ambivalent';
  return 'neutral';
}

export function defaultScoreForLabel(label: SentimentLabel): number {
  switch (label) {
    case 'positive':
      return 0.6;
    case 'negative':
      return -0.6;
    case 'ambivalent':
      return 0;
    default:
      return 0;
  }
}

/** Build per-canonical-topic sentiment for one response after clustering. */
export function buildCanonicalTopicSentiments(
  topicDetails: TopicDetailWithSentiment[] | undefined,
  canonicalTopics: string[],
  topicMapping: Record<string, string>,
  overallFallback?: { label?: string; score?: number },
): TopicSentimentEntry[] {
  if (!canonicalTopics.length) return [];

  const canonicalSet = new Set(canonicalTopics);
  const buckets = new Map<
    string,
    { scores: number[]; labels: SentimentLabel[] }
  >();

  for (const detail of topicDetails || []) {
    const raw = detail.topic?.trim();
    if (!raw) continue;

    const canonical =
      topicMapping[raw.trim().toLowerCase()] || raw.trim();

    if (!canonicalSet.has(canonical)) continue;

    const label = normalizeSentimentLabel(detail.sentiment);
    const score =
      typeof detail.score === 'number' && !Number.isNaN(detail.score)
        ? detail.score
        : defaultScoreForLabel(label);

    if (!buckets.has(canonical)) {
      buckets.set(canonical, { scores: [], labels: [] });
    }
    const bucket = buckets.get(canonical)!;
    bucket.scores.push(score);
    bucket.labels.push(label);
  }

  const fallbackLabel = normalizeSentimentLabel(overallFallback?.label);
  const fallbackScore =
    typeof overallFallback?.score === 'number'
      ? overallFallback.score
      : defaultScoreForLabel(fallbackLabel);

  return canonicalTopics.map((topic) => {
    const bucket = buckets.get(topic);
    if (!bucket || bucket.scores.length === 0) {
      return { topic, label: fallbackLabel, score: fallbackScore };
    }

    const score =
      Math.round(
        (bucket.scores.reduce((sum, s) => sum + s, 0) / bucket.scores.length) *
          100,
      ) / 100;

    const labelCounts = { positive: 0, neutral: 0, negative: 0, ambivalent: 0 };
    for (const label of bucket.labels) {
      labelCounts[label]++;
    }

    let label: SentimentLabel = 'neutral';
    if (
      labelCounts.positive >= labelCounts.negative &&
      labelCounts.positive >= labelCounts.neutral
    ) {
      label = 'positive';
    } else if (labelCounts.negative >= labelCounts.neutral) {
      label = 'negative';
    } else if (labelCounts.ambivalent > 0 && labelCounts.neutral === 0) {
      label = 'ambivalent';
    }

    return { topic, label, score };
  });
}
