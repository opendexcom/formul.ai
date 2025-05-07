from datetime import datetime

from app.models import TaskStatus
from pydantic import BaseModel
from pydantic import UUID4
from sqlmodel import Field


class AnalysisJobResponse(BaseModel):
    id: UUID4
    survey_id: UUID4
    created_at: datetime
    status: TaskStatus


class AnalysisTaskResult(BaseModel):
    result: str | None
    survey_id: UUID4
    status: TaskStatus


class ProcessSurveyRequest(BaseModel):
    survey_id: UUID4
    question: str
    answers: list[str]


class SurveyStatusReponse(BaseModel):
    id: UUID4
    survey_id: str
    created_at: datetime
    status: TaskStatus


class ProcessSurveyResponse(BaseModel):
    llm_response: str


class SurveyPointsSentimentBucket(BaseModel):
    """Sentiment bucket for survey points"""

    positive: list[str] = Field(description="List of positive points")
    negative: list[str] = Field(description="List of negative points")


class SurveyPoints(BaseModel):
    """Data that we want collect from llm as response"""

    frequent: SurveyPointsSentimentBucket = Field(description="List of frequent points")
    moderate: SurveyPointsSentimentBucket = Field(description="List of moderate points")
    occasional: SurveyPointsSentimentBucket = Field(description="List of occasional points")
