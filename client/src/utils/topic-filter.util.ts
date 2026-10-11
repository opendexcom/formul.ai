/** Normalize topic labels for case-insensitive comparison. */
export function normalizeTopicLabel(topic: string): string {
  return topic.trim().toLowerCase();
}

/**
 * Expand user-selected topics (often raw/discovered labels from dominant themes)
 * to include canonical equivalents from aggregated topicMapping.
 */
export function expandSelectedTopics(
  selectedTopics: string[],
  topicMapping?: Record<string, string>,
): string[] {
  const expanded = new Set<string>();

  for (const topic of selectedTopics) {
    if (!topic?.trim()) continue;
    expanded.add(topic);
    expanded.add(normalizeTopicLabel(topic));

    if (!topicMapping) continue;

    const key = normalizeTopicLabel(topic);
    const canonical = topicMapping[key] ?? topicMapping[topic];
    if (canonical) {
      expanded.add(canonical);
      expanded.add(normalizeTopicLabel(canonical));
    }

    for (const [raw, canon] of Object.entries(topicMapping)) {
      if (
        normalizeTopicLabel(canon) === key ||
        normalizeTopicLabel(canon) === normalizeTopicLabel(topic)
      ) {
        expanded.add(raw);
        expanded.add(canon);
      }
    }
  }

  return [...expanded];
}

/** Map a raw/discovered label to its canonical form when mapping is available. */
export function canonicalizeTopicLabel(
  topic: string,
  topicMapping?: Record<string, string>,
): string {
  if (!topic?.trim()) return topic;
  if (!topicMapping) return topic;
  return topicMapping[normalizeTopicLabel(topic)] ?? topic;
}

/** Deduplicate topic labels after canonicalization (preserves first-seen order). */
export function normalizeTopicLabelList(
  topics: string[],
  topicMapping?: Record<string, string>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const topic of topics) {
    const canonical = canonicalizeTopicLabel(topic, topicMapping);
    const key = normalizeTopicLabel(canonical);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(canonical);
  }
  return result;
}

export interface NormalizableTheme {
  theme: string;
  frequency: number;
  representativeQuotes?: string[];
  relatedQuestions?: string[];
}

/** Merge themes that map to the same canonical label (sums frequency). */
export function normalizeThemes<T extends NormalizableTheme>(
  themes: T[],
  topicMapping?: Record<string, string>,
): T[] {
  const merged = new Map<string, T>();

  for (const theme of themes) {
    const canonical = canonicalizeTopicLabel(theme.theme, topicMapping);
    const existing = merged.get(normalizeTopicLabel(canonical));

    if (!existing) {
      merged.set(normalizeTopicLabel(canonical), { ...theme, theme: canonical });
      continue;
    }

    merged.set(normalizeTopicLabel(canonical), {
      ...existing,
      theme: canonical,
      frequency: existing.frequency + theme.frequency,
      representativeQuotes: [
        ...new Set([
          ...(existing.representativeQuotes ?? []),
          ...(theme.representativeQuotes ?? []),
        ]),
      ].slice(0, 3),
      relatedQuestions: [
        ...new Set([
          ...(existing.relatedQuestions ?? []),
          ...(theme.relatedQuestions ?? []),
        ]),
      ],
    });
  }

  return [...merged.values()].sort((a, b) => b.frequency - a.frequency);
}

/** True when candidate matches any expanded selected topic (case-insensitive). */
export function topicMatchesFilter(
  candidateTopic: string,
  expandedTopics: string[],
): boolean {
  if (expandedTopics.length === 0) return true;
  const candidate = normalizeTopicLabel(candidateTopic);
  return expandedTopics.some((t) => normalizeTopicLabel(t) === candidate);
}

/** True when any of the candidate topics match the expanded filter. */
export function anyTopicMatchesFilter(
  candidateTopics: string[],
  expandedTopics: string[],
): boolean {
  if (expandedTopics.length === 0) return true;
  return candidateTopics.some((t) => topicMatchesFilter(t, expandedTopics));
}
