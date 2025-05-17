from functools import lru_cache

from fastapi import Depends
from ollama import AsyncClient
from sqlalchemy import Engine
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import Session

from app.core import config
from app.db.sessions import AsyncSessionFactory
from app.repository.survey_repository import SurveyRepository
from app.repository.task_repository import TaskRepository
from app.services.analysis_service import AnalysisService
from app.services.processing_service import ProcessingService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService


@lru_cache()
def get_settings() -> config.Settings:
    return config.from_env()


def get_db_engine(settings: config.Settings = Depends(get_settings)) -> AsyncEngine:
    postgres_url = settings.get_database_async_uri()
    engine = create_async_engine(postgres_url, pool_size=50, max_overflow=50, pool_pre_ping=True)
    return engine


def get_db_session_factory(
    engine: AsyncEngine = Depends(get_db_engine),
) -> AsyncSessionFactory:
    session_factory = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
    return session_factory


def get_db_session(engine: Engine = Depends(get_db_engine)):
    with Session(engine) as db_connection:
        yield db_connection


def get_ollama_client(settings: config.Settings = Depends(get_settings)) -> AsyncClient:
    ollama_api_url = str(settings.ollama_api_url)
    return AsyncClient(host=ollama_api_url)


def get_task_repository(
    session_factory: AsyncSessionFactory = Depends(get_db_session_factory),
) -> TaskRepository:
    return TaskRepository(session_factory=session_factory)


def get_survey_repository(
    session_factory: AsyncSessionFactory = Depends(get_db_session_factory),
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
