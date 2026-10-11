# Local embeddings

FormulAI’s default embedding provider is **local** (`EMBEDDING_PROVIDER=local`). The in-process model is loaded with `@huggingface/transformers` on CPU.

## Default model

| Setting | Value |
| --- | --- |
| `LOCAL_EMBEDDING_MODEL` | `Xenova/multilingual-e5-small` |
| `LLM_EMBEDDING_DIMENSION` | `384` |
| Previous default | `Xenova/all-MiniLM-L6-v2` (also 384-d, English-centric) |

Both the new and old defaults emit **384-dimensional** vectors, so Redis vector indexes (`analytics_topics_idx`, `llm_cache_idx`) keep `DIM 384`. **Do not mix vectors from different models in the same index** — the spaces are incompatible even when the size matches.

Code default: `DEFAULT_LOCAL_MODEL` in `server/src/ai/embedding.service.ts`. Override with `LOCAL_EMBEDDING_MODEL`.

## E5 input prefixes

`multilingual-e5-small` expects every input to start with `query: ` or `passage: ` (including non-English text).

| API | Prefix | Used for |
| --- | --- | --- |
| `EmbeddingService.embedQuery` | `query: ` | Semantic LLM cache, topic vector clustering / similarity |
| `EmbeddingService.embedDocument(s)` | `passage: ` | Document-style encoding if you add retrieval later |

Official E5 guidance: for **clustering and other symmetric similarity**, use the **query** prefix on every text. FormulAI topic clustering therefore goes through `embedQuery`. Prefixes are applied only for E5-family local models and are not doubled if the text is already prefixed. MiniLM and remote providers (OpenAI / Ollama) are left unchanged.

## Re-embed / migration

Switching the default model does **not** change the index dimension, but existing stored vectors were computed with MiniLM and must not be compared to E5 vectors.

Stored embeddings live in Redis (not MongoDB response documents):

- Topic vectors: keys `analyticstopic:*`, index `analytics_topics_idx`
- Semantic LLM cache: keys `llmcache:*`, index `llm_cache_idx`

After deploying the new default (or changing `LOCAL_EMBEDDING_MODEL` on a live stack):

1. Flush Redis topic and cache vectors, for example:
   ```bash
   redis-cli --scan --pattern 'analyticstopic:*' | xargs -r redis-cli DEL
   redis-cli --scan --pattern 'llmcache:*' | xargs -r redis-cli DEL
   ```
2. Optionally drop the RediSearch indexes so they are recreated on next API/worker start:
   ```bash
   redis-cli FT.DROPINDEX analytics_topics_idx
   redis-cli FT.DROPINDEX llm_cache_idx
   ```
3. Restart API and worker so they load `Xenova/multilingual-e5-small` into `TRANSFORMERS_CACHE`.
4. Re-run analytics on existing forms so topic clusters are rebuilt from new embeddings.

Do **not** run this flush/re-embed on production as part of applying the code change. Plan a maintenance window, then rebuild. Exact-match LLM cache still works after a flush; semantic cache and vector topic merge stay cold until traffic and analytics jobs refill them.

If you stay on MiniLM, set `LOCAL_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2` and leave `LLM_EMBEDDING_DIMENSION=384`.

## Performance (CPU)

`multilingual-e5-small` is larger and slower than MiniLM-L6-v2 (more parameters, multilingual tokenizer). First start downloads ONNX weights into `TRANSFORMERS_CACHE` (or `.cache/transformers` locally). See the measured sizes and latency in the pull request that switched the default; re-check on your hardware with:

```bash
cd server
RUN_LOCAL_EMBEDDING_CLUSTER_TEST=1 pnpm test -- polish-survey-clustering
```

That comparison is **opt-in** so CI does not download Hugging Face models.

## Related env

| Variable | Default | Notes |
| --- | --- | --- |
| `EMBEDDING_PROVIDER` | `local` | `local` \| `ollama` \| `openai` |
| `LOCAL_EMBEDDING_MODEL` | `Xenova/multilingual-e5-small` | Hugging Face / Xenova id |
| `LOCAL_EMBEDDING_WARMUP` | `true` | Load the ONNX model at process start |
| `LOCAL_EMBEDDING_THREADS` | `2` | WASM/ONNX thread count |
| `LLM_EMBEDDING_DIMENSION` | `384` | Must match the model; keep 384 for E5-small and MiniLM |
| `TRANSFORMERS_CACHE` | `.cache/transformers` | Model download cache |
| `ANALYTICS_TOPIC_SIMILARITY_THRESHOLD` | `0.82` | Cosine similarity to merge topics |
| `RUN_LOCAL_EMBEDDING_CLUSTER_TEST` | unset | Set to `1` to run the Polish clustering comparison |
