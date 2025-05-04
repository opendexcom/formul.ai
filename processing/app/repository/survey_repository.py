from contextlib import AbstractContextManager
from typing import Callable
from typing import Optional
from uuid import UUID

from app.models import PSurvey
from sqlmodel import select
from sqlmodel import Session


class SurveyRepository:
    def __init__(self, session_factory: Callable[..., AbstractContextManager[Session]]):
        self.session_factory = session_factory

    def get_by_id(self, survey_id: UUID) -> Optional[PSurvey]:
        with self.session_factory() as session:
            # stmt = select(Survey).options(selectinload(cast(InstrumentedAttribute, Survey.answers))).where(Survey.id == survey_id)
            # result = session.execute(stmt).scalar_one_or_none()
            # result=session.execute(select(Survey))
            # return result
            r = session.exec(select(PSurvey).where(PSurvey.id == survey_id)).one()
            if r:
                print(r.answers)
            return r

    def get_all(self) -> list[PSurvey]:
        with self.session_factory() as session:
            return list(session.exec(select(PSurvey)).all())
