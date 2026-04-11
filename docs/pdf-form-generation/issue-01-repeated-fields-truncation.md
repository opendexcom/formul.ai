# Issue 1: Repeated questions (especially per section / per table row) get cut off

**Scope:** PDF → form pipeline (`generate-stream-from-document`).  
**Related:** [README](./README.md) · [Issue 5](./issue-05-monolithic-prompts.md) (prompt size)

## What users see

Tables or blocks where the PDF repeats the same question pattern for many rows or sub-items often come back **incomplete** — the model “stops early” or whole rows never appear.

## Why it happens (technical)

- **Hard cap on excerpt size.** Each map prompt only includes chunk text trimmed to `MAX_CHUNK_BODY_CHARS` (14 000 characters). Anything beyond that is replaced with a literal `[... excerpt truncated ...]` marker, so the model never sees the rest of that page.

```130:133:server/src/ai/ai.controller.ts
    const trimmed =
      text.length > MAX_CHUNK_BODY_CHARS
        ? `${text.slice(0, MAX_CHUNK_BODY_CHARS)}\n[... excerpt truncated ...]`
        : text;
```

- **One page per map call** (`PAGES_PER_CHUNK = 1`). Dense pages (many small rows, tight layout, or long repeated labels) pack a lot of structure into a single chunk; truncation then cuts **in the middle** of a repeating pattern, so row *N+1…* never reaches the model in the map phase.
- **Merge is append-only.** `mergeMapResults` stacks sections from each chunk; it does not repair truncation. The validate step is supposed to fix gaps using full text, but it is still one LLM pass over a very large prompt — it can miss subtle repeated rows, especially when the draft is already biased by truncated map output.

## Net effect

The pipeline is optimized for “small excerpt in → JSON out,” not for “arbitrarily long repeating grids on one page,” so **structural repetition is a known weak point**.
