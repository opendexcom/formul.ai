/** Multilingual E5-small (intfloat), 384-d — same index DIM as MiniLM-L6-v2. */
export const DEFAULT_LOCAL_MODEL = 'Xenova/multilingual-e5-small';
/** Previous English-only default; keep for opt-in comparisons and rollback. */
export const LEGACY_LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const DEFAULT_LOCAL_DIMENSION = 384;

/** Historical MiniLM-tuned cosine merge threshold. */
export const MINILM_TOPIC_SIMILARITY_THRESHOLD = 0.82;
/**
 * E5-tuned cosine merge threshold from the Polish survey fixture.
 * 0.82 collapses E5 into one cluster; 0.90 had the best graph ARI.
 */
export const E5_TOPIC_SIMILARITY_THRESHOLD = 0.9;

export function isE5EmbeddingModel(model: string): boolean {
  return /(?:^|[/-])e5(?:-|$)/i.test(model);
}

export function defaultTopicSimilarityThreshold(model: string): number {
  return isE5EmbeddingModel(model)
    ? E5_TOPIC_SIMILARITY_THRESHOLD
    : MINILM_TOPIC_SIMILARITY_THRESHOLD;
}

/**
 * Topic-merge cosine threshold. `ANALYTICS_TOPIC_SIMILARITY_THRESHOLD` is an
 * explicit override; when unset, MiniLM uses 0.82 and E5-family uses 0.90.
 */
export function resolveTopicSimilarityThreshold(model?: string): number {
  const raw = process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD;
  if (raw != null && String(raw).trim() !== '') {
    const configured = parseFloat(raw);
    if (!Number.isNaN(configured) && configured > 0) {
      return configured;
    }
  }
  return defaultTopicSimilarityThreshold(
    model || process.env.LOCAL_EMBEDDING_MODEL || DEFAULT_LOCAL_MODEL,
  );
}
