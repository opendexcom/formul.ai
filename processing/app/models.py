import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlmodel import Field, SQLModel

class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = False

class StatusEnum(str, Enum):
    NULL = "null"
    PENDING = "pending"
    COMPLETED = "completed"
    ERROR = "error"

class AnalysisJob(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    survey_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: StatusEnum = Field(default="null") # "null" | "pending" | "completed" | "error"

