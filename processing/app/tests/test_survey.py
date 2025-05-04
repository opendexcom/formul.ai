import sys
from datetime import timezone
from typing import Optional
from uuid import uuid4

from app.core.exceptions import NotFoundError
from app.deps import get_analysis_service
from app.deps import get_survey_service
from app.deps import get_task_service
from app.main import app
from app.models import AnalysisTask
from app.models import AnalysisTaskStatus
from app.models import PSurvey
from fastapi.testclient import TestClient
from pydantic import UUID4

client = TestClient(app)


def test_get_start_survey_analysis():
    local_task_id = uuid4()
    local_survey_id = uuid4()

    def get_survey_service_mock():
        class MockSurveyService:
            def get_survey_by_id(self, survey_id) -> Optional[PSurvey]:
                if survey_id != local_survey_id:
                    return None
                survey = PSurvey(
                    id=survey_id,
                    name="Test Survey",
                    schemaJson="{}",
                    # TODO: Add create answers and link with survey
                    answers=[],
                )
                return survey

        return MockSurveyService()

    created_task: AnalysisTask | None = None

    def get_task_service_mock():
        class MockTaskService:
            created_task: Optional[AnalysisTask] = None

            def create_task(
                self,
                survey_id: UUID4,
                status: AnalysisTaskStatus = AnalysisTaskStatus.NULL,
            ) -> AnalysisTask:
                task = AnalysisTask(
                    id=local_task_id,
                    survey_id=survey_id,
                    status=status,
                )
                nonlocal created_task
                created_task = task
                return task

            def complete_task(self, job: AnalysisTask, result: str) -> AnalysisTask:
                if created_task is None:
                    raise NotFoundError(f"Task with ID {job.id} not found")
                if job.id != created_task.id:
                    raise NotFoundError(f"Task with ID {job.id} not found")
                job.status = created_task.status = AnalysisTaskStatus.COMPLETED
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
    response = client.get(f"/surveys/{local_survey_id}/start")

    assert response.status_code == 200

    # how to check it more elegantly?
    assert response.json() == {
        "id": str(local_task_id),
        "status": AnalysisTaskStatus.IN_PROGRESS.value,
        "survey_id": str(local_survey_id),
        "created_at": created_task.created_at.astimezone(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
    }
