from pydantic import UUID4
from pydantic import BaseModel


class AnalyzeSurveyData(BaseModel):
    survey_id: UUID4
    question: str
    answers: list[str]
