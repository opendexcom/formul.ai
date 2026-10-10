# AI / LLM Configuration Guide

FormulAI talks to LLMs through a provider layer (`server/src/ai/llm-provider.*`).
Production default is **OpenAI** so existing deployments do not change until you
flip `LLM_PROVIDER`.

First-class providers:

| `LLM_PROVIDER` | Hosting | Typical use |
| --- | --- | --- |
| `openai` (default) | OpenAI platform (US) | Current production |
| `mistral` | Mistral La Plateforme **EU** (`https://api.eu.mistral.ai`) | GDPR / RODO path |
| `bedrock` | Amazon Bedrock in an **EU** region (`eu-central-1` default) | GDPR / RODO path with model choice (Nova, Claude, Llama, Mistral) |

`ollama` remains available for local development only.

Per-task overrides (apply to the **current** provider):

```env
LLM_MODEL_CHAT=          # form generation / chat
LLM_MODEL_ANALYSIS=      # analytics, document-to-form
LLM_MODEL_GUARDIAN=      # prompt-injection guardian
LLM_MODEL_EMBEDDING=     # only used when EMBEDDING_PROVIDER matches the LLM provider
```

`EMBEDDING_PROVIDER` is independent (`local` by default, already GDPR-safe).
Switching the chat provider does **not** automatically send embeddings off-box.

---

## 1. OpenAI (default)

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7
```

If only `OPENAI_MODEL` is set, chat / analysis / guardian all use that model
(this is today's production behaviour).

---

## 2. Mistral AI (EU endpoint)

```env
LLM_PROVIDER=mistral
MISTRAL_API_KEY=...
# Required for EU processing. api.mistral.ai does NOT guarantee EU residency.
MISTRAL_BASE_URL=https://api.eu.mistral.ai
# Optional per-task overrides. Defaults: Small for chat/guardian, Medium for analysis.
# LLM_MODEL_CHAT=mistral-small-latest
# LLM_MODEL_ANALYSIS=mistral-medium-latest
# LLM_MODEL_GUARDIAN=mistral-small-latest
# MISTRAL_MODEL=mistral-small-latest
```

Embeddings (optional; default remains local):

```env
EMBEDDING_PROVIDER=mistral
MISTRAL_EMBEDDING_MODEL=mistral-embed
LLM_EMBEDDING_DIMENSION=1024
```

Changing embedding dimension invalidates the Redis semantic-cache HNSW index
and topic-vector store. Flush `llmcache:*` and rebuild analytics after a switch.

### Account settings that are **not** in code

1. **Zero Data Retention (ZDR)** must be enabled on the Mistral account / org
   in the La Plateforme console. There is no API flag we can set per request.
   Without ZDR, prompts may be eligible for service improvement retention even
   on the EU endpoint.
2. Sign a **DPA** with Mistral before sending respondent PII.
3. Add Mistral to the public **subprocessor list** (and Terms / Privacy) before
   paid launch.

EU endpoint documentation: https://docs.mistral.ai/deployment/cloud/eu

---

## 3. AWS Bedrock (EU region, Converse API)

Chat / analysis / guardian use LangChain `ChatBedrockConverse` (Bedrock
**Converse** / **ConverseStream**) so tool use and structured output work the
same way across Amazon Nova, Anthropic Claude, Meta Llama, and Mistral models
on Bedrock.

```env
LLM_PROVIDER=bedrock
# Default eu-central-1. Override with BEDROCK_REGION or AWS_REGION.
BEDROCK_REGION=eu-central-1
# Defaults (EU geo inference profiles — data stays in the EU):
#   chat      eu.amazon.nova-lite-v1:0
#   analysis  eu.amazon.nova-pro-v1:0
#   guardian  eu.amazon.nova-micro-v1:0
# LLM_MODEL_CHAT=eu.amazon.nova-lite-v1:0
# LLM_MODEL_ANALYSIS=eu.anthropic.claude-sonnet-4-5-20250929-v1:0
# LLM_MODEL_GUARDIAN=eu.amazon.nova-micro-v1:0
# BEDROCK_MODEL=eu.amazon.nova-lite-v1:0
```

Credentials: standard AWS SDK default chain — `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` (/ `AWS_SESSION_TOKEN`), `AWS_PROFILE`, web identity,
or an instance / task / IRSA role. Do **not** hard-code keys.

### Embeddings on Bedrock (eu-central-1, verified 2026-10-10)

| Model | ID | In-region Frankfurt | Geo profile | Dim | Polish |
| --- | --- | --- | --- | --- | --- |
| Titan Text Embeddings V2 | `amazon.titan-embed-text-v2:0` | Yes | Not supported (in-region only) | 1024 (256/512 optional) | OK |
| Cohere Embed Multilingual v3 | `cohere.embed-multilingual-v3` | Yes | Not supported | 1024 | Better for Polish |
| Cohere Embed v4 | `cohere.embed-v4:0` | Profile-only in some regions | Check console | varies | Verify before use |

```env
EMBEDDING_PROVIDER=bedrock
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
# Prefer for Polish semantic cache / clustering:
# BEDROCK_EMBEDDING_MODEL=cohere.embed-multilingual-v3
LLM_EMBEDDING_DIMENSION=1024
```

Titan V2 and Cohere Embed Multilingual v3 are **in-region** in `eu-central-1`
and do not use cross-region inference profiles
([Titan V2 card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-titan-text-embeddings-v2.html),
[Cohere Embed Multilingual](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-cohere-embed-multilingual.html)).
Re-check the Bedrock console if you change region.

### Cross-region inference profiles

IDs starting with `eu.` (e.g. `eu.amazon.nova-pro-v1:0`,
`eu.anthropic.claude-3-haiku-20240307-v1:0`) are **EU geo** profiles: AWS may
route to another *EU* Bedrock region for capacity, but not outside the EU.
Do **not** use `us.*` or `global.*` profiles if GDPR residency is required.
Source-region pricing and CloudWatch/CloudTrail stay in the calling region.
See [inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html).

### Enable model access

In the AWS console: **Amazon Bedrock → Bedrock configurations → Model access**
for `eu-central-1`. Request / enable every foundation model you will invoke
(Nova, Claude, Llama, Mistral, Titan Embed, Cohere Embed). New accounts start
with none enabled. Inference-profile IDs still require the underlying model
to be enabled.

### IAM

The runtime identity needs Converse **and** InvokeModel (embeddings still use
`InvokeModel`; some LangChain paths also call InvokeModelWithResponseStream).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockConverseAndInvokeInEuCentral1",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Converse",
        "bedrock:ConverseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:eu-central-1::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/amazon.nova-pro-v1:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/amazon.nova-micro-v1:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/amazon.titan-embed-text-v2:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/cohere.embed-multilingual-v3",
        "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/mistral.mistral-large-2407-v1:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/meta.llama3-3-70b-instruct-v1:0",
        "arn:aws:bedrock:eu-central-1:*:inference-profile/eu.amazon.nova-lite-v1:0",
        "arn:aws:bedrock:eu-central-1:*:inference-profile/eu.amazon.nova-pro-v1:0",
        "arn:aws:bedrock:eu-central-1:*:inference-profile/eu.amazon.nova-micro-v1:0",
        "arn:aws:bedrock:eu-central-1:*:inference-profile/eu.anthropic.claude-3-haiku-20240307-v1:0"
      ]
    }
  ]
}
```

