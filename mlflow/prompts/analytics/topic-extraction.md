CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no prose.

Task: Extract topics from {{responseCount}} survey responses using in-vivo coding.
Use ONLY the textual content provided. Focus on semantic themes across answers for each response.

Responses (only textual answers included, with a combinedText helper field):
{{responsesData}}

REQUIRED OUTPUT FORMAT (valid JSON object with "results" array):
{
  "results": [{
    "responseId": "string",
    "topics": [
      {
        "topic": "string",
        "inVivoCode": "string",
        "confidence": 0.0,
        "isPrimary": true
      }
    ]
  }]
}

RULES:
- Output MUST be valid JSON object (test with JSON.parse)
- Root must be an object with "results" array
- MUST include ALL {{responseCount}} responses in results array (one per response)
- Topics can be empty array [] if no clear topics found
- Do NOT include any text before or after the JSON
- Do NOT use markdown code blocks
- Do NOT add explanations
- Confidence must be between 0 and 1
- isPrimary must be boolean (true/false)
