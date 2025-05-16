from io import BytesIO

from app.utils import exceptions as api_exceptions
from app.api.deps import get_task_service
from app.models.task_status import TaskStatus
from app.schemas.dto.task_response import TaskResponse
from app.services.task_service import TaskService
from fastapi import APIRouter
from fastapi import Depends
from fastapi.responses import StreamingResponse
from pydantic import UUID4

router = APIRouter()


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
async def get_task(
    task_id: UUID4,
    task_service: TaskService = Depends(get_task_service),
):
    task = await task_service.get_task_by_id(task_id)

    return TaskResponse(
        id=task.id,
        survey_id=task.survey_id,
        created_at=task.created_at,
        status=task.status,
    )


@router.get("/{task_id}/file", response_class=StreamingResponse)
async def get_task_file(task_id: UUID4, task_service: TaskService = Depends(get_task_service)):
    task = await task_service.get_task_by_id(task_id)
    if not task.status == TaskStatus.COMPLETED:
        raise api_exceptions.FileNotFoundError(f"Task with ID {task_id} is not completed")

    if not task.result:
        raise api_exceptions.FileNotFoundError(f"Task with ID {task_id} is completed but has no result")

    file_content = task.result
    file_like = BytesIO(file_content.encode("utf-8"))
    return StreamingResponse(
        file_like,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{task.survey_id}.json"'},
    )