Trim the Resource list to the models you actually enable. Foundation-model
ARNs are account-less (`::foundation-model/...`); inference-profile ARNs are
account-scoped.

Also sign a **DPA** with AWS and list Bedrock as a subprocessor before launch.

---

## 4. Ollama (local / dev)

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

---

## Quality / cost comparison harness

From `oss-core/server`:

```bash
OPENAI_API_KEY=... MISTRAL_API_KEY=... \
  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=eu-central-1 \
  pnpm compare:providers
```

Runs the same Polish sample survey through combined analysis + executive
summary on every configured provider / model. Missing credentials skip that
provider; results are never invented. Pricing citations are printed in the
report (`https://platform.openai.com/docs/pricing`,
`https://docs.mistral.ai/inference/pricing`,
`https://aws.amazon.com/bedrock/pricing/`, retrieved 2026-10-10).

Optional model lists:

```env
COMPARE_MODELS_OPENAI=gpt-4o-mini,gpt-4o
COMPARE_MODELS_MISTRAL=mistral-small-latest,mistral-medium-latest
COMPARE_MODELS_BEDROCK=eu.amazon.nova-lite-v1:0,eu.amazon.nova-pro-v1:0
COMPARE_OUTPUT=/tmp/provider-compare.json
```

---

## Switching back

```env
LLM_PROVIDER=openai
```

Restart API + worker. If you also changed `EMBEDDING_PROVIDER` or
`LLM_EMBEDDING_DIMENSION`, flush the semantic cache and re-run analytics.

---

## Known risks

| Risk | Notes |
| --- | --- |
| JSON schema adherence | OpenAI `json_object` / `withStructuredOutput` is the current contract. Mistral has JSON mode; Bedrock Converse has no `json_object` — analytics rely on the prompt contract + parse, and form generation uses `withStructuredOutput` (Converse `toolConfig`). |
| Tokenizer / quotas | Plan limits are raw token counts from the provider. Mistral / Bedrock tokens ≠ OpenAI tokens, so the same text can consume a different share of a token quota. |
| Embedding dimension | OpenAI 1536, Mistral / Titan / Cohere 1024, local 384. Index invalidation required on change. |
| Polish quality | Empirically compare with `pnpm compare:providers` before flipping production. |
| Multimodal PDF file blocks | `buildMessagesWithDocument` uses OpenAI file parts. EE document-to-form already extracts text first, so Bedrock/Mistral are fine for that path. |
| Voice | No transcription / realtime path exists in this repo. Voxtral (Mistral) or Bedrock Nova Sonic would be new work. |
