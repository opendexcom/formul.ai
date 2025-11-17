from uuid import uuid4

import pytest

from app.api.deps import get_task_service
from app.main import app
from app.models.task import Task
from app.models.task_status import TaskStatus
from sqlmodel import UUID


@pytest.mark.usefixtures("client")
def test_get_completed_task_file(client):
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

    app.dependency_overrides = {}  # Ensure clean state before test
    app.dependency_overrides[get_task_service] = lambda: MockTaskService()

    response = client.get(f"/tasks/{local_task_id}/file")
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"] == f'attachment; filename="{local_survey_id}.json"'
    )
    assert response.headers["content-type"] == "application/json"
    assert response.content == local_task_result.encode("utf-8")
    app.dependency_overrides = {}  # Clean up after test

@pytest.mark.usefixtures("client")
def test_get_task_file_not_found(client):
    local_task_id = uuid4()

    class MockTaskService:
        async def get_task_by_id(self, task_id: UUID):
            raise ValueError("Task not found")

    app.dependency_overrides = {}
    app.dependency_overrides[get_task_service] = lambda: MockTaskService()

    response = client.get(f"/tasks/{local_task_id}/file")
    assert response.status_code == 404
    app.dependency_overrides = {}

@pytest.mark.usefixtures("client")
def test_get_completed_task_file_no_result(client):
    local_task_id = uuid4()
    local_survey_id = uuid4()

    class MockTaskService:
        async def get_task_by_id(self, task_id: UUID) -> Task:
            if task_id != local_task_id:
                raise ValueError(f"Task with ID {task_id} not found")
            return Task(
                result=None,
                survey_id=local_survey_id,
                status=TaskStatus.COMPLETED,
            )

    app.dependency_overrides = {}
    app.dependency_overrides[get_task_service] = lambda: MockTaskService()
    response = client.get(f"/tasks/{local_task_id}/file")
    assert response.status_code == 404
    assert "no result" in response.json()["detail"]
    app.dependency_overrides = {}

@pytest.mark.usefixtures("client")
def test_get_non_completed_task_file(client):
    local_task_id = uuid4()
    local_survey_id = uuid4()

    class MockTaskService:
        async def get_task_by_id(self, task_id: UUID) -> Task:
            if task_id != local_task_id:
                raise ValueError(f"Task with ID {task_id} not found")
            return Task(
                result=None,
                survey_id=local_survey_id,
                status=TaskStatus.NULL,  # Not COMPLETED
            )

    app.dependency_overrides = {}  # Ensure clean state before test
    app.dependency_overrides[get_task_service] = lambda: MockTaskService()
    response = client.get(f"/tasks/{local_task_id}/file")
    assert response.status_code == 404
    assert "not completed" in response.json()["detail"]
    app.dependency_overrides = {}  # Clean up after test