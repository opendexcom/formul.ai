from app.utils.exceptions import NotFoundError
from app.db.sessions import AsyncSessionFactory
from app.models.task_ import Task
from pydantic import UUID4


class TaskRepository:
    def __init__(self, session_factory: AsyncSessionFactory):
        self.session_factory = session_factory

    async def create(self, task: Task):
        async with self.session_factory() as session:
            session.add(task)
            await session.commit()

    async def update(self, task: Task) -> Task:
        async with self.session_factory() as session:
            session.add(task)
            await session.commit()
        return task

    async def get_by_id(self, task_id: UUID4) -> Task:
        async with self.session_factory() as session:
            task = await session.get(Task, task_id)
            if not task:
                raise NotFoundError(f"Task with ID {task_id} not found")
            return task
