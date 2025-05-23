import uuid
from datetime import datetime
from typing import Optional

from pydantic import UUID4
from sqlmodel import Column
from sqlmodel import Field
from sqlmodel import SQLModel
from sqlmodel import String

from .task_status import TaskStatus


class Task(SQLModel, table=True):
    __table_args__ = {"schema": "processing"}
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
    survey_id: UUID4 = Field(index=True)
    # TODO: parametrize default_factory depending on database engine (sync/async),
    # since async engine use only offset-naive datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    status: TaskStatus = Field(
        default=TaskStatus.NULL,
        sa_column=Column(
            String,
            nullable=False,
            default=TaskStatus.NULL,
        ),
    )
    result: Optional[str] = Field(default=None)
