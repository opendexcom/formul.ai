import pytest
from unittest.mock import AsyncMock, MagicMock, ANY
from uuid import uuid4

from app.services.task_service import TaskService
from app.models.task import Task
from app.models.task_status import TaskStatus
from app.schemas.survey_points import FormAnalysis, Analysis, OverallSummary, NumericalSummary, SentimentDistribution
from app.schemas.dto.task_response import TaskResponse

@pytest.mark.asyncio
async def test_create_task_calls_repo_create():
    repo = AsyncMock()
    service = TaskService(repo)
    survey_id = uuid4()
    expected_task = Task(survey_id=survey_id, status=TaskStatus.NULL)
    repo.get_by_id.return_value = expected_task
    task = await service.create_task(survey_id)
    repo.create.assert_awaited_once()
    repo.get_by_id.assert_awaited_once()
    assert isinstance(task, TaskResponse)
    assert task.survey_id == survey_id
    assert task.status == TaskStatus.NULL

def test_update_task_calls_repo_update():
    repo = MagicMock()
    service = TaskService(repo)
    task = Task(survey_id=uuid4(), status=TaskStatus.NULL)
    service.update_task(task.model_dump())
    repo.update.assert_called_once_with(ANY)

@pytest.mark.asyncio
async def test_get_task_by_id_calls_repo_get_by_id():
    repo = AsyncMock()
    service = TaskService(repo)
    task_id = uuid4()
    expected_task = Task(survey_id=uuid4(), status=TaskStatus.NULL)
    repo.get_by_id.return_value = expected_task
    task = await service.get_task_by_id(task_id)
    repo.get_by_id.assert_awaited_once_with(task_id)
    assert isinstance(task, TaskResponse)
    assert task.id == expected_task.id
    assert task.survey_id == expected_task.survey_id
    assert task.status == expected_task.status
    assert task.created_at == expected_task.created_at

@pytest.mark.asyncio
async def test_complete_task_sets_status_and_result_and_updates():
    repo = AsyncMock()
    service = TaskService(repo)
    job = Task(survey_id=uuid4(), status=TaskStatus.NULL)  # Use a valid status
    repo.get_by_id.return_value = job
    # Create a minimal valid FormAnalysis object
    form_analysis = FormAnalysis(
        formId="test-form",
        analysis=Analysis(
            generatedAt="2023-01-01T00:00:00",
            model="test-model",
            summary=OverallSummary(
                overall="Test summary",
                strengths=[],
                areasForImprovement=[],
                recommendations=[],
                keyQuotes=[]
            ),
            numericalSummary=NumericalSummary(
                sentimentDistribution=SentimentDistribution(positive=1, neutral=0, negative=0),
                topicFrequencies=[],
                averageExperienceYears=None,
                mostMentionedTech=[]
            ),
            segmentation=[],
            questions=[]
        )
    )
    updated_task = await service.complete_task(job.id, form_analysis)
    assert updated_task.status == TaskStatus.COMPLETED
    assert updated_task.result is not None
    assert updated_task.result.get("formId") == "test-form"
    repo.update.assert_awaited_once_with(ANY)