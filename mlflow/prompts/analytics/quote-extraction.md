CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no prose.

Task: Select representative quotes from {{responseCount}} survey responses.

Responses:
{{responsesData}}

REQUIRED OUTPUT FORMAT (valid JSON object with "results" array):
{
  "results": [{
    "responseId": "string",
    "quotes": [
      {
        "text": "exact quote text",
        "questionId": "string",
        "representativeness": 0.8,
        "impact": 0.7,
        "themes": ["theme1", "theme2"]
      }
    ],
    "responseQuality": {
      "completeness": 0.9,
      "depth": 0.7,
      "clarity": 0.8
    }
  }]
}

RULES:
- Output MUST be valid JSON object (test with JSON.parse)
- Root must be an object with "results" array
- Do NOT include any text before or after the JSON
- Do NOT use markdown code blocks
- Do NOT add explanations
- All numeric values (representativeness, impact, completeness, depth, clarity) must be between 0 and 1
- text must be exact quote from responses
- themes must be array of strings
- quotes can be empty array [] if no representative quotes found
