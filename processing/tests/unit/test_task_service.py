import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.task_service import TaskService
from app.models.task import Task
from app.models.task_status import TaskStatus

@pytest.mark.asyncio
async def test_create_task_calls_repo_create():
    repo = AsyncMock()
    service = TaskService(repo)
    survey_id = uuid4()
    task = await service.create_task(survey_id)
    repo.create.assert_awaited_once()
    assert isinstance(task, Task)
    assert task.survey_id == survey_id
    assert task.status == TaskStatus.NULL

def test_update_task_calls_repo_update():
    repo = MagicMock()
    service = TaskService(repo)
    task = MagicMock()
    service.update_task(task)
    repo.update.assert_called_once_with(task)

@pytest.mark.asyncio
async def test_get_task_by_id_calls_repo_get_by_id():
    repo = AsyncMock()
    service = TaskService(repo)
    task_id = uuid4()
    expected_task = Task(survey_id=uuid4(), status=TaskStatus.NULL)
    repo.get_by_id.return_value = expected_task
    task = await service.get_task_by_id(task_id)
    repo.get_by_id.assert_awaited_once_with(task_id)
    assert task is expected_task

@pytest.mark.asyncio
async def test_complete_task_sets_status_and_result_and_updates():
    repo = AsyncMock()
    service = TaskService(repo)
    job = Task(survey_id=uuid4(), status=TaskStatus.NULL)  # Use a valid status
    result = '{"foo": "bar"}'
    updated_task = await service.complete_task(job, result)
    assert updated_task.status == TaskStatus.COMPLETED
    assert updated_task.result == result
    repo.update.assert_awaited_once_with(job)