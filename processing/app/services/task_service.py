from uuid import UUID

from app.models import AnalysisTask
from app.models import AnalysisTaskResult
from app.models import AnalysisTaskStatus
from app.repository.task_repository import TaskRepository


class TaskService:
    def __init__(self, task_repository: TaskRepository):
        self.task_repository = task_repository

    def create_task(
        self, survey_id: UUID, status: AnalysisTaskStatus = AnalysisTaskStatus.NULL
    ) -> AnalysisTask:
        """Create a new analysis job in database"""
        job = AnalysisTask(survey_id=survey_id, status=status)
        self.task_repository.create(job)
        return job

    def get_task_status_by_id(self, task_id: UUID) -> AnalysisTaskStatus:
        task = self.task_repository.get_status_by_id(task_id)
        return task.status

    def complete_task(self, job: AnalysisTask, result: str) -> AnalysisTask:
        """Update the status of an analysis job"""
        job.status = AnalysisTaskStatus.COMPLETED
        job.result = result
        self.task_repository.update(job)
        return job

    def get_task_result_by_id(self, task_id: UUID) -> AnalysisTaskResult:
        task = self.task_repository.get_status_by_id(task_id)
        return AnalysisTaskResult(
            result=task.result,
            survey_id=task.survey_id,
            status=task.status,
        )
