import uuid
from datetime import datetime
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel
from pydantic import UUID4
from sqlmodel import Column
from sqlmodel import Field
from sqlmodel import Relationship
from sqlmodel import SQLModel
from sqlmodel import String


class TaskStatus(StrEnum):
    NULL = "null"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ERROR = "error"


# separate Task with answer into separate model? (AnalysisTaskCompleted with result:str + status:COMPLETED)
class Task(SQLModel, table=True):
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    survey_id: UUID4 = Field(index=True)
    # TODO: parametrize default_factory depending on database engine (sync/async),
    # since async engine use only offset-naive datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    status: TaskStatus = Field(default=TaskStatus.NULL)
    result: Optional[str] | None = Field(default=None)


class Survey(SQLModel, table=True):
    __tablename__ = "survey"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field()
    schemaJson: str = Field()
    answers: list["SurveyAnswer"] = Relationship(back_populates="survey")


class SurveyAnswer(SQLModel, table=True):
    __tablename__ = "survey_answers"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    answersJson: str = Field()

    survey_id: UUID4 = Field(foreign_key="survey.id")
    survey: Optional["Survey"] = Relationship(back_populates="answers")


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
    occasional: SurveyPointsSentimentBucket = Field(
        description="List of occasional points"
    )
