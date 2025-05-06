from app.core.exceptions import NotFoundError
from app.db.sessions import AsyncSessionFactory
from app.models import AnalysisTask
from pydantic import UUID4


class TaskRepository:
    def __init__(self, session_factory: AsyncSessionFactory):
        self.session_factory = session_factory

    async def create(self, task: AnalysisTask):
        async with self.session_factory() as session:
            session.add(task)
            await session.commit()

    async def update(self, task: AnalysisTask)->AnalysisTask:
        async with self.session_factory() as session:
            session.add(task)
            await session.commit()
        return task

    async def get_by_id(self, task_id: UUID4) -> AnalysisTask:
        async with self.session_factory() as session:
            task = await session.get(AnalysisTask, task_id)
            if not task:
                raise NotFoundError(f"Task with ID {task_id} not found")
            return task
