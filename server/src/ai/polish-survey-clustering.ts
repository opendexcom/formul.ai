import {
  DEFAULT_LOCAL_MODEL,
  EmbeddingService,
  LEGACY_LOCAL_MODEL,
  resolveTopicSimilarityThreshold,
} from './embedding.service';
import { POLISH_SURVEY_ANSWERS } from './fixtures/polish-survey-responses.fixture';
import {
  adjustedRandIndex,
  clusterByCosineSimilarity,
  clusterByKMeans,
  clusterPurity,
  cosineSimilarity,
} from '../analytics/utils/topic-vector-cluster.util';

export const POLISH_CLUSTER_THRESHOLDS = [0.5, 0.6, 0.7, 0.82, 0.9];

export interface ThresholdMetrics {
  threshold: number;
  clusterCount: number;
  purity: number;
  ari: number;
}

export interface PairwiseStats {
  min: number;
  mean: number;
  sameTopicMean: number;
  diffTopicMean: number;
  gap: number;
}

export interface ModelClusterReport {
  model: string;
  dimension: number;
  embedMs: number;
  texts: number;
  msPer100: number;
  pairwise: PairwiseStats;
  graphDefault: ThresholdMetrics;
  graphBestAri: ThresholdMetrics;
  kmeans: ThresholdMetrics;
}

function metricsForGroups(
  groups: Map<string, string[]>,
  labelsByKey: Map<string, string>,
  threshold: number,
): ThresholdMetrics {
  return {
    threshold,
    clusterCount: groups.size,
    purity: clusterPurity(groups, labelsByKey),
    ari: adjustedRandIndex(groups, labelsByKey),
  };
}

function pairwiseStats(
  items: Array<{ key: string; embedding: number[] }>,
  labelsByKey: Map<string, string>,
): PairwiseStats {
  const sims: number[] = [];
  const same: number[] = [];
  const diff: number[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = cosineSimilarity(items[i].embedding, items[j].embedding);
      sims.push(sim);
      if (labelsByKey.get(items[i].key) === labelsByKey.get(items[j].key)) {
        same.push(sim);
      } else {
        diff.push(sim);
      }
    }
  }
  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    min: Math.min(...sims),
    mean: avg(sims),
    sameTopicMean: avg(same),
    diffTopicMean: avg(diff),
    gap: avg(same) - avg(diff),
  };
}

export async function embedAndCluster(
  model: string,
  texts: string[],
  keys: string[],
  labelsByKey: Map<string, string>,
): Promise<ModelClusterReport> {
  const previousModel = process.env.LOCAL_EMBEDDING_MODEL;
  const previousThreshold = process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD;
  process.env.EMBEDDING_PROVIDER = 'local';
  process.env.LOCAL_EMBEDDING_MODEL = model;
  process.env.LOCAL_EMBEDDING_WARMUP = 'false';
  process.env.LLM_EMBEDDING_DIMENSION = '384';
  delete process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD;

  const service = new EmbeddingService();
  const started = Date.now();
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await service.embedQuery(text));
  }
  const embedMs = Date.now() - started;

  const dimension = embeddings[0]?.length ?? 0;
  const items = keys.map((key, i) => ({ key, embedding: embeddings[i] }));
  const topicCount = new Set(labelsByKey.values()).size;
  const modelDefaultThreshold = resolveTopicSimilarityThreshold(model);
  const graphDefault = metricsForGroups(
    clusterByCosineSimilarity(items),
    labelsByKey,
    modelDefaultThreshold,
  );
  const byThreshold = POLISH_CLUSTER_THRESHOLDS.map((threshold) =>
    metricsForGroups(
      clusterByCosineSimilarity(items, { threshold }),
      labelsByKey,
      threshold,
    ),
  );
  const graphBestAri = byThreshold.reduce((best, row) =>
    row.ari > best.ari ? row : best,
  );
  const kmeans = metricsForGroups(
    clusterByKMeans(items, topicCount),
    labelsByKey,
    topicCount,
  );

  if (previousModel === undefined) {
    delete process.env.LOCAL_EMBEDDING_MODEL;
  } else {
    process.env.LOCAL_EMBEDDING_MODEL = previousModel;
  }
  if (previousThreshold === undefined) {
    delete process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD;
  } else {
    process.env.ANALYTICS_TOPIC_SIMILARITY_THRESHOLD = previousThreshold;
  }

  return {
    model,
    dimension,
    embedMs,
    texts: texts.length,
    msPer100: (embedMs / texts.length) * 100,
    pairwise: pairwiseStats(items, labelsByKey),
    graphDefault,
    graphBestAri,
    kmeans,
  };
}

