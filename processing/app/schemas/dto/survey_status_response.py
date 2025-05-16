from app.models.task_status import TaskStatus


from pydantic import UUID4, BaseModel


from datetime import datetime


class SurveyStatusResponse(BaseModel):
    id: UUID4
    survey_id: str
    created_at: datetime
    status: TaskStatus