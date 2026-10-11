import {
  DEFAULT_LOCAL_MODEL,
  EmbeddingService,
  LEGACY_LOCAL_MODEL,
} from './embedding.service';
import { POLISH_SURVEY_ANSWERS } from './fixtures/polish-survey-responses.fixture';
import {
  adjustedRandIndex,
  clusterByCosineSimilarity,
  clusterPurity,
} from '../analytics/utils/topic-vector-cluster.util';

export const POLISH_CLUSTER_THRESHOLDS = [0.5, 0.6, 0.7, 0.82];

export interface ThresholdMetrics {
  threshold: number;
  clusterCount: number;
  purity: number;
  ari: number;
}

export interface ModelClusterReport {
  model: string;
  dimension: number;
  embedMs: number;
  texts: number;
  msPer100: number;
  defaultThreshold: ThresholdMetrics;
  bestAri: ThresholdMetrics;
}

function metricsAtThreshold(
  items: Array<{ key: string; embedding: number[] }>,
  labelsByKey: Map<string, string>,
  threshold: number,
): ThresholdMetrics {
  const groups = clusterByCosineSimilarity(items, { threshold });
  return {
    threshold,
    clusterCount: groups.size,
    purity: clusterPurity(groups, labelsByKey),
    ari: adjustedRandIndex(groups, labelsByKey),
  };
}

export async function embedAndCluster(
  model: string,
  texts: string[],
  keys: string[],
  labelsByKey: Map<string, string>,
): Promise<ModelClusterReport> {
  const previousModel = process.env.LOCAL_EMBEDDING_MODEL;
  process.env.EMBEDDING_PROVIDER = 'local';
  process.env.LOCAL_EMBEDDING_MODEL = model;
  process.env.LOCAL_EMBEDDING_WARMUP = 'false';
  process.env.LLM_EMBEDDING_DIMENSION = '384';

  const service = new EmbeddingService();
  const started = Date.now();
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await service.embedQuery(text));
  }
  const embedMs = Date.now() - started;

  const dimension = embeddings[0]?.length ?? 0;
  const items = keys.map((key, i) => ({ key, embedding: embeddings[i] }));
  const byThreshold = POLISH_CLUSTER_THRESHOLDS.map((threshold) =>
    metricsAtThreshold(items, labelsByKey, threshold),
  );
  const defaultThreshold =
    byThreshold.find((row) => row.threshold === 0.82) ?? byThreshold[0];
  const bestAri = byThreshold.reduce((best, row) =>
    row.ari > best.ari ? row : best,
  );

  if (previousModel === undefined) {
    delete process.env.LOCAL_EMBEDDING_MODEL;
  } else {
    process.env.LOCAL_EMBEDDING_MODEL = previousModel;
  }

  return {
    model,
    dimension,
    embedMs,
    texts: texts.length,
    msPer100: (embedMs / texts.length) * 100,
    defaultThreshold,
    bestAri,
  };
}

export function formatClusterReport(report: ModelClusterReport): string {
  const d = report.defaultThreshold;
  const b = report.bestAri;
  return [
    `model=${report.model}`,
    `dim=${report.dimension}`,
    `default@${d.threshold}:clusters=${d.clusterCount},purity=${d.purity.toFixed(4)},ari=${d.ari.toFixed(4)}`,
    `bestARI@${b.threshold}:clusters=${b.clusterCount},purity=${b.purity.toFixed(4)},ari=${b.ari.toFixed(4)}`,
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
  if (e5.bestAri.ari <= minilm.bestAri.ari) {
    throw new Error(
      `E5 ARI ${e5.bestAri.ari.toFixed(4)} was not better than MiniLM ${minilm.bestAri.ari.toFixed(4)}`,
    );
  }
  if (e5.bestAri.purity <= minilm.bestAri.purity) {
    throw new Error(
      `E5 purity ${e5.bestAri.purity.toFixed(4)} was not better than MiniLM ${minilm.bestAri.purity.toFixed(4)}`,
    );
  }
}
