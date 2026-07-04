import { normalizeTopicKey } from './topic-vector-cluster.util';

/** Title-case label with collapsed whitespace for display and aggregation. */
export function normalizeCanonicalTopicLabel(topic: string): string {
  return topic
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Map raw topic strings to a stable lowercase-key → canonical-label mapping. */
export function buildDeterministicTopicMapping(
  rawTopics: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const keyToLabel = new Map<string, string>();

  for (const raw of rawTopics) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const key = normalizeTopicKey(raw);
    const label = normalizeCanonicalTopicLabel(raw);
    if (!keyToLabel.has(key)) {
      keyToLabel.set(key, label);
    }
    mapping[key] = keyToLabel.get(key)!;
  }

  return mapping;
}
