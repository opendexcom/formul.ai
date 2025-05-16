from uuid import uuid4

from app.api.deps import get_task_service
from app.main import app
from app.models.task_ import Task
from app.models.task_status import TaskStatus
from fastapi.testclient import TestClient
from sqlmodel import UUID

client = TestClient(app)


def test_get_completed_task_file():
    local_task_id = uuid4()
    local_survey_id = uuid4()
    local_task_result = '{"ok":"true"}'

    class MockTaskService:
        async def get_task_by_id(self, task_id: UUID) -> Task:
            if task_id != local_task_id:
                raise ValueError(f"Task with ID {task_id} not found")
            return Task(
                result=local_task_result,
                survey_id=local_survey_id,
                status=TaskStatus.COMPLETED,
            )

    app.dependency_overrides[get_task_service] = lambda: MockTaskService()

    response = client.get(f"/tasks/{local_task_id}/file")
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"] == f'attachment; filename="{local_survey_id}.json"'
    )
    print(response.headers)
    assert response.headers["content-type"] == "application/json"
    assert response.content == local_task_result.encode("utf-8")


def test_get_non_completed_task_file():
    local_task_id = uuid4()
    local_survey_id = uuid4()

    class MockTaskService:
        async def get_task_by_id(self, task_id: UUID) -> Task:
            if task_id != local_task_id:
                raise ValueError(f"Task with ID {task_id} not found")
            return Task(
                result=None,
                survey_id=local_survey_id,
                status=TaskStatus.NULL,
            )

    app.dependency_overrides[get_task_service] = lambda: MockTaskService()
    response = client.get(f"/tasks/{local_task_id}/file")
    assert response.status_code == 404
    print(response.json())
