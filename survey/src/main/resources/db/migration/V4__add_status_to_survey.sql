-- Add status column to survey table

ALTER TABLE survey.survey 
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'NEW';

-- Add check constraint for valid status values
ALTER TABLE survey.survey 
ADD CONSTRAINT chk_survey_status 
CHECK (status IN ('NEW', 'ONGOING', 'UNDER_ANALYSIS', 'ANALYSIS_DONE', 'ANALYSIS_ERROR'));
