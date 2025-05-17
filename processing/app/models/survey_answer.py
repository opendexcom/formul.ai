import uuid
from typing import Optional

from pydantic import UUID4
from sqlmodel import Column
from sqlmodel import Field
from sqlmodel import Relationship
from sqlmodel import SQLModel
from sqlmodel import String

from app.models.survey import Survey


class SurveyAnswer(SQLModel, table=True):
    __table_args__ = {"schema": "survey"}
    __tablename__ = "survey_answers"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    answers_json: str = Field(sa_column=Column("answers_json", String))

    survey_id: UUID4 = Field(foreign_key="survey.survey.id")
    survey: Optional["Survey"] = Relationship(back_populates="answers")
