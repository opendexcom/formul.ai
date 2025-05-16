from app.models.task_status import TaskStatus


from pydantic import UUID4, BaseModel


from datetime import datetime


class TaskResponse(BaseModel):
    id: UUID4
    survey_id: UUID4
    created_at: datetime
    status: TaskStatus
