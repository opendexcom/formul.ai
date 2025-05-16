from uuid import UUID

from app.models.Task import Task
from app.models.TaskStatus import TaskStatus
from app.repository.task_repository import TaskRepository


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository

    async def create_task(self, survey_id: UUID, status: TaskStatus = TaskStatus.NULL) -> Task:
        """Create a new analysis job in database"""
        job = Task(survey_id=survey_id, status=status)
        await self.task_repository.create(job)
        return job

    def update_task(self, task: Task):
        return self.task_repository.update(task)

    async def get_task_by_id(self, task_id: UUID) -> Task:
        task = await self.task_repository.get_by_id(task_id)
        return task

    async def complete_task(self, job: Task, result: str) -> Task:
        """Update the status of an analysis job"""
        job.status = TaskStatus.COMPLETED
        job.result = result
        await self.task_repository.update(job)
        return job
