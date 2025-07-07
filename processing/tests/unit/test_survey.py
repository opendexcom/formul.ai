from app.api.deps import get_analysis_service
from app.api.deps import get_jwt_utils
from app.api.deps import get_survey_service
from app.api.deps import get_task_service
from app.main import app
from app.models.task_status import TaskStatus


def test_get_start_survey_analysis(
    client,
    local_task_id,
    local_survey_id,
    get_survey_service_mock,
    get_task_service_mock,
    get_analysis_service_mock,
):
    app.dependency_overrides = {}  # Ensure clean state before test
    app.dependency_overrides[get_task_service] = get_task_service_mock
    app.dependency_overrides[get_analysis_service] = get_analysis_service_mock
    app.dependency_overrides[get_survey_service] = get_survey_service_mock

# Removed unnecessary debug print statement and sys.stdout.flush()
    response = client.post(f"/surveys/{local_survey_id}/start",
                           headers={"Authorization": "Bearer "+get_jwt_utils().generate_jwt_token()})

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(local_task_id)
    assert data["status"] == TaskStatus.IN_PROGRESS.value
    assert data["survey_id"] == str(local_survey_id)
    assert "created_at" in data

    app.dependency_overrides = {}  # Clean up after test
