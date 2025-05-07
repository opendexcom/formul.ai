from typing import Optional
from uuid import UUID

from sqlalchemy.orm import joinedload

from app.db.sessions import AsyncSessionFactory
from app.models import Survey
from sqlmodel import select


class SurveyRepository:
    def __init__(self, session_factory: AsyncSessionFactory):
        self.session_factory = session_factory

    async def get_by_id(self, survey_id: UUID) -> Optional[Survey]:
        async with self.session_factory() as session:
            r = await session.execute(
                select(Survey).where(Survey.id == survey_id).options(joinedload(Survey.answers))
            )
            return r.unique().scalar_one_or_none()

    async def get_all(self) -> list[Survey]:
        async with self.session_factory() as session:
            rows = await session.execute(select(Survey))
            return list(rows.scalars())
