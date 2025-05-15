CREATE SCHEMA IF NOT EXISTS processing;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskstatus') THEN
    CREATE TYPE processing.taskstatus AS ENUM (
      'NULL',
      'IN_PROGRESS',
      'COMPLETED',
      'ERROR');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS processing.task (
    id uuid NOT NULL,
    survey_id uuid NOT NULL,
    created_at timestamp NOT NULL,
    status processing.taskstatus NOT NULL,
    "result" varchar NULL,
    CONSTRAINT task_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_processing_task_survey_id ON processing.task (survey_id);
