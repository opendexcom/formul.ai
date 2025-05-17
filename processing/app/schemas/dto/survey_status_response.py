from datetime import datetime

from pydantic import UUID4, BaseModel

from app.models.task_status import TaskStatus


class SurveyStatusResponse(BaseModel):
    id: UUID4
    survey_id: str
    created_at: datetime
    status: TaskStatus
