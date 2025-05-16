from datetime import datetime

from app.models.TaskStatus import TaskStatus
from pydantic import BaseModel
from pydantic import UUID4
from sqlmodel import Field


class TaskResponse(BaseModel):
    id: UUID4
    survey_id: UUID4
    created_at: datetime
    status: TaskStatus


class AnalyzeSurveyData(BaseModel):
    survey_id: UUID4
    question: str
    answers: list[str]


class AnalyzeSurveyResult(BaseModel):
    llm_response: str


class SurveyStatusReponse(BaseModel):
    id: UUID4
    survey_id: str
    created_at: datetime
    status: TaskStatus


# currently it is not decided what llm return format we want
class SurveyPointsSentimentBucket(BaseModel):
    """Sentiment bucket for survey points"""

    positive: list[str] = Field(description="List of positive points")
    negative: list[str] = Field(description="List of negative points")


class SurveyPoints(BaseModel):
    """Data that we want collect from llm as response"""

    frequent: SurveyPointsSentimentBucket = Field(description="List of frequent points")
    moderate: SurveyPointsSentimentBucket = Field(description="List of moderate points")
    occasional: SurveyPointsSentimentBucket = Field(description="List of occasional points")
