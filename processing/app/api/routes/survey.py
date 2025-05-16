from app.deps import get_processing_service
from app.schemas.dto.TaskResponse import TaskResponse
from app.services.processing_service import ProcessingService
from fastapi import APIRouter
from fastapi import BackgroundTasks
from fastapi import Depends
from pydantic import UUID4

router = APIRouter()


@router.post("/{survey_id}/start", response_model=TaskResponse)
async def start_survey_analysis(
    survey_id: UUID4,
    background_tasks: BackgroundTasks,
    processing_service: ProcessingService = Depends(get_processing_service),
):
    """Start asynchronous analysis of a survey"""
    response, worker = await processing_service.start_survey_async_analysis(survey_id)
    background_tasks.add_task(worker)
    return response
