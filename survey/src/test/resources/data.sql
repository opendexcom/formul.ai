

INSERT INTO survey.survey(id, name, schema_json)
SELECT
    '23e4693c-3975-4d91-a2f2-190993043c1c',
    'Initial Survey',
    '{"title":"Feedback Form","type":"object","properties":{"roles":{"type":"array","title":"Co masz robić w projekcie?","items":{"type":"string","enum":["frontend","backend","devops","inne"]},"uniqueItems":true},"rating":{"type":"integer","title":"Jak oceniasz proces do tego momentu?","minimum":1,"maximum":10},"likes":{"type":"string","title":"Co Ci się podoba"},"improvements":{"type":"string","title":"Co byś poprawił?"}},"required":["roles","rating"]}'
      
WHERE NOT EXISTS (SELECT 1 FROM survey.survey WHERE id = '23e4693c-3975-4d91-a2f2-190993043c1c');

INSERT INTO survey.survey(id, "name", schema_json)
SELECT 
    '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid, 
    'example', 
    '{"question":"This is question"}'

WHERE NOT EXISTS (SELECT 1 FROM survey.survey WHERE id = '6cb2588c-a93b-41fe-a4a3-9b08280f4e97');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT 'f926e252-0218-48c0-b519-02b987345134'::uuid,
'[
  { "question": "full_name", "answer": "Anna Kowalska" },
  { "question": "experience_level", "answer": "junior" },
  { "question": "interested_topics", "answer": ["frontend", "ai"] },
  { "question": "learning_goals", "answer": "Chcę nauczyć się Reacta i podstaw ML." }
]', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = 'f926e252-0218-48c0-b519-02b987345134');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '0d3085bd-73a6-4842-b54f-5967e8879f3b'::uuid,
'[
  { "question": "full_name", "answer": "John Smith" },
  { "question": "experience_level", "answer": "mid" },
  { "question": "interested_topics", "answer": ["backend", "ai"] },
  { "question": "learning_goals", "answer": "Zamierzam pogłębić znajomość Pythona i FastAPI." }
]', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '0d3085bd-73a6-4842-b54f-5967e8879f3b');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '4a058c38-af38-466f-b829-e4cf4aab6dd9'::uuid,
'[
  { "question": "full_name", "answer": "Lucia Fernández" },
  { "question": "experience_level", "answer": "senior" },
  { "question": "interested_topics", "answer": ["gamedev"] },
  { "question": "learning_goals", "answer": "Chcę stworzyć własną grę 2D w Unity." }
]', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '4a058c38-af38-466f-b829-e4cf4aab6dd9');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '9236655c-f645-4e6d-87da-f19590580d52'::uuid,
'[
  { "question": "full_name", "answer": "Tomasz Nowak" },
  { "question": "experience_level", "answer": "junior" },
  { "question": "interested_topics", "answer": ["frontend", "backend"] },
  { "question": "learning_goals", "answer": "Chcę nauczyć się budować aplikacje full-stack w JS." }
]', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '9236655c-f645-4e6d-87da-f19590580d52');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '6ea5220e-e0c8-45f5-b8f9-8e3eb4e52772'::uuid,
'[
  { "question": "full_name", "answer": "Zoe Müller" },
  { "question": "experience_level", "answer": "mid" },
  { "question": "interested_topics", "answer": ["ai"] },
  { "question": "learning_goals", "answer": "Eksploracja modeli językowych i ich zastosowań." }
]', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '6ea5220e-e0c8-45f5-b8f9-8e3eb4e52772');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT 'cd8e77bb-ea26-435e-abca-3c165faf22a0'::uuid,
'[
  { "question": "full_name", "answer": "Jakub Zieliński" },
  { "question": "experience_level", "answer": "junior" },
  { "question": "interested_topics", "answer": ["backend"] },
  { "question": "learning_goals", "answer": "Nauczyć się projektować REST API z uwzględnieniem bezpieczeństwa." }
]', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = 'cd8e77bb-ea26-435e-abca-3c165faf22a0');
