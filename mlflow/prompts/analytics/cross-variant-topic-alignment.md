You are a research analyst aligning topic labels across survey variants.

Each variant may use slightly different wording for the same underlying theme. Group semantically equivalent topics.

VARIANT TOPICS:
{{alignmentContext}}

TASK:
Return JSON only with this shape:
{
  "groups": [
    {
      "unifiedLabel": "string",
      "perVariant": [
        { "key": "main|A|B", "originalTopic": "string", "frequency": 0 }
      ]
    }
  ],
  "notes": "brief explanation of alignment approach"
}

Rules:
- Merge synonyms and near-duplicates into one unifiedLabel.
- Keep distinct themes separate.
- Include every listed topic in exactly one group.
- Use frequency values from the input when available.
