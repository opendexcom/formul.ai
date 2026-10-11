import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import {
  SpanAttributeKey,
  SpanStatusCode,
  SpanType,
  updateCurrentTrace,
  withSpan,
} from '@mlflow/core';
import type { LiveSpan } from '@mlflow/core';
import type { LlmUsage } from '../ai/llm.types';
import { isMlflowTracingEnabled, flushMlflowTraces } from './mlflow-langchain-tracing';

export interface MlflowTraceContext {
  sessionId?: string;
  user?: string;
  tags?: Record<string, string>;
}

export interface MlflowTraceCallOptions {
  inputs?: Record<string, unknown>;
  spanName?: string;
  requestPreview?: string;
}

export interface EmbeddingSpanOptions {
  provider: string;
  model: string;
  textLength: number;
}

export interface MlflowDlqFailureRecord {
  originalQueue: string;
  jobName: string;
  jobId?: string | number;
  taskId?: string;
  formId?: string;
  payload?: unknown;
  failedReason: string;
  attemptsMade: number;
  maxAttempts?: number;
  stacktrace?: string[];
  failedAt: number;
}

const storage = new AsyncLocalStorage<MlflowTraceContext>();

const PROMPT_TRACE_MAX_CHARS = 12_000;
const REQUEST_PREVIEW_MAX_CHARS = 500;
const DLQ_PAYLOAD_MAX_CHARS = 4000;

function mergeContext(
  base: MlflowTraceContext | undefined,
  override: MlflowTraceContext,
): MlflowTraceContext {
  return {
    ...base,
    ...override,
    sessionId: override.sessionId ?? base?.sessionId,
    user: override.user ?? base?.user,
    tags: { ...base?.tags, ...override.tags },
  };
}

/** Resolve MLflow session: explicit option → active async context → cache scope. */
export function resolveTraceSessionId(options?: {
  sessionId?: string;
  cacheScopeId?: string;
}): string | undefined {
  return (
    options?.sessionId ??
    getMlflowTraceContext()?.sessionId ??
    options?.cacheScopeId
  );
}

export function buildInvokeFlowTraceContext(
  flowKey: string,
  loaded: { name: string; version: string },
  options: {
    sessionId?: string;
    cacheScopeId?: string;
    userId?: string;
    formId?: string;
    cached?: boolean;
  },
): MlflowTraceContext {
  const inherited = getMlflowTraceContext();
  const user = options.userId ?? inherited?.user;
  return {
    sessionId: resolveTraceSessionId(options),
    user,
    tags: {
      ...inherited?.tags,
      flowKey,
      promptName: loaded.name,
      promptVersion: loaded.version,
      ...(options.cached ? { cached: 'true' } : {}),
      ...(options.formId ? { formId: options.formId } : {}),
      ...(user ? { userId: user } : {}),
    },
  };
}

/** Apply session/user metadata to the active MLflow trace (root or nested span). */
export function applyMlflowTraceMetadata(ctx: MlflowTraceContext): void {
  applyTraceMetadata(ctx);
}

function applyTraceMetadata(ctx: MlflowTraceContext): void {
  const metadata: Record<string, string> = {};
  if (ctx.sessionId) {
    metadata['mlflow.trace.session'] = ctx.sessionId;
  }
  if (ctx.user) {
    metadata['mlflow.trace.user'] = ctx.user;
  }
  updateCurrentTrace({
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    tags: ctx.tags,
  });
}

function resolveSpanName(ctx: MlflowTraceContext, override?: string): string {
  if (override) return override;
  if (ctx.tags?.flowKey) return `formulai.${ctx.tags.flowKey}`;
  if (ctx.tags?.worker) return `formulai.${ctx.tags.worker}`;
  return 'formulai.llm';
}

/** Build trace inputs from a full LLM prompt (truncated for MLflow UI). */
export function buildPromptTraceInputs(prompt: string): Record<string, unknown> {
  if (prompt.length <= PROMPT_TRACE_MAX_CHARS) {
    return { prompt, promptLength: prompt.length };
  }
  return {
    prompt: `${prompt.slice(0, PROMPT_TRACE_MAX_CHARS)}…[truncated, ${prompt.length} chars total]`,
    promptLength: prompt.length,
    truncated: true,
  };
}

/** Build trace inputs from system + user prompts (truncated for MLflow UI). */
export function buildFlowPromptTraceInputs(
  userPrompt: string,
  systemPrompt?: string,
): Record<string, unknown> {
  if (!systemPrompt) {
    return buildPromptTraceInputs(userPrompt);
  }

  const truncate = (text: string) =>
    text.length <= PROMPT_TRACE_MAX_CHARS
      ? text
      : `${text.slice(0, PROMPT_TRACE_MAX_CHARS)}…[truncated, ${text.length} chars total]`;

  return {
    systemPrompt: truncate(systemPrompt),
    systemPromptLength: systemPrompt.length,
    prompt: truncate(userPrompt),
    promptLength: userPrompt.length,
    truncated:
      systemPrompt.length > PROMPT_TRACE_MAX_CHARS ||
      userPrompt.length > PROMPT_TRACE_MAX_CHARS,
  };
}

