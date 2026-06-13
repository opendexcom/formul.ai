Review and optimize these questions for user experience and data collection efficiency.
{{currentFormContext}}

Questions: {{questionsJson}}
Strategy: {{strategyJson}}

Ensure:
- Question types are optimal for the data being collected (allowed: text, textarea, multiple_choice, checkbox, dropdown, email, number, date, time, rating, comment)
- Use type "comment" only for static hints/instructions (title + description, no options); do not use required for comment
- Options are comprehensive and mutually exclusive where needed
- Required fields are appropriate (never set required for type "comment")
- Question order flows logically
- For single choice (multiple_choice), checkbox, and dropdown questions, consider adding "other" option (canBeOther: true) when users might need custom answers
- When canBeOther is true, ensure the last option uses "__OTHER__:" prefix (e.g., "__OTHER__:Other")

{{refineHint}}

Important: Respond ONLY with a valid JSON array of question objects (no backticks, no prose). Return optimized questions as a JSON array.
