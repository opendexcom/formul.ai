from typing import Optional
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import UUID4

from app.main import app
from app.models.task import Task
from app.models.task_status import TaskStatus
from app.utils.exceptions import NotFoundError


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def local_task_id():
    return uuid4()


@pytest.fixture
def local_survey_id():
    return uuid4()


@pytest.fixture
def get_task_service_mock(local_task_id):
    created_task: dict[str, Optional[Task]] = {"task": None}

    def _mock():
        class MockTaskService:
            async def create_task(self, survey_id: UUID4, status: TaskStatus = TaskStatus.NULL) -> Task:
                task = Task(
                    id=local_task_id,
                    survey_id=survey_id,
                    status=status,
                )
                created_task["task"] = task
                return task

            async def get_task_by_id(self, task_id: UUID4) -> Task:
                if created_task["task"] is None or task_id != created_task["task"].id:
                    raise NotFoundError(f"Task with ID {task_id} not found")
                return created_task["task"]

            async def complete_task(self, task_id: UUID4, result: str) -> Task:
                if created_task["task"] is None or task_id != created_task["task"].id:
                    raise NotFoundError(f"Task with ID {task_id} not found")
                created_task["task"].status = TaskStatus.COMPLETED
                created_task["task"].result = {"mocked": result}
                return created_task["task"]

            async def update_task(self, task) -> Task:
                # Accept both Task and dict
                if isinstance(task, dict):
                    task = Task(**task)
                if created_task["task"] is None or task.id != created_task["task"].id:
                    raise NotFoundError(f"Task with ID {task.id} not found")
                created_task["task"] = task
                return task

        return MockTaskService()

    return _mock


@pytest.fixture
def get_analysis_service_mock():
    def _mock():
        class MockAnalysisService:
            async def start_survey_analysis(self, survey_data):
                return "mocked response"
            async def publish_survey_status(self, survey_id, status):
                pass
        return MockAnalysisService()
    return _mock


@pytest.fixture
def mocked_response():
    mocked_response = MagicMock()
    mocked_response.message.content = "mocked response"
    return mocked_response


@pytest.fixture
def mock_chat(mocked_response):
    return AsyncMock(return_value=mocked_response)


@pytest.fixture
def mock_client(mock_chat):
    mock_client = AsyncMock()
    mock_client.chat = mock_chat
    return mock_client


@pytest.fixture(autouse=True)
def mock_redis_publish(monkeypatch):
    mock = AsyncMock()
    monkeypatch.setattr('app.utils.redis_publisher.publish_survey_status', mock)
    monkeypatch.setattr('app.services.analysis_service.publish_survey_status', mock)

