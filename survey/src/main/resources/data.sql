-- public.survey definition

-- Drop table

-- DROP TABLE public.survey;

CREATE TABLE if not exists public.survey (
	id uuid NOT NULL,
	"name" varchar(255) NULL,
	schema_json text NULL,
	CONSTRAINT survey_pkey PRIMARY KEY (id)
);

-- public.survey_answers definition

-- Drop table

-- DROP TABLE public.survey_answers;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'survey_answers'
    ) THEN
        CREATE TABLE public.survey_answers (
	id uuid NOT NULL,
	answers_json varchar(255) NULL,
	survey_id uuid NULL,
	CONSTRAINT survey_answers_pkey PRIMARY KEY (id)
);
ALTER TABLE public.survey_answers ADD CONSTRAINT fkp02l4sqlckil64wrg194t9dbj FOREIGN KEY (survey_id) REFERENCES public.survey(id);

		    END IF;
END $$;


INSERT INTO survey(id, name, schema_json)
SELECT
    '23e4693c-3975-4d91-a2f2-190993043c1c',
    'Initial Survey',
    '{"title":"Feedback Form","type":"object","properties":{"roles":{"type":"array","title":"Co masz robić w projekcie?","items":{"type":"string","enum":["frontend","backend","devops","inne"]},"uniqueItems":true},"rating":{"type":"integer","title":"Jak oceniasz proces do tego momentu?","minimum":1,"maximum":10},"likes":{"type":"string","title":"Co Ci się podoba"},"improvements":{"type":"string","title":"Co byś poprawił?"}},"required":["roles","rating"]}'
      
WHERE NOT EXISTS (SELECT 1 FROM survey WHERE id = '23e4693c-3975-4d91-a2f2-190993043c1c');
