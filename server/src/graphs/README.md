# LangGraph orchestration

Multi-step AI workflows run as [LangGraph](https://langchain-ai.github.io/langgraph/) state graphs. All LLM calls go through `AiService.invokeFlow` so MLflow prompt registry metadata, semantic cache, and tracing stay centralized.

## Module layout

| Path | Purpose |
|------|---------|
| `graph-runner.service.ts` | Parent MLflow span + streaming bridge for HTTP graphs |
| `form-generation/` | OSS form generation (strategy → questions → optimize → final) |
| `analytics/analytics-insights.graph.service.ts` | Analytics insights pipeline (findings → summary → recommendations) |

EE document-to-form graph lives in `ee-backend/src/graphs/document-form/`.

## MLflow tracing contract

1. **Bootstrap:** `initMlflowLangchainTracing()` runs first in `main.ts` and `worker.ts` (global LangChain instrumentation).
2. **HTTP sessions:** `MlflowTraceMiddleware` sets `sessionId` per request.
3. **Graph runs:** Parent `SpanType.CHAIN` span `formulai.graph.<graphId>` (aggregated token usage on parent where step usage is available).
4. **Graph nodes:** Each LangGraph node wraps logic in `withGraphNodeSpan(graphId, nodeName, inputs, fn)` → `formulai.graph.<graphId>.node.<nodeName>`.
5. **LLM steps:** Each `invokeFlow` call records `flowKey`, `promptName`, `promptVersion`, prompt inputs, and `mlflow.chat.tokenUsage` on the span (including cache hits with `total_tokens: 0`).
6. **Embeddings:** `EmbeddingService.embedQuery` records `SpanType.EMBEDDING` spans (`formulai.embedding.<provider>`) for semantic cache and topic vector clustering.
7. **Analytics orchestration:** `OrchestrationConsumer` opens `formulai.orchestration.analytics` with stage spans `formulai.orchestration.stage.<name>`. Worker jobs correlate via `sessionId = taskId`.
8. **DLQ failures:** `DeadLetterService` records `formulai.dlq.failed_job` traces with ERROR status and sanitized payload.
9. **Rule:** Graph nodes must never call `chatModel.invoke` directly.

## Adding a new graph

1. Define state with `Annotation.Root` in `<name>.state.ts`.
2. Node names must **not** match state channel names (LangGraph restriction).
3. Build graph in `<name>.graph.ts`; nodes call `invokeFlow` inside `withGraphNodeSpan`.
4. Wire through `GraphRunnerService` or a dedicated Nest service with `runWithMlflowTraceContextAsync`.
5. Call `flushMlflowTraces()` after graph completion.

## Streaming (SSE)

Form generation maps graph `onStep` callbacks to the existing SSE payload shape: `{ step, message, status, data?, usage? }`.

## Bull vs LangGraph

Bull/Redis remains the coordinator for analytics batch processing (response batches, clustering, aggregation). LangGraph orchestrates multi-step AI logic inside a single worker job where appropriate (e.g. consolidated insights generation).
