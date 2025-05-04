import uuid
from datetime import datetime
from datetime import timezone
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel
from pydantic import UUID4
from sqlmodel import Field
from sqlmodel import Relationship
from sqlmodel import SQLModel


class AnalysisTaskStatus(StrEnum):
    NULL = "null"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ERROR = "error"


# separate Task with answer into separate model? (AnalysisTaskCompleted with result:str + status:COMPLETED)
class AnalysisTask(SQLModel, table=True, schema="analysis_tasks"):
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    survey_id: UUID4 = Field(index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: AnalysisTaskStatus = Field(default=AnalysisTaskStatus.NULL)
    result: Optional[str] | None = Field(default=None)


class PSurvey(SQLModel, table=True):
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field()
    schemaJson: str = Field()
    answers: list["PSurveyAnswer"] = Relationship(back_populates="survey")


class PSurveyAnswer(SQLModel, table=True, schema="processing_survey_answers"):
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    answersJson: str = Field()

    survey_id: UUID4 = Field(foreign_key="psurvey.id")
    survey: Optional["PSurvey"] = Relationship(back_populates="answers")


class AnalysisJobResponse(BaseModel):
    id: UUID4
    survey_id: UUID4
    created_at: datetime
    status: AnalysisTaskStatus


class AnalysisTaskResult(BaseModel):
    result: str | None
    survey_id: UUID4
    status: AnalysisTaskStatus


class ProcessSurveyRequest(BaseModel):
    survey_id: UUID4
    question: str
    answers: list[str]


class SurveyStatusReponse(BaseModel):
    id: UUID4
    survey_id: str
    created_at: datetime
    status: AnalysisTaskStatus


class ProcessSurveyResponse(BaseModel):
    llm_response: str


class SurveyPointsSentimentBucket(BaseModel):
    """Sentiment bucket for survey points"""

    positive: list[str] = Field(description="List of positive points")
    negative: list[str] = Field(description="List of negative points")


class SurveyPoints(BaseModel):
    """Data that we want collect from user to get weather data"""

    frequent: SurveyPointsSentimentBucket = Field(description="List of frequent points")
    moderate: SurveyPointsSentimentBucket = Field(description="List of moderate points")
    occasional: SurveyPointsSentimentBucket = Field(
        description="List of occasional points"
    )
