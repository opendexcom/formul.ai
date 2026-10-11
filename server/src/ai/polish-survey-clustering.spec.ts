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

const RUN_CLUSTER_TEST = process.env.RUN_LOCAL_EMBEDDING_CLUSTER_TEST === '1';

const THRESHOLDS = [0.5, 0.6, 0.7, 0.82];

interface ThresholdMetrics {
  threshold: number;
  clusterCount: number;
  purity: number;
  ari: number;
}

interface ModelClusterReport {
  model: string;
  dimension: number;
  embedMs: number;
  texts: number;
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

async function embedAndCluster(
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
  const byThreshold = THRESHOLDS.map((threshold) =>
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
    defaultThreshold,
    bestAri,
  };
}

function formatReport(report: ModelClusterReport): string {
  const per100 = (report.embedMs / report.texts) * 100;
  const d = report.defaultThreshold;
  const b = report.bestAri;
  return [
    `model=${report.model}`,
    `dim=${report.dimension}`,
    `default@${d.threshold}:clusters=${d.clusterCount},purity=${d.purity.toFixed(4)},ari=${d.ari.toFixed(4)}`,
    `bestARI@${b.threshold}:clusters=${b.clusterCount},purity=${b.purity.toFixed(4)},ari=${b.ari.toFixed(4)}`,
    `embed_ms=${report.embedMs}`,
    `ms_per_100=${per100.toFixed(0)}`,
  ].join(' ');
}

(RUN_CLUSTER_TEST ? describe : describe.skip)(
  'Polish survey clustering (local embedding models)',
  () => {
    jest.setTimeout(10 * 60 * 1000);

    it('groups Polish answers better with multilingual-e5-small than MiniLM', async () => {
      const texts = POLISH_SURVEY_ANSWERS.map((row) => row.text);
      const keys = POLISH_SURVEY_ANSWERS.map((row) => row.id);
      const labelsByKey = new Map(
        POLISH_SURVEY_ANSWERS.map((row) => [row.id, row.topic]),
      );

      expect(POLISH_SURVEY_ANSWERS.length).toBeGreaterThanOrEqual(30);
      expect(POLISH_SURVEY_ANSWERS.length).toBeLessThanOrEqual(60);

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

      // eslint-disable-next-line no-console
      console.log(`[polish-cluster] ${formatReport(minilm)}`);
      // eslint-disable-next-line no-console
      console.log(`[polish-cluster] ${formatReport(e5)}`);

      expect(minilm.dimension).toBe(384);
      expect(e5.dimension).toBe(384);
      expect(e5.bestAri.ari).toBeGreaterThan(minilm.bestAri.ari);
      expect(e5.bestAri.purity).toBeGreaterThan(minilm.bestAri.purity);
    });
  },
);
