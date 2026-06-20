function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match responses that mention any of the given topics (OR semantics).
 * Compares case-insensitively against all stored topic fields — UI labels
 * often use raw/discovered names while canonicalTopics use title case.
 */
export function buildTopicFilterQuery(
  topics: string[],
): Record<string, unknown> | null {
  const topicArray = topics.map((t) => t.trim()).filter(Boolean);
  if (topicArray.length === 0) {
    return null;
  }

  const orConditions = topicArray.flatMap((topic) => {
    const regex = new RegExp(`^${escapeRegex(topic)}$`, 'i');
    return [
      { 'metadata.canonicalTopics': regex },
      { 'metadata.discoveredTopics': regex },
      { 'metadata.allTopics': regex },
      { 'metadata.primaryTopics': regex },
    ];
  });

  return { $or: orConditions };
}
