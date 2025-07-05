import json
from fastapi import APIRouter
from fastapi import Depends
from pydantic import UUID4
import redis.asyncio as redis

from app.api.deps import get_task_service, get_redis
from app.models.task_status import TaskStatus
from app.schemas.dto.task_response import TaskResponse
from app.services.task_service import TaskService

router = APIRouter()


@router.post("/{survey_id}/start", response_model=TaskResponse)
async def start_survey_analysis(
    survey_id: UUID4,
    task_service: TaskService = Depends(get_task_service),
    redis_client: redis.Redis = Depends(get_redis),
):
    """Start asynchronous analysis of a survey"""
    # Create a task for this survey analysis
    task = await task_service.create_task(survey_id, TaskStatus.IN_PROGRESS)

    # use redis to start the analysis
    await redis_client.lpush("analysis_queue", json.dumps({"survey_id": str(survey_id), "task_id": str(task.id)}))
    
    response = TaskResponse(
        survey_id=task.survey_id,
        id=task.id,
        status=task.status,
        created_at=task.created_at,
    )
    
    
    return response
