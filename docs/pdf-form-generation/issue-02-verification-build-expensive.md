# Issue 2: Verification and final build are expensive and not well staged

**Scope:** PDF → form pipeline (`generate-stream-from-document`).  
**Related:** [README](./README.md) · [Issue 4](./issue-04-large-forms-130-questions.md) · [Issue 5](./issue-05-monolithic-prompts.md)

## What users see

Progress may sit a long time on **“Validating and building final form…”** after many per-page steps; total wall time grows quickly on multi-page PDFs.

## Why it happens (technical)

- **Many sequential LLM calls in the map phase** — one per page (with current `PAGES_PER_CHUNK`). Each call awaits the previous; there is no parallelization at the controller level.
- **Guardian runs on every `analyzeTextWithUsage` call** by default. That means **each map chunk** and the **final validate** prompt are each pre-checked by a separate small-model invocation before the main model runs — roughly **double the orchestration work** (guardian + main) per step.

```570:581:server/src/ai/ai.service.ts
  async analyzeTextWithUsage(
    prompt: string,
    skipValidation: boolean = false,
    useJsonFormat: boolean = true,
  ): Promise<{ content: string; usage?: LlmUsage }> {
    if (!skipValidation) {
      const validation = await this.guardianService.validatePrompt(prompt);
      if (!validation.isSafe) {
        throw new BadRequestException(`Request rejected: ${validation.reason}`);
      }
    }
    return this.invokeModelRawWithUsage(prompt, useJsonFormat);
  }
```

- **Validate step is huge.** It includes the merged draft JSON **and** the entire `extractedText` for “MAIN VALIDATION GOAL,” so token count and latency spike on the last step; the UI exposes this as a single **validate** step with little sub-progress.
- **One prompt, many jobs.** That validate call simultaneously asks for deduplication, global ordering, metadata (`title` / `description`), and a line-by-line audit against the full PDF. Those objectives **compete for attention** inside one context; the model tends to satisfice on the easiest parts (e.g. heavy dedupe) and underperform on the hardest (exhaustive coverage vs. source).
- **Per-invoke timeout** defaults to **120 seconds** in `invokeModelRawWithUsage`. Large validate prompts can approach or hit that ceiling on slow providers or heavy documents.

## Net effect

Cost and latency scale roughly with **page count × (guardian + main)** plus **one very heavy** validate call, without granular progress inside that final phase — so it **feels** like the product “does not manage” verification/build as a first-class, observable pipeline.