export function buildFlowRequestPreview(
  userPrompt: string,
  systemPrompt?: string,
  maxChars = REQUEST_PREVIEW_MAX_CHARS,
): string {
  if (!systemPrompt) {
    return buildRequestPreview(userPrompt, maxChars);
  }
  const prefix = '[system prompt attached] ';
  const budget = Math.max(maxChars - prefix.length, 64);
  return prefix + buildRequestPreview(userPrompt, budget);
}

/** Cache key material: stable system text + variable user/task prompt. */
export function combinePromptForCache(
  userPrompt: string,
  systemPrompt?: string,
): string {
  if (!systemPrompt) {
    return userPrompt;
  }
  return `${systemPrompt}\n---\n${userPrompt}`;
}

export function buildRequestPreview(
  prompt: string,
  maxChars = REQUEST_PREVIEW_MAX_CHARS,
): string {
  return prompt.length <= maxChars
    ? prompt
    : `${prompt.slice(0, maxChars)}…`;
}

export function createEmptyLlmUsage(model = 'aggregated'): LlmUsage {
  return {
    model,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
}

export function accumulateLlmUsage(
  acc: LlmUsage,
  usage?: LlmUsage,
): void {
  if (!usage) return;
  acc.promptTokens =
    (acc.promptTokens ?? 0) + (usage.promptTokens ?? 0);
  acc.completionTokens =
    (acc.completionTokens ?? 0) + (usage.completionTokens ?? 0);
  const stepTotal =
    usage.totalTokens ??
    (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
  acc.totalTokens = (acc.totalTokens ?? 0) + stepTotal;
}

export function applyTokenUsageToSpan(span: LiveSpan, usage?: LlmUsage): void {
  if (!usage) return;

  const inputTokens = usage.promptTokens ?? 0;
  const outputTokens = usage.completionTokens ?? 0;
  const totalTokens =
    usage.totalTokens ?? inputTokens + outputTokens;

  span.setAttribute(SpanAttributeKey.TOKEN_USAGE, {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  });

  if (usage.cached) {
    span.setAttribute('formulai.cached', true);
  }
}

function captureLlmSpanResult(span: LiveSpan, result: unknown): void {
  if (!result || typeof result !== 'object') return;

  const record = result as Record<string, unknown>;
  if ('usage' in record) {
    applyTokenUsageToSpan(span, record.usage as LlmUsage | undefined);
  }

  if ('content' in record) {
    const content = record.content;
    span.setOutputs({
      content: typeof content === 'string' ? content : content,
    });
    return;
  }

  if ('parsed' in record) {
    span.setOutputs({ parsed: record.parsed });
  }
}

function runTracedCall<T>(
  ctx: MlflowTraceContext,
  fn: () => T,
  callOptions?: MlflowTraceCallOptions,
): T {
  const spanName = resolveSpanName(ctx, callOptions?.spanName);
  const inputs = callOptions?.inputs;
  return withSpan(
    (span) => {
      applyTraceMetadata(ctx);
      if (callOptions?.requestPreview) {
        updateCurrentTrace({
          requestPreview: callOptions.requestPreview,
        });
      }
      const result = fn();
      if (result instanceof Promise) {
        return result.then((value) => {
          captureLlmSpanResult(span, value);
          return value;
        }) as T;
      }
      captureLlmSpanResult(span, result);
      return result;
    },
    { name: spanName, spanType: SpanType.LLM, inputs },
  ) as T;
}

export async function withEmbeddingSpan<T>(
  options: EmbeddingSpanOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isMlflowTracingEnabled()) {
    return fn();
  }

  const start = Date.now();
  return withSpan(
    async (span) => {
      const result = await fn();
      const durationMs = Date.now() - start;
      const dimension = Array.isArray(result) ? result.length : undefined;
      span.setOutputs({ dimension, durationMs });
      return result;
    },
    {
      name: `formulai.embedding.${options.provider}`,
      spanType: SpanType.EMBEDDING,
      inputs: {
        provider: options.provider,
        model: options.model,
        textLength: options.textLength,
      },
    },
  );
}

export async function withGraphNodeSpan<T>(
  graphId: string,
  nodeName: string,
  inputs: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isMlflowTracingEnabled()) {
    return fn();
  }

  const ctx = getMlflowTraceContext();
  return withSpan(
    async () => {
      if (ctx) applyTraceMetadata(ctx);
      return fn();
    },
    {
      name: `formulai.graph.${graphId}.node.${nodeName}`,
      spanType: SpanType.CHAIN,
      inputs,
    },
  );
}

