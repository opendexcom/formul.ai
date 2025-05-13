import uuid
from datetime import datetime
from enum import StrEnum
from typing import Optional

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
    __table_args__ = {"schema": "processing"}
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    survey_id: UUID4 = Field(index=True)
    # TODO: parametrize default_factory depending on database engine (sync/async),
    # since async engine use only offset-naive datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    status: TaskStatus = Field(default=TaskStatus.NULL)
    result: Optional[str] | None = Field(default=None)


class Survey(SQLModel, table=True):
    __table_args__ = {"schema": "survey"}
    __tablename__ = "survey"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field()
    json_schema: str = Field(sa_column=Column("schema_json", String))
    answers: list["SurveyAnswer"] = Relationship(back_populates="survey")


class SurveyAnswer(SQLModel, table=True):
    __table_args__ = {"schema": "survey"}
    __tablename__ = "survey_answers"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    answers_json: str = Field(sa_column=Column("answers_json", String))

    survey_id: UUID4 = Field(foreign_key="survey.survey.id")
    survey: Optional["Survey"] = Relationship(back_populates="answers")
