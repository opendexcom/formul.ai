from contextlib import AbstractContextManager
from typing import Callable

from app.core.exceptions import DuplicatedError
from app.models import AnalysisTask
from pydantic import UUID4
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session


class TaskRepository:
    def __init__(self, session_factory: Callable[..., AbstractContextManager[Session]]):
        self.session_factory = session_factory

    def create(self, task: AnalysisTask) -> AnalysisTask:
        with self.session_factory() as session:
            try:
                session.add(task)
                session.commit()
                session.refresh(task)
            except IntegrityError as e:
                raise DuplicatedError(detail=str(e.orig))
            return task

    def update(self, task: AnalysisTask) -> AnalysisTask:
        with self.session_factory() as session:
            session.add(task)
            session.commit()
            session.refresh(task)
            return task

    def get_status_by_id(self, task_id: UUID4) -> AnalysisTask:
        with self.session_factory() as session:
            task = session.get(AnalysisTask, task_id)
            if not task:
                raise ValueError(f"Task with ID {task_id} not found")
            return task
