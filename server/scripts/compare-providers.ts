/**
 * Side-by-side OpenAI vs Mistral vs Bedrock quality/cost harness.
 * Uses the same Polish survey sample and analytics prompt templates.
 *
 * Does not invent results. Providers without credentials are skipped
 * (not faked). If none can run, the script exits 1 with setup notes.
 *
 * Usage (from oss-core/server):
 *   pnpm compare:providers
 *
 * Required per provider you want to include:
 *   OpenAI     OPENAI_API_KEY
 *   Mistral    MISTRAL_API_KEY   (hits https://api.eu.mistral.ai by default)
 *   Bedrock    AWS default credential chain + model access in eu-central-1
 *   OpenRouter OPENROUTER_API_KEY  (jev classification tasks only)
 *
 * Optional:
 *   COMPARE_MODELS_OPENAI=gpt-4o-mini
 *   COMPARE_MODELS_MISTRAL=mistral-small-latest,mistral-large-latest
 *   COMPARE_MODELS_BEDROCK=eu.amazon.nova-lite-v1:0,eu.amazon.nova-pro-v1:0
 *   COMPARE_MODELS_OPENROUTER=typesafe/jev-1.13
 *   COMPARE_OUTPUT=/tmp/provider-compare.json
 *   BEDROCK_REGION=eu-central-1
 *   MISTRAL_BASE_URL=https://api.eu.mistral.ai
 */
import * as fs from 'fs';
import * as path from 'path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  buildChatInvokeOptions,
  DEFAULT_PROVIDER_MODELS,
  resolveLlmProviderConfig,
} from '../src/ai/llm-provider.config';
import { createChatModel } from '../src/ai/llm-provider.factory';
import {
  estimateAnalysisCostPer100,
  estimateUsdCost,
  PRICING_CITATION,
  resolveTokenRate,
} from '../src/ai/llm-pricing';
import { JEV_DEFAULT_MODEL } from '../src/ai/llm-provider.config';
import { invokeJevDecisions, jevChoice } from '../src/ai/jev-decisions.client';
import type { LlmProviderConfig, LlmProviderName } from '../src/ai/llm-provider.types';

type SamplePayload = {
  formTitle: string;
  formPurpose: string;
  questions: Array<{ id: string; title: string }>;
  responses: Array<{ responseId: string; answers: Record<string, string> }>;
};

type TaskName =
  | 'combined_analysis'
  | 'summary'
  | 'classification_sentiment'
  | 'classification_quality'
  | 'classification_cluster_label';

type TaskResult = {
  provider: LlmProviderName;
  model: string;
  task: TaskName;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  elapsedMs: number;
  parseError?: string;
};

const FIRST_CLASS: LlmProviderName[] = ['openai', 'mistral', 'bedrock'];

const DEFAULT_COMPARE_MODELS: Record<LlmProviderName, string[]> = {
  openai: ['gpt-4o-mini'],
  mistral: ['mistral-small-latest', 'mistral-large-latest'],
  bedrock: ['eu.amazon.nova-lite-v1:0', 'eu.amazon.nova-pro-v1:0'],
  ollama: [DEFAULT_PROVIDER_MODELS.ollama.analysis],
  openrouter: [JEV_DEFAULT_MODEL],
};

const FIXTURE = path.join(__dirname, 'fixtures/polish-survey-sample.json');
const COMBINED_PROMPT = path.join(
  __dirname,
  '../../mlflow/prompts/analytics/combined-analysis.md',
);
const SUMMARY_PROMPT = path.join(
  __dirname,
  '../../mlflow/prompts/analytics/summary.md',
);

function extractUsage(raw: any): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const usage =
    raw?.usage_metadata ??
    raw?.usage ??
    raw?.response_metadata?.usage ??
    raw?.response_metadata?.tokenUsage ??
    {};
  const promptTokens =
    usage.prompt_tokens ??
    usage.promptTokens ??
    usage.input_tokens ??
    usage.inputTokens ??
    0;
  const completionTokens =
    usage.completion_tokens ??
    usage.completionTokens ??
    usage.output_tokens ??
    usage.outputTokens ??
    0;
  const totalTokens =
    usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`{{${key}}}`, 'g'), value),
    template,
  );
}

function buildResponsesData(sample: SamplePayload): string {
  return sample.responses
    .map((response) => {
      const answers = sample.questions
        .map((q) => `${q.title}: ${response.answers[q.id] ?? ''}`)
        .join('\n');
      return `responseId=${response.responseId}\n${answers}`;
    })
    .join('\n\n');
}

