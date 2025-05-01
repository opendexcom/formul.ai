import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from sqlmodel import Field, SQLModel
from enum import StrEnum

class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = False


class StatusEnum(StrEnum):
    NULL = "null"
    PENDING = "pending"
    COMPLETED = "completed"
    ERROR = "error"

class AnalysisJob(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    survey_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: StatusEnum = Field(default=StatusEnum.NULL)

