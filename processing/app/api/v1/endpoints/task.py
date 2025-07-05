from io import BytesIO
import json

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from app.api.deps import get_task_service
from app.models.task_status import TaskStatus
from app.schemas.dto.task_response import TaskResponse
from app.services.task_service import TaskService

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


@router.get("/{task_id}/result", response_class=StreamingResponse)
async def get_task_result(task_id: UUID4, task_service: TaskService = Depends(get_task_service)):
    try:
        task = await task_service.get_task_by_id(task_id)
        if not task.status == TaskStatus.COMPLETED:
            raise HTTPException(status_code=404, detail=f"Task with ID {task_id} is not completed")

        if not task.result:
            raise HTTPException(status_code=404, detail=f"Task with ID {task_id} is completed but has no result")

        # Create a BytesIO stream with the result
        if isinstance(task.result, dict):
            result_bytes = BytesIO(json.dumps(task.result).encode("utf-8"))
        else:
            result_bytes = BytesIO(task.result.encode("utf-8"))
        
        # Return a streaming response with proper headers
        return StreamingResponse(
            result_bytes,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{task.survey_id}.json"'
            }
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")
