import typing as t
from functools import lru_cache

from fastapi import Depends
from ollama import AsyncClient

from app.core import config
from app.db.sessions import AsyncSession
from app.db.sessions import AsyncSessionFactory
from app.db.sessions import AsyncSessionFactoryType
from app.db.sessions import get_async_engine
from app.db.sessions import get_async_session_factory
from app.repository.survey_repository import SurveyRepository
from app.repository.task_repository import TaskRepository
from app.services.analysis_service import AnalysisService
from app.services.processing_service import ProcessingService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService


@lru_cache()
def get_settings() -> config.Settings:
    return config.Settings.from_env()


def get_db_session_factory(settings: config.Settings = Depends(get_settings)) -> AsyncSessionFactory:
    return get_async_session_factory(get_async_engine(settings.database))


async def get_db_session(factory: AsyncSessionFactoryType = Depends(get_db_session_factory)):
    session: t.Optional[AsyncSession] = None
    try:
        session = factory()
        yield session
    finally:
        if session is not None:
            await session.close()


def get_ollama_client(settings: config.Settings = Depends(get_settings)) -> AsyncClient:
    ollama_api_url = str(settings.ollama_api_url)
    return AsyncClient(host=ollama_api_url)


def get_task_repository(
    session_factory: AsyncSessionFactoryType = Depends(get_db_session_factory),
) -> TaskRepository:
    return TaskRepository(session_factory=session_factory)


def get_survey_repository(
    session_factory: AsyncSessionFactoryType = Depends(get_db_session_factory),
) -> SurveyRepository:
    return SurveyRepository(session_factory=session_factory)


def get_task_service(
    repo: TaskRepository = Depends(get_task_repository),
) -> TaskService:
    return TaskService(task_repository=repo)


def get_survey_service(
    repo: SurveyRepository = Depends(get_survey_repository),
) -> SurveyService:
    return SurveyService(survey_repository=repo)


def get_analysis_service(
    ollama_client: AsyncClient = Depends(get_ollama_client),
) -> AnalysisService:
    return AnalysisService(ollama_client=ollama_client)


def get_processing_service(
    task_service: TaskService = Depends(get_task_service),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    survey_service: SurveyService = Depends(get_survey_service),
) -> ProcessingService:
    return ProcessingService(task_service, analysis_service, survey_service)