function buildCombinedPrompt(sample: SamplePayload): string {
  const template = fs.readFileSync(COMBINED_PROMPT, 'utf8');
  return renderTemplate(template, {
    responseCount: String(sample.responses.length),
    responsesData: buildResponsesData(sample),
    ratingContext: '',
    questionContext: `Form: ${sample.formTitle}. Purpose: ${sample.formPurpose}.`,
  });
}

function buildSummaryPrompt(sample: SamplePayload, combinedJson: string): string {
  const template = fs.readFileSync(SUMMARY_PROMPT, 'utf8');
  const summaryContext = [
    `Form: ${sample.formTitle}`,
    `Purpose: ${sample.formPurpose}`,
    `Response count: ${sample.responses.length}`,
    'Combined analysis JSON:',
    combinedJson,
  ].join('\n');
  return renderTemplate(template, { summaryContext });
}

function parseModelList(envKey: string, fallback: string[]): string[] {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerReady(provider: LlmProviderName): { ok: boolean; reason?: string } {
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY
      ? { ok: true }
      : { ok: false, reason: 'OPENAI_API_KEY is not set' };
  }
  if (provider === 'mistral') {
    return process.env.MISTRAL_API_KEY
      ? { ok: true }
      : { ok: false, reason: 'MISTRAL_API_KEY is not set' };
  }
  if (provider === 'openrouter') {
    return process.env.OPENROUTER_API_KEY
      ? { ok: true }
      : { ok: false, reason: 'OPENROUTER_API_KEY is not set' };
  }
  if (provider === 'bedrock') {
    const hasStaticKeys = Boolean(
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
    );
    const hasProfile = Boolean(process.env.AWS_PROFILE);
    const hasWebIdentity = Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE);
    const hasContainer = Boolean(
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
    );
    if (hasStaticKeys || hasProfile || hasWebIdentity || hasContainer) {
      return { ok: true };
    }
    return {
      ok: false,
      reason:
        'No AWS credentials in the default chain (set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, AWS_PROFILE, or a role)',
    };
  }
  return { ok: false, reason: 'Provider not included in this harness' };
}

function configFor(provider: LlmProviderName, model: string): LlmProviderConfig {
  return resolveLlmProviderConfig({
    ...process.env,
    LLM_PROVIDER: provider,
    LLM_MODEL_ANALYSIS: model,
    LLM_MODEL_CHAT: model,
    OPENAI_MODEL: provider === 'openai' ? model : process.env.OPENAI_MODEL,
    MISTRAL_MODEL: provider === 'mistral' ? model : process.env.MISTRAL_MODEL,
    BEDROCK_MODEL: provider === 'bedrock' ? model : process.env.BEDROCK_MODEL,
  });
}

async function runTask(
  provider: LlmProviderName,
  modelName: string,
  task: TaskName,
  prompt: string,
  useJsonFormat: boolean,
): Promise<TaskResult> {
  const config = configFor(provider, modelName);
  const model = createChatModel('analysis', config);
  if (!model) {
    throw new Error(`${provider} chat model is not configured`);
  }
  const started = Date.now();
  const response = (await model.invoke(
    [new SystemMessage('Follow the user instructions exactly.'), new HumanMessage(prompt)],
    buildChatInvokeOptions(provider, { useJsonFormat, maxTokens: 2500 }),
  )) as { content?: unknown };
  const elapsedMs = Date.now() - started;
  const content =
    typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  const usage = extractUsage(response);
  const result: TaskResult = {
    provider,
    model: modelName,
    task,
    content,
    ...usage,
    estimatedUsd: estimateUsdCost(modelName, usage.promptTokens, usage.completionTokens),
    elapsedMs,
  };
  if (useJsonFormat) {
    try {
      JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    } catch (err) {
      result.parseError = (err as Error).message;
    }
  }
  return result;
}

