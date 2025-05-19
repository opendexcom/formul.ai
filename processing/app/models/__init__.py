from .survey import Survey
from .survey_answer import SurveyAnswer

# This is required for SQLModel to properly resolve defined relationships
Survey.model_rebuild()
SurveyAnswer.model_rebuild()
