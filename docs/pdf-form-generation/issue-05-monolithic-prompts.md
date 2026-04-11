# Issue 5: Prompts are too large — steps need smaller chunks and a single focus each

**Scope:** PDF → form pipeline design (map + validate + guardian).  
**Related:** [README](./README.md) · [Issue 2](./issue-02-verification-build-expensive.md) · [Issue 4](./issue-04-large-forms-130-questions.md)

## What we want

Each model call should answer **one clear question** (e.g. “extract fields from pages 10–12 only,” “list duplicate question titles in this draft,” “compare this section’s draft to this excerpt and return missing fields”). That keeps prompts within a comfortable context window, improves **reliability**, and maps cleanly to **SSE steps** the user can understand.

## What we have instead

- **Map prompts** repeat the full `documentFormRules` block, metadata, `mapJsonHint`, and user instructions on **every** page. That is correct for consistency but **redundant** and **long**; combined with a dense page excerpt it leaves less effective capacity for the actual extraction task.
- **Validate is a single mega-prompt:** merged draft + full `extractedText` + multiple goals in one instruction block. There is no intermediate step like “coverage report only” or “section-by-section reconcile” that could be reviewed or retried independently.
- **Guardian** receives the **entire** prompt string for map and validate (including long PDF text). That inflates validation cost and couples security checks to **bulk document content** instead of a short, user-authored intent line.

## Why splitting helps

Smaller prompts **reduce noise**, let you tune **temperature / model / max tokens** per step, make **failures localized** (retry just the failed segment), and let the UI show **meaningful progress** per sub-step instead of one opaque “validate” bar.

## Illustrative split (design target, not implemented)

For example: (1) extract per page or per page-window as today but with slimmer shared rules; (2) **structural merge** without full PDF (algorithmic where possible); (3) **dedupe** pass on draft only; (4) **coverage** passes over **slices** of `extractedText` with only the relevant draft subset; (5) final **assemble** + sanitize. Exact shape is a product/engineering decision; the point is **multiple narrow LLM steps** instead of **one do-everything call**.

## Net effect

Today’s workflow optimizes for **few round-trips** at the cost of **prompt bloat and unfocused steps**; for large PDFs and ~100+ fields, **splitting prompts into smaller chunks with one job each** is the main lever for both **quality** and **observability**.

## High-level fix directions (cross-cutting)

Smarter **chunking** for map and validate; **scoping or skipping Guardian** for trusted bulk excerpts while validating user intent separately; **resumable jobs** and **client-side PDF retention for retry**; **split validate** into section- or slice-based passes with incremental merge; **explicit output token limits** on steps that emit large JSON.