export function formatClusterReport(report: ModelClusterReport): string {
  const d = report.graphDefault;
  const b = report.graphBestAri;
  const k = report.kmeans;
  const p = report.pairwise;
  return [
    `model=${report.model}`,
    `dim=${report.dimension}`,
    `kmeans@k=${k.threshold}:clusters=${k.clusterCount},purity=${k.purity.toFixed(4)},ari=${k.ari.toFixed(4)}`,
    `graph@${d.threshold}:clusters=${d.clusterCount},purity=${d.purity.toFixed(4)},ari=${d.ari.toFixed(4)}`,
    `graphBest@${b.threshold}:clusters=${b.clusterCount},purity=${b.purity.toFixed(4)},ari=${b.ari.toFixed(4)}`,
    `gap=${p.gap.toFixed(4)}(same=${p.sameTopicMean.toFixed(3)},diff=${p.diffTopicMean.toFixed(3)})`,
    `embed_ms=${report.embedMs}`,
    `ms_per_100=${report.msPer100.toFixed(0)}`,
  ].join(' ');
}

export async function comparePolishSurveyModels(): Promise<{
  minilm: ModelClusterReport;
  e5: ModelClusterReport;
}> {
  const texts = POLISH_SURVEY_ANSWERS.map((row) => row.text);
  const keys = POLISH_SURVEY_ANSWERS.map((row) => row.id);
  const labelsByKey = new Map(
    POLISH_SURVEY_ANSWERS.map((row) => [row.id, row.topic]),
  );

  if (POLISH_SURVEY_ANSWERS.length < 30 || POLISH_SURVEY_ANSWERS.length > 60) {
    throw new Error(
      `Expected 30-60 fixture answers, got ${POLISH_SURVEY_ANSWERS.length}`,
    );
  }

  const minilm = await embedAndCluster(
    LEGACY_LOCAL_MODEL,
    texts,
    keys,
    labelsByKey,
  );
  const e5 = await embedAndCluster(
    DEFAULT_LOCAL_MODEL,
    texts,
    keys,
    labelsByKey,
  );

  return { minilm, e5 };
}

export function assertE5ClustersBetter(
  minilm: ModelClusterReport,
  e5: ModelClusterReport,
): void {
  if (minilm.dimension !== 384 || e5.dimension !== 384) {
    throw new Error(
      `Expected 384-d vectors, got MiniLM=${minilm.dimension} e5=${e5.dimension}`,
    );
  }
  if (e5.kmeans.ari <= minilm.kmeans.ari) {
    throw new Error(
      `E5 k-means ARI ${e5.kmeans.ari.toFixed(4)} was not better than MiniLM ${minilm.kmeans.ari.toFixed(4)}`,
    );
  }
  if (e5.kmeans.purity <= minilm.kmeans.purity) {
    throw new Error(
      `E5 k-means purity ${e5.kmeans.purity.toFixed(4)} was not better than MiniLM ${minilm.kmeans.purity.toFixed(4)}`,
    );
  }
  if (e5.pairwise.gap <= minilm.pairwise.gap) {
    throw new Error(
      `E5 same-vs-diff topic gap ${e5.pairwise.gap.toFixed(4)} was not better than MiniLM ${minilm.pairwise.gap.toFixed(4)}`,
    );
  }
  if (e5.graphDefault.clusterCount <= 1) {
    throw new Error(
      `E5 graph clustering at the model default (${e5.graphDefault.threshold}) collapsed to ${e5.graphDefault.clusterCount} cluster(s)`,
    );
  }
  if (e5.graphDefault.ari <= minilm.graphDefault.ari) {
    throw new Error(
      `E5 graph ARI ${e5.graphDefault.ari.toFixed(4)} @${e5.graphDefault.threshold} was not better than MiniLM ${minilm.graphDefault.ari.toFixed(4)} @${minilm.graphDefault.threshold}`,
    );
  }
}
