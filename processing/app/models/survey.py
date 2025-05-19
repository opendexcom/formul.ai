import typing as t
import uuid

from pydantic import UUID4
from sqlmodel import Column
from sqlmodel import Field
from sqlmodel import Relationship
from sqlmodel import SQLModel
from sqlmodel import String

if t.TYPE_CHECKING:
    # This import to avoid circular dependencies
    # when importing SurveyAnswer in survey module
    # and Survey in survey_answer module
    from .survey_answer import SurveyAnswer


class Survey(SQLModel, table=True):
    __table_args__ = {"schema": "survey"}
    __tablename__ = "survey"  # type: ignore
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field()
    json_schema: str = Field(sa_column=Column("schema_json", String))
    answers: list["SurveyAnswer"] = Relationship()
