-- Migration: Change schema_json column type from text to jsonb

ALTER TABLE survey.survey
    ALTER COLUMN schema_json TYPE jsonb
    USING schema_json::jsonb;

ALTER TABLE survey.survey_answers
    ALTER COLUMN answers_json TYPE jsonb
    USING answers_json::jsonb;