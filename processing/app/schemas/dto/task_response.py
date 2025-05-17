from datetime import datetime

from pydantic import UUID4
from pydantic import BaseModel

from app.models.task_status import TaskStatus


class TaskResponse(BaseModel):
    id: UUID4
    survey_id: UUID4
    created_at: datetime
    status: TaskStatus
