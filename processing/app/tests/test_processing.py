from uuid import uuid4

from app.deps import get_task_service
from app.main import app
from app.models import AnalysisTaskResult
from app.models import AnalysisTaskStatus
from fastapi.testclient import TestClient
from sqlmodel import UUID

client = TestClient(app)


def test_get_task_status():
    task_id = uuid4()

    def get_task_service_mock():
        class MockTaskService:
            def get_task_status_by_id(self, task_id):
                return AnalysisTaskStatus.NULL

        return MockTaskService()

    app.dependency_overrides[get_task_service] = get_task_service_mock

    response = client.get(f"/processing/task/{task_id}/status")

    assert response.status_code == 200
    assert response.json() == {
        "status": AnalysisTaskStatus.NULL.value,
        "task_id": str(task_id),
    }


def test_get_completed_task_file():
    local_task_id = uuid4()
    local_survey_id = uuid4()
    local_task_result = '{"ok":"true"}'

    class MockTaskService:
        def get_task_result_by_id(self, task_id: UUID) -> AnalysisTaskResult:
            if task_id != local_task_id:
                raise ValueError(f"Task with ID {task_id} not found")
            return AnalysisTaskResult(
                result=local_task_result,
                survey_id=local_survey_id,
                status=AnalysisTaskStatus.COMPLETED,
            )

    app.dependency_overrides[get_task_service] = lambda: MockTaskService()

    response = client.get(f"/processing/task/{local_task_id}/file")
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"]
        == f'attachment; filename="{local_survey_id}.json"'
    )
    print(response.headers)
    assert response.headers["content-type"] == "application/json"
    assert response.content == local_task_result.encode("utf-8")


def test_get_non_completed_task_file():
    local_task_id = uuid4()
    local_survey_id = uuid4()

    class MockTaskService:
        def get_task_result_by_id(self, task_id: UUID) -> AnalysisTaskResult:
            if task_id != local_task_id:
                raise ValueError(f"Task with ID {task_id} not found")
            return AnalysisTaskResult(
                result=None,
                survey_id=local_survey_id,
                status=AnalysisTaskStatus.NULL,
            )

    app.dependency_overrides[get_task_service] = lambda: MockTaskService()
    response = client.get(f"/processing/task/{local_task_id}/file")
    assert response.status_code == 404
    print(response.json())
