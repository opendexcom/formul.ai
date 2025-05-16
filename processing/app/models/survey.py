from pydantic import UUID4
from sqlmodel import Column, Field, Relationship, SQLModel, String

import uuid

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.survey_answer import SurveyAnswer


class Survey(SQLModel, table=True):
    __table_args__ = {"schema": "survey"}
    __tablename__ = "survey"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field()
    json_schema: str = Field(sa_column=Column("schema_json", String))
    answers: list["SurveyAnswer"] = Relationship(back_populates="survey")
