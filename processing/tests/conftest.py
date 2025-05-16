import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_task_service, get_analysis_service, get_survey_service
from app.models.survey import Survey
from app.models.task import Task
from app.models.task_status import TaskStatus
from app.utils.exceptions import NotFoundError
from pydantic import UUID4
from typing import Optional
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

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
def get_survey_service_mock(local_survey_id):
    def _mock():
        class MockSurveyService:
            async def get_survey_by_id(self, survey_id) -> Optional[Survey]:
                if survey_id != local_survey_id:
                    return None
                survey = Survey(
                    id=survey_id,
                    name="Test Survey",
                    json_schema="{}",
                    answers=[],
                )
                return survey
        return MockSurveyService()
    return _mock

@pytest.fixture
def get_task_service_mock(local_task_id):
    created_task = {'task': None}
    def _mock():
        class MockTaskService:
            async def create_task(self, survey_id: UUID4, status: TaskStatus = TaskStatus.NULL) -> Task:
                task = Task(
                    id=local_task_id,
                    survey_id=survey_id,
                    status=status,
                )
                created_task['task'] = task
                return task

            async def get_task_by_id(self, task_id: UUID4) -> Task:
                if created_task['task'] is None or task_id != created_task['task'].id:
                    raise NotFoundError(f"Task with ID {task_id} not found")
                return created_task['task']

            async def complete_task(self, job: Task, result: str) -> Task:
                if created_task['task'] is None or job.id != created_task['task'].id:
                    raise NotFoundError(f"Task with ID {job.id} not found")
                job.status = created_task['task'].status = TaskStatus.COMPLETED
                job.result = created_task['task'].result = result
                return job
        return MockTaskService()
    return _mock

@pytest.fixture
def get_analysis_service_mock():
    def _mock():
        class MockAnalysisService:
            async def start_survey_analysis(self, survey_data):
                return "mocked response"
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