from uuid import UUID
import json

from app.models.task import Task
from app.models.task_status import TaskStatus
from app.repository.task_repository import TaskRepository
from app.schemas.survey_points import FormAnalysis
from app.schemas.dto.task_response import TaskResponse


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository

    async def create_task(self, survey_id: UUID, status: TaskStatus = TaskStatus.NULL) -> TaskResponse:
        """Create a new analysis job in database"""
        job = Task(survey_id=survey_id, status=status)
        async with self.task_repository.session_factory() as session:
            session.add(job)
            await session.commit()
            await session.refresh(job)  # This ensures job.id and other fields are loaded
            # Now you can safely access job.id, job.survey_id, etc.
            return TaskResponse(
                id=job.id,
                survey_id=job.survey_id,
                created_at=job.created_at,
                status=job.status,
                result=getattr(job, 'result', None)
            )

    def update_task(self, task: dict):
        taskObject = Task(**task)
        return self.task_repository.update(taskObject)

    async def get_task_by_id(self, task_id: UUID) -> TaskResponse:
        job = await self.task_repository.get_by_id(task_id)
        return TaskResponse(
            id=job.id,
            survey_id=job.survey_id,
            created_at=job.created_at,
            status=job.status,
            result=getattr(job, 'result', None)
        )

    async def complete_task(self, task_id: UUID, result: FormAnalysis) -> TaskResponse:
        """Update the status of an analysis job and save FormAnalysis as JSON in the database"""
        job = await self.task_repository.get_by_id(task_id)
        job.status = TaskStatus.COMPLETED
        job.result = result.model_dump(mode="json")
        await self.task_repository.update(job)
        return TaskResponse(
            id=job.id,
            survey_id=job.survey_id,
            created_at=job.created_at,
            status=job.status,
            result=job.result
        )
