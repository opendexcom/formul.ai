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