export async function withOrchestrationStageSpan<T>(
  stageName: string,
  inputs: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isMlflowTracingEnabled()) {
    return fn();
  }

  const ctx = getMlflowTraceContext();
  return withSpan(
    async () => {
      if (ctx) applyTraceMetadata(ctx);
      return fn();
    },
    {
      name: `formulai.orchestration.stage.${stageName}`,
      spanType: SpanType.CHAIN,
      inputs,
    },
  );
}

function sanitizeDlqPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const copy = { ...(payload as Record<string, unknown>) };
  const responseIds = copy.responseIds;
  if (Array.isArray(responseIds) && responseIds.length > 10) {
    copy.responseIds = responseIds.slice(0, 10);
    copy.responseIdsTruncated = true;
    copy.responseIdsTotal = responseIds.length;
  }

  const json = JSON.stringify(copy);
  if (json.length > DLQ_PAYLOAD_MAX_CHARS) {
    return {
      _truncated: json.slice(0, DLQ_PAYLOAD_MAX_CHARS),
      _originalLength: json.length,
    };
  }
  return copy;
}

export async function recordDlqFailureToMlflow(
  data: MlflowDlqFailureRecord,
): Promise<void> {
  if (!isMlflowTracingEnabled()) return;

  const sessionId = data.taskId ?? String(data.jobId ?? randomUUID());
  const ctx: MlflowTraceContext = {
    sessionId,
    tags: {
      worker: 'dlq',
      originalQueue: data.originalQueue,
      ...(data.taskId ? { taskId: data.taskId } : {}),
      ...(data.formId ? { formId: data.formId } : {}),
    },
  };

  await runWithMlflowTraceContextAsync(ctx, async () =>
    withSpan(
      async (span) => {
        applyTraceMetadata(ctx);
        const stack = data.stacktrace?.length
          ? data.stacktrace[data.stacktrace.length - 1]
          : undefined;
        span.setOutputs({
          failedReason: data.failedReason,
          stacktrace: stack,
          payload: sanitizeDlqPayload(data.payload),
        });
        span.setStatus(SpanStatusCode.ERROR, data.failedReason);
      },
      {
        name: 'formulai.dlq.failed_job',
        spanType: SpanType.CHAIN,
        inputs: {
          originalQueue: data.originalQueue,
          jobName: data.jobName,
          jobId: data.jobId,
          taskId: data.taskId,
          formId: data.formId,
          attemptsMade: data.attemptsMade,
          maxAttempts: data.maxAttempts,
          failedReason: data.failedReason,
        },
      },
    ),
  );

  await flushMlflowTraces();
}

export function getMlflowTraceContext(): MlflowTraceContext | undefined {
  return storage.getStore();
}

export function buildWorkerTraceContext(options: {
  sessionId: string;
  userId?: string;
  tags?: Record<string, string>;
}): MlflowTraceContext {
  const user = options.userId;
  return {
    sessionId: options.sessionId,
    user,
    tags: {
      ...options.tags,
      ...(user ? { userId: user } : {}),
    },
  };
}

export function createHttpSessionId(header?: string | string[]): string {
  const raw = Array.isArray(header) ? header[0] : header;
  return raw?.trim() || randomUUID();
}

export function runWithMlflowTraceContext<T>(
  ctx: MlflowTraceContext,
  fn: () => T,
): T {
  if (!isMlflowTracingEnabled()) {
    return fn();
  }
  const merged = mergeContext(storage.getStore(), ctx);
  return storage.run(merged, fn);
}

export async function runWithMlflowTraceContextAsync<T>(
  ctx: MlflowTraceContext,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isMlflowTracingEnabled()) {
    return fn();
  }
  const merged = mergeContext(storage.getStore(), ctx);
  return storage.run(merged, fn);
}

export function runWithActiveMlflowTraceContext<T>(
  fn: () => T,
  callOptions?: MlflowTraceCallOptions,
): T {
  const ctx = storage.getStore();
  if (!ctx || !isMlflowTracingEnabled()) {
    return fn();
  }
  return runTracedCall(ctx, fn, callOptions);
}

export async function runWithActiveMlflowTraceContextAsync<T>(
  fn: () => Promise<T>,
  callOptions?: MlflowTraceCallOptions,
): Promise<T> {
  const ctx = storage.getStore();
  if (!ctx || !isMlflowTracingEnabled()) {
    return fn();
  }
  return runTracedCall(ctx, fn, callOptions);
}
