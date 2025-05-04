from app.api.routes import processing
from app.api.routes import survey
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(processing.router)
api_router.include_router(survey.router)
