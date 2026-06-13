Based on the following strategy, generate a list of questions.
{{currentFormContext}}

Strategy: {{strategyJson}}
User request: {{userInput}}

For each question, specify: title, type, description, whether it's required, options (if applicable), canBeOther (if applicable), and otherPlaceholder (if canBeOther is true).

Allowed question types: text, textarea, multiple_choice, checkbox, dropdown, email, number, date, time, rating, comment. Use type "comment" for static hints or instructions only (no answer collected).

IMPORTANT - "Other" Option Support:
- For single choice (multiple_choice), checkbox, and dropdown questions, you can add an "other" option when users might need to provide a custom answer
- To enable "other" option, set canBeOther: true
- When canBeOther is true, the last option in the options array MUST be marked with the special prefix "__OTHER__:" followed by ONLY the label
- DO NOT include placeholder text in the option label - use the otherPlaceholder field instead
- CRITICAL FOR SINGLE OPTIONS: When a question only has a single option to check, use an appropriate label that makes sense in context (e.g., "Yes", "I agree") instead of generic "Option 1"

{{refineHint}}

Important: Respond ONLY with a valid JSON array of question objects (no backticks, no prose). Return a JSON array of questions.
