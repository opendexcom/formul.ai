# Issue 4: Very large forms (~130 questions) stress a single-shot validate step

**Scope:** PDF → form pipeline (`generate-stream-from-document`).  
**Related:** [README](./README.md) · [Issue 2](./issue-02-verification-build-expensive.md) · [Issue 5](./issue-05-monolithic-prompts.md)

## What users see

PDFs that imply **dozens to 100+ fields** (for example **~130 questions**) often fail at **“Validating and building final form…”**, return **truncated / invalid JSON**, or come back **missing tail questions** even when earlier pages looked fine.

## Why it happens (technical)

- **One response must carry the whole form.** The validate step asks the model for a single JSON object `{ title, description, questions: [...] }` containing **every** question. There is no streaming or sharding of the final schema; the client only accepts one completed `generate` step payload.

- **Output size and truncation.** Roughly 130 question objects (titles, types, `options` arrays, flags) produce a large completion. If the provider or model stops before closing the JSON, `tryParseLlmJson` fails and the controller surfaces **“Validation step returned invalid JSON”** — indistinguishable in the UI from other failures. Even when JSON parses, the model may **omit or merge** fields under pressure instead of emitting a faithful full list.

- **Validate prompt = merged draft + full document text.** The prompt embeds `JSON.stringify(merged)` **and** `--- FULL PDF DOCUMENT TEXT FOR VERIFICATION ---` plus `extractedText`. For a long PDF and a draft already approaching **~130** items, **input tokens** dominate: the model has less reliable capacity for a perfect diff against the source and for emitting a complete, ordered list in one pass.

- **Wall time scales with page count, not question count directly — but large forms correlate with long PDFs.** Map work is **one LLM call per page** (with `PAGES_PER_CHUNK = 1`). A **130-page** scan is **130** sequential map invocations (each with guardian + main) **before** the heavy validate call — so failures or timeouts often surface **late**, after a long wait.

- **No dedicated `maxTokens` on the shared `ChatOpenAI` client** for document analyze calls (`initializeOpenAI` only sets `apiKey`, `model`, `temperature`). Behavior then follows provider defaults, which are not tuned for “maximum-size JSON form” outputs — another reason **~130** is a realistic stress point rather than a hard-coded limit in this repo.

## Net effect

The architecture assumes a **medium-sized** form in one JSON blob at the end. **~130 questions** is where **prompt volume**, **completion length**, **parse fragility**, and **end-of-pipeline timeouts** compound — consistent with the issues you see on large compliance-style PDFs.
