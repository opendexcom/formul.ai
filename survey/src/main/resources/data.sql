-- public.survey definition

-- Drop table

-- DROP TABLE public.survey;

-- Create schema if needed
CREATE SCHEMA IF NOT EXISTS survey AUTHORIZATION CURRENT_USER;

CREATE TABLE IF NOT EXISTS survey.survey (
	id uuid NOT NULL,
	"name" varchar(255) NULL,
	schema_json text NULL,
	CONSTRAINT survey_pkey PRIMARY KEY (id)
);

-- public.survey_answers definition

-- Drop table

-- DROP TABLE public.survey_answers;


CREATE TABLE IF NOT EXISTS survey.survey_answers (
    id uuid NOT NULL,
    answers_json varchar(255) NULL,
    survey_id uuid NULL,
    CONSTRAINT survey_answers_pkey PRIMARY KEY (id),
    CONSTRAINT survey__survey_answers_fkey FOREIGN KEY (survey_id) REFERENCES survey.survey(id)
);


INSERT INTO survey.survey(id, name, schema_json)
SELECT
    '23e4693c-3975-4d91-a2f2-190993043c1c',
    'Initial Survey',
    '{"title":"Feedback Form","type":"object","properties":{"roles":{"type":"array","title":"Co masz robić w projekcie?","items":{"type":"string","enum":["frontend","backend","devops","inne"]},"uniqueItems":true},"rating":{"type":"integer","title":"Jak oceniasz proces do tego momentu?","minimum":1,"maximum":10},"likes":{"type":"string","title":"Co Ci się podoba"},"improvements":{"type":"string","title":"Co byś poprawił?"}},"required":["roles","rating"]}'
      
WHERE NOT EXISTS (SELECT 1 FROM survey.survey WHERE id = '23e4693c-3975-4d91-a2f2-190993043c1c');
