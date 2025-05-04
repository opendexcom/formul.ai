from io import BytesIO

from app.core.exceptions import FileNotFoundError
from app.deps import get_task_service
from app.services.task_service import TaskService
from fastapi import APIRouter
from fastapi import Depends
from fastapi.responses import StreamingResponse
from pydantic import UUID4


router = APIRouter(prefix="/processing", tags=["processing"])


@router.get("/task/{task_id}/status")
def get_task_status(
    task_id: UUID4, task_service: TaskService = Depends(get_task_service)
):
    task = task_service.get_task_status_by_id(task_id)
    return {"status": task.value, "task_id": str(task_id)}


@router.get("/task/{task_id}/file")
def get_task_file(
    task_id: UUID4, task_service: TaskService = Depends(get_task_service)
):
    task = task_service.get_task_result_by_id(task_id)
    if not task.result:
        raise FileNotFoundError(f"Task with ID {task_id} has no result")

    file_content = task.result
    file_like = BytesIO(file_content.encode("utf-8"))
    return StreamingResponse(
        file_like,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{task.survey_id}.json"'
        },
    )
