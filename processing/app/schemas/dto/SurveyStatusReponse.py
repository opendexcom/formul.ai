from app.models.TaskStatus import TaskStatus


from pydantic import UUID4, BaseModel


from datetime import datetime


class SurveyStatusReponse(BaseModel):
    id: UUID4
    survey_id: str
    created_at: datetime
    status: TaskStatus