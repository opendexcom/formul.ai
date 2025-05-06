import sys
from datetime import timezone
from typing import Optional
from uuid import uuid4

from app.core.exceptions import NotFoundError
from app.deps import get_analysis_service
from app.deps import get_survey_service
from app.deps import get_task_service
from app.main import app
from app.models import Survey
from app.models import Task
from app.models import TaskStatus
from fastapi.testclient import TestClient
from pydantic import UUID4

client = TestClient(app)


def test_get_start_survey_analysis():
    local_task_id = uuid4()
    local_survey_id = uuid4()

    def get_survey_service_mock():
        class MockSurveyService:
            async def get_survey_by_id(self, survey_id) -> Optional[Survey]:
                if survey_id != local_survey_id:
                    return None
                survey = Survey(
                    id=survey_id,
                    name="Test Survey",
                    schemaJson="{}",
                    # TODO: Add create answers and link with survey
                    answers=[],
                )
                return survey

        return MockSurveyService()

    created_task: Task | None = None

    def get_task_service_mock():
        class MockTaskService:
            created_task: Optional[Task] = None

            async def create_task(
                self,
                survey_id: UUID4,
                status: TaskStatus = TaskStatus.NULL,
            ) -> Task:
                task = Task(
                    id=local_task_id,
                    survey_id=survey_id,
                    status=status,
                )
                nonlocal created_task
                created_task = task
                return task

            async def get_task_by_id(self, task_id: UUID4) -> Task:
                if created_task is None:
                    raise NotFoundError(f"Task with ID {task_id} not found")
                if task_id != created_task.id:
                    raise NotFoundError(f"Task with ID {task_id} not found")
                return created_task

            async def complete_task(self, job: Task, result: str) -> Task:
                if created_task is None:
                    raise NotFoundError(f"Task with ID {job.id} not found")
                if job.id != created_task.id:
                    raise NotFoundError(f"Task with ID {job.id} not found")
                job.status = created_task.status = TaskStatus.COMPLETED
                job.result = created_task.result = result
                return job

        return MockTaskService()

    def get_analysis_service_mock():

        class MockAnalysisService:
            async def start_survey_analysis(self, survey_data):
                return "mocked response"

        return MockAnalysisService()

    app.dependency_overrides[get_task_service] = get_task_service_mock
    app.dependency_overrides[get_analysis_service] = get_analysis_service_mock
    app.dependency_overrides[get_survey_service] = get_survey_service_mock

    print("Starting test_start_survey_analysis")
    sys.stdout.flush()
    response = client.post(f"/surveys/{local_survey_id}/start")

    assert response.status_code == 200

    # how to check it more elegantly?
    assert response.json() == {
        "id": str(local_task_id),
        "status": TaskStatus.IN_PROGRESS.value,
        "survey_id": str(local_survey_id),
        "created_at": created_task.created_at.isoformat(),
    }
