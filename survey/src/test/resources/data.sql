

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
    '{''question'':''This is question''}'

WHERE NOT EXISTS (SELECT 1 FROM survey.survey WHERE id = '6cb2588c-a93b-41fe-a4a3-9b08280f4e97');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT 'f926e252-0218-48c0-b519-02b987345134'::uuid, 'I like that we’re using real-world tools like Docker and microservices — good exposure. But honestly, coordination’s been messy. We need clearer ownership per service.', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = 'f926e252-0218-48c0-b519-02b987345134');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '0d3085bd-73a6-4842-b54f-5967e8879f3b'::uuid, 'It’s cool we’re blending multiple languages and tools, but context-switching between Java and Python is painful. Feels like overkill for a student project.', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '0d3085bd-73a6-4842-b54f-5967e8879f3b');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '4a058c38-af38-466f-b829-e4cf4aab6dd9'::uuid, 'I love how ambitious the project is, especially using AI for survey analysis — feels meaningful. But the team’s all over the place skill-wise, which slows things down.', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '4a058c38-af38-466f-b829-e4cf4aab6dd9');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '9236655c-f645-4e6d-87da-f19590580d52'::uuid, 'I like that we’re using GitHub seriously — issues, branches, pull requests. But half the team still doesn’t really know Git, which makes merges frustrating.', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '9236655c-f645-4e6d-87da-f19590580d52');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT '6ea5220e-e0c8-45f5-b8f9-8e3eb4e52772'::uuid, 'React frontend looks solid so far, props to whoever’s owning that. But we still haven’t nailed down our API contracts, and it’s breaking stuff constantly.', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = '6ea5220e-e0c8-45f5-b8f9-8e3eb4e52772');

INSERT INTO survey.survey_answers (id, answers_json, survey_id)
SELECT 'cd8e77bb-ea26-435e-abca-3c165faf22a0'::uuid, 'Cool idea and stack, but we probably should’ve picked one backend language. Java + Python + microservices = too many moving parts for a mostly newbie team.', '6cb2588c-a93b-41fe-a4a3-9b08280f4e97'::uuid
WHERE NOT EXISTS (SELECT 1 FROM survey.survey_answers WHERE id = 'cd8e77bb-ea26-435e-abca-3c165faf22a0');
