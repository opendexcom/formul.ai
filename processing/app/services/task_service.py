from uuid import UUID

from app.models import AnalysisTask
from app.models import AnalysisTaskStatus
from app.repository.task_repository import TaskRepository


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository

    async def create_task(
        self, survey_id: UUID, status: AnalysisTaskStatus = AnalysisTaskStatus.NULL
    ) -> AnalysisTask:
        """Create a new analysis job in database"""
        job = AnalysisTask(survey_id=survey_id, status=status)
        await self.task_repository.create(job)
        return job

    def update_task(
        self, task: AnalysisTask
    ) :
        return self.task_repository.update(task)

    async def get_task_by_id(self, task_id: UUID) -> AnalysisTask:
        task = await self.task_repository.get_by_id(task_id)
        return task

    async def complete_task(self, job: AnalysisTask, result: str) -> AnalysisTask:
        """Update the status of an analysis job"""
        job.status = AnalysisTaskStatus.COMPLETED
        job.result = result
        await self.task_repository.update(job)
        return job

