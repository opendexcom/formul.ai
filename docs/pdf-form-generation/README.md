# PDF → form generation: workflow and known limitations

This folder documents how **“create a form from a PDF”** works today (`POST /ai/generate-stream-from-document` and the Form Editor `AIFormChat` UI), and known product/engineering pain points. Each issue has its **own file** (see below).

## End-to-end flow (today)

1. **Client** (`AIFormChat`): user attaches a PDF and optional instructions, then calls `generate-stream-from-document` with multipart form data (`file`, `prompt`, `mode`, optional `currentForm`).
2. **Server** (`AiController.generateStreamFromDocument` in `server/src/ai/ai.controller.ts`):
   - Parses the PDF with `pdf2json`, builds one text string per page and a full `extractedText` concatenation.
   - **Map phase**: for each **page chunk**, sends an LLM prompt that includes only that chunk’s excerpt (plus rules and user prompt), expects JSON `{ sections: [...] }`, and collects results.
   - **Merge phase**: concatenates all chunk outputs into a single draft (`mergeMapResults`) — the backend itself notes that sections may **overlap or duplicate**.
   - **Validate / build phase**: one large LLM call whose job is to dedupe, order, set `title` / `description`, and cross-check the draft against the **full** `extractedText`, then output a flat `questions` list that is sanitized into the final form.

**Primary code:** `server/src/ai/ai.controller.ts` (chunk loop, merge, validate), `client/src/components/FormEditor/AIFormChat.tsx` (upload, stream, retry).

## Issue index

| # | Topic | File |
|---|--------|------|
| 1 | Repeated / table fields cut off (truncation, merge) | [issue-01-repeated-fields-truncation.md](./issue-01-repeated-fields-truncation.md) |
| 2 | Verification and build slow, poorly staged | [issue-02-verification-build-expensive.md](./issue-02-verification-build-expensive.md) |
| 3 | Retry loses PDF context (wrong endpoint) | [issue-03-retry-loses-pdf-context.md](./issue-03-retry-loses-pdf-context.md) |
| 4 | Very large forms (~130 questions) | [issue-04-large-forms-130-questions.md](./issue-04-large-forms-130-questions.md) |
| 5 | Monolithic prompts — need smaller, focused steps | [issue-05-monolithic-prompts.md](./issue-05-monolithic-prompts.md) |

## Summary table

| Symptom | Primary cause | Detail |
|--------|----------------|--------|
| Missing rows / repeated fields, especially in tables | Per-chunk **14k** truncation + single-page chunks | [Issue 1](./issue-01-repeated-fields-truncation.md) |
| Long “validate / build” wait | Sequential map + guardian + one mega validate | [Issue 2](./issue-02-verification-build-expensive.md) |
| Retry gives different / wrong behavior | Text-only retry, no file | [Issue 3](./issue-03-retry-loses-pdf-context.md) |
| ~130 questions: invalid JSON / missing tail | Single-shot output + huge validate prompt | [Issue 4](./issue-04-large-forms-130-questions.md) |
| Unfocused quality on big docs | One prompt, many jobs | [Issue 5](./issue-05-monolithic-prompts.md) |

These docs are **descriptive** (current behavior and pain points), not implementation specs. Engineering fixes are tracked separately.
