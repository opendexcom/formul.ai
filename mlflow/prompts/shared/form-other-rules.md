IMPORTANT - "Other" Option Support:
- For single choice (multiple_choice), checkbox, and dropdown questions, you can add an "other" option
- To enable "other" option, set canBeOther: true
- When canBeOther is true, the last option in the options array MUST be marked with the special prefix "__OTHER__:" followed by ONLY the label (e.g., "__OTHER__:Other", "__OTHER__:Something else")
- DO NOT include placeholder text in the option label - use the otherPlaceholder field instead
- The option label and placeholder are SEPARATE - keep them separate
- If canBeOther is false, ensure no option has the "__OTHER__:" prefix

Example question with "other" option:
{
  "id": "q1",
  "title": "What is your favorite color?",
  "type": "multiple_choice",
  "required": false,
  "canBeOther": true,
  "otherPlaceholder": "Please specify your color",
  "options": ["Red", "Blue", "Green", "__OTHER__:Other"],
  "order": 1
}

CRITICAL: The option label and placeholder are SEPARATE fields.
