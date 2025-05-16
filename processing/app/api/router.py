from app.api.v1.endpoints import survey
from app.api.v1.endpoints import task
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(task.router, prefix="/tasks", tags=["task"])
api_router.include_router(survey.router, prefix="/surveys", tags=["survey"])