function printReport(results: TaskResult[], skipped: Array<{ provider: string; reason: string }>): void {
  console.log('\n=== FormulAI provider quality comparison ===\n');
  console.log(`Pricing sources (retrieved ${PRICING_CITATION.retrievedAt}):`);
  console.log(`  OpenAI:  ${PRICING_CITATION.openai}`);
  console.log(`  Mistral: ${PRICING_CITATION.mistral}`);
  console.log(`  Bedrock: ${PRICING_CITATION.bedrock}`);
  console.log(`  OpenRouter / jev: ${PRICING_CITATION.jev}\n`);

  if (skipped.length) {
    console.log('Skipped providers (not faked):');
    for (const row of skipped) {
      console.log(`  - ${row.provider}: ${row.reason}`);
    }
    console.log('');
  }

  for (const task of [
    'combined_analysis',
    'summary',
    'classification_sentiment',
    'classification_quality',
    'classification_cluster_label',
  ] as TaskName[]) {
    const rows = results.filter((r) => r.task === task);
    console.log(`--- ${task} ---`);
    for (const row of rows) {
      const rate = resolveTokenRate(row.model);
      console.log(
        [
          `${row.provider}/${row.model}`,
          `tokens in/out/total=${row.promptTokens}/${row.completionTokens}/${row.totalTokens}`,
          `usd=${row.estimatedUsd.toFixed(6)}`,
          `rate=$/1M ${rate.inputPerMillion}/${rate.outputPerMillion}`,
          `${row.elapsedMs}ms`,
          row.parseError ? `JSON_PARSE_FAIL: ${row.parseError}` : 'json=ok',
        ].join(' | '),
      );
    }
    console.log('');
    for (const row of rows) {
      console.log(`>>> ${row.provider}/${row.model} ${task} output:\n`);
      console.log(row.content);
      console.log('');
    }
  }

  const totals = new Map<string, { tokens: number; usd: number }>();
  for (const row of results) {
    const key = `${row.provider}/${row.model}`;
    const current = totals.get(key) ?? { tokens: 0, usd: 0 };
    current.tokens += row.totalTokens;
    current.usd += row.estimatedUsd;
    totals.set(key, current);
  }
  console.log('--- totals for this sample ---');
  for (const [key, total] of totals) {
    console.log(`${key}: ${total.tokens} tokens, $${total.usd.toFixed(6)}`);
  }

  console.log('\n--- estimated USD / 100 responses (combined vs jev split) ---');
  const analysisModels = [
    ...new Set(
      results
        .filter((r) => r.task === 'combined_analysis')
        .map((r) => r.model),
    ),
  ];
  const classModel =
    results.find((r) => r.task.startsWith('classification_'))?.model ||
    JEV_DEFAULT_MODEL;
  const modelsToEstimate =
    analysisModels.length > 0
      ? analysisModels
      : ['gpt-4o-mini', 'gpt-5-mini', 'mistral-small-latest', 'eu.amazon.nova-lite-v1:0'];
  for (const model of modelsToEstimate) {
    const estimate = estimateAnalysisCostPer100({
      analysisModel: model,
      classificationModel: classModel,
    });
    console.log(
      [
        model,
        `current=$${estimate.currentUsd.toFixed(5)}`,
        `split=$${estimate.splitUsd.toFixed(5)}`,
        `(analysis $${estimate.splitAnalysisUsd.toFixed(5)} + ${estimate.classificationModel} $${estimate.splitClassificationUsd.toFixed(5)})`,
        `save=$${estimate.savingsUsd.toFixed(5)} (${estimate.savingsPct.toFixed(1)}%)`,
      ].join(' | '),
    );
  }
}

function printSetupHelp(): void {
  console.error(`
No provider credentials available — refusing to invent comparison results.

OpenAI:
  OPENAI_API_KEY=sk-...

Mistral (EU endpoint https://api.eu.mistral.ai — also enable Zero Data Retention
in the Mistral console; that is an account setting, not a code flag):
  MISTRAL_API_KEY=...
  MISTRAL_BASE_URL=https://api.eu.mistral.ai

Bedrock (EU, default region eu-central-1; enable model access in the Bedrock
console; IAM needs bedrock:InvokeModel, InvokeModelWithResponseStream,
bedrock:Converse, bedrock:ConverseStream on the chosen model / inference-profile ARNs):
  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
  # or AWS_PROFILE=... / instance or task role
  BEDROCK_REGION=eu-central-1

OpenRouter (jev classification — Decisions API, not chat completions):
  OPENROUTER_API_KEY=...
  COMPARE_MODELS_OPENROUTER=typesafe/jev-1.13

Example:
  OPENAI_API_KEY=sk-... MISTRAL_API_KEY=... OPENROUTER_API_KEY=... \\
    AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=eu-central-1 \\
    pnpm --dir oss-core/server compare:providers
`);
}

async function runJevTask(
  modelName: string,
  task: TaskName,
  state: unknown,
  questions: Record<string, { type: 'choice' | 'score' | 'noul'; instructions: string; criteria: unknown }>,
): Promise<TaskResult> {
  const started = Date.now();
  const result = await invokeJevDecisions({
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: modelName,
    state,
    questions: questions as any,
  });
  const elapsedMs = Date.now() - started;
  return {
    provider: 'openrouter',
    model: modelName,
    task,
    content: JSON.stringify(result.answers, null, 2),
    promptTokens: result.usage.promptTokens ?? 0,
    completionTokens: result.usage.completionTokens ?? 0,
    totalTokens: result.usage.totalTokens ?? 0,
    estimatedUsd: estimateUsdCost(
      modelName,
      result.usage.promptTokens ?? 0,
      result.usage.completionTokens ?? 0,
    ),
    elapsedMs,
  };
}

async function runJevClassificationTasks(
  sample: SamplePayload,
  modelName: string,
): Promise<TaskResult[]> {
  const first = sample.responses[0];
  const answers = sample.questions
    .map((q) => `${q.title}: ${first.answers[q.id] ?? ''}`)
    .join('\n');
  const topics = ['Remote Work', 'Recognition', 'Workload'];

  const sentiment = await runJevTask(modelName, 'classification_sentiment', {
    responseId: first.responseId,
    answers,
  }, {
    sentiment: {
      type: 'choice',
      instructions: 'Overall sentiment of this survey response.',
      criteria: {
        positive: 'Pleased or approving.',
        neutral: 'Factual or flat.',
        negative: 'Unhappy or critical.',
        ambivalent: 'Both positive and negative.',
      },
    },
  });
  sentiment.content = JSON.stringify(
    { sentiment: jevChoice(JSON.parse(sentiment.content), 'sentiment'), raw: JSON.parse(sentiment.content) },
    null,
    2,
  );

  const quality = await runJevTask(modelName, 'classification_quality', {
    responseId: first.responseId,
    answers,
  }, {
    depth: {
      type: 'score',
      instructions: 'How much substance and detail does the response have?',
      criteria: ['very low', 'low', 'moderate', 'high', 'very high'],
    },
  });

  const cluster = await runJevTask(modelName, 'classification_cluster_label', {
    clusterMembers: topics,
  }, {
    canonical: {
      type: 'choice',
      instructions: 'Pick the clearest canonical label from these clustered topic phrases.',
      criteria: Object.fromEntries(topics.map((t, i) => [`opt_${i}`, t])),
    },
  });

  return [sentiment, quality, cluster];
}

async function main(): Promise<void> {
  const skipped: Array<{ provider: string; reason: string }> = [];
  const ready: LlmProviderName[] = [];
  for (const provider of FIRST_CLASS) {
    const status = providerReady(provider);
    if (status.ok) {
      ready.push(provider);
    } else {
      skipped.push({ provider, reason: status.reason || 'not configured' });
    }
  }

  const openrouterStatus = providerReady('openrouter');
  if (!openrouterStatus.ok) {
    skipped.push({
      provider: 'openrouter',
      reason: openrouterStatus.reason || 'not configured',
    });
  }

  if (ready.length === 0 && !openrouterStatus.ok) {
    printSetupHelp();
    process.exit(1);
  }

  const modelsByProvider: Record<LlmProviderName, string[]> = {
    openai: parseModelList('COMPARE_MODELS_OPENAI', DEFAULT_COMPARE_MODELS.openai),
    mistral: parseModelList('COMPARE_MODELS_MISTRAL', DEFAULT_COMPARE_MODELS.mistral),
    bedrock: parseModelList('COMPARE_MODELS_BEDROCK', DEFAULT_COMPARE_MODELS.bedrock),
    ollama: [],
    openrouter: parseModelList(
      'COMPARE_MODELS_OPENROUTER',
      DEFAULT_COMPARE_MODELS.openrouter,
    ),
  };

  const sample = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as SamplePayload;
  const combinedPrompt = buildCombinedPrompt(sample);
  const results: TaskResult[] = [];

  for (const provider of ready) {
    for (const model of modelsByProvider[provider]) {
      console.log(`Running combined_analysis on ${provider}/${model}...`);
      const combined = await runTask(
        provider,
        model,
        'combined_analysis',
        combinedPrompt,
        true,
      );
      results.push(combined);
      console.log(`Running summary on ${provider}/${model}...`);
      results.push(
        await runTask(
          provider,
          model,
          'summary',
          buildSummaryPrompt(sample, combined.content),
          false,
        ),
      );
    }
  }

  if (openrouterStatus.ok) {
    for (const model of modelsByProvider.openrouter) {
      console.log(`Running jev classification tasks on openrouter/${model}...`);
      results.push(...(await runJevClassificationTasks(sample, model)));
    }
  }

  printReport(results, skipped);

  const outputPath = process.env.COMPARE_OUTPUT;
  if (outputPath) {
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        { pricing: PRICING_CITATION, sample: sample.formTitle, skipped, results },
        null,
        2,
      ),
    );
    console.log(`\nWrote ${outputPath}`);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
