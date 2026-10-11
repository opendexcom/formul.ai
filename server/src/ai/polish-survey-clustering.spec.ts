import { spawnSync } from 'child_process';
import { join } from 'path';
import { POLISH_SURVEY_ANSWERS } from './fixtures/polish-survey-responses.fixture';

const RUN_CLUSTER_TEST = process.env.RUN_LOCAL_EMBEDDING_CLUSTER_TEST === '1';

describe('Polish survey fixture', () => {
  it('covers 30-60 answers across 3-5 topics', () => {
    const topics = new Set(POLISH_SURVEY_ANSWERS.map((row) => row.topic));
    expect(POLISH_SURVEY_ANSWERS.length).toBeGreaterThanOrEqual(30);
    expect(POLISH_SURVEY_ANSWERS.length).toBeLessThanOrEqual(60);
    expect(topics.size).toBeGreaterThanOrEqual(3);
    expect(topics.size).toBeLessThanOrEqual(5);
  });
});

(RUN_CLUSTER_TEST ? describe : describe.skip)(
  'Polish survey clustering (local embedding models)',
  () => {
    jest.setTimeout(10 * 60 * 1000);

    it('groups Polish answers better with multilingual-e5-small than MiniLM', () => {
      // Jest cannot dynamic-import @huggingface/transformers (ESM).
      // Run the comparison in a native Node/ts-node process instead.
      const script = join(__dirname, '../../scripts/compare-polish-embeddings.ts');
      const result = spawnSync(
        process.execPath,
        ['-r', 'ts-node/register', script],
        {
          cwd: join(__dirname, '../..'),
          env: {
            ...process.env,
            RUN_LOCAL_EMBEDDING_CLUSTER_TEST: '1',
            TS_NODE_TRANSPILE_ONLY: '1',
          },
          encoding: 'utf8',
          timeout: 10 * 60 * 1000,
        },
      );

      if (result.stdout) {
        // eslint-disable-next-line no-console
        console.log(result.stdout);
      }
      if (result.status !== 0) {
        throw new Error(
          `compare-polish-embeddings failed (status=${result.status}):\n${result.stderr}\n${result.stdout}`,
        );
      }
    });
  },
);
