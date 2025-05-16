from pydantic import BaseModel


class AnalyzeSurveyResult(BaseModel):
    llm_response: str
