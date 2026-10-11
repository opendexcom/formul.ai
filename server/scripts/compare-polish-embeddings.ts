/**
 * Opt-in local comparison: English MiniLM vs multilingual E5 on Polish answers.
 * Downloads Xenova ONNX models. Not run in CI.
 *
 *   RUN_LOCAL_EMBEDDING_CLUSTER_TEST=1 pnpm test:polish-cluster
 */
import {
  assertE5ClustersBetter,
  comparePolishSurveyModels,
  formatClusterReport,
} from '../src/ai/polish-survey-clustering';

async function main(): Promise<void> {
  if (process.env.RUN_LOCAL_EMBEDDING_CLUSTER_TEST !== '1') {
    console.error(
      'Set RUN_LOCAL_EMBEDDING_CLUSTER_TEST=1 to download models and run this comparison.',
    );
    process.exit(2);
  }

  const { minilm, e5 } = await comparePolishSurveyModels();
  console.log(`[polish-cluster] ${formatClusterReport(minilm)}`);
  console.log(`[polish-cluster] ${formatClusterReport(e5)}`);
  console.log(JSON.stringify({ minilm, e5 }, null, 2));
  assertE5ClustersBetter(minilm, e5);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
