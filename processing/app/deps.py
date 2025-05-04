from app.config import Settings
from app.repository.survey_repository import SurveyRepository
from app.repository.task_repository import TaskRepository
from app.services.analysis_service import AnalysisService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService
from ollama import AsyncClient
from sqlmodel import create_engine
from sqlmodel import Session


def get_database_engine():
    postgres_url = str(Settings().database.db_connection_url)
    engine = create_engine(postgres_url)
    return engine


def get_db_connection():
    engine = get_database_engine()
    with engine.begin() as db_connection:
        yield db_connection


def get_db_session():
    engine = get_database_engine()
    return Session(engine)


def get_ollama_client() -> AsyncClient:
    ollama_api_url = str(Settings().ollama_api_url)
    return AsyncClient(host=ollama_api_url)


def get_task_repository() -> TaskRepository:
    return TaskRepository(session_factory=get_db_session)


def get_task_service() -> TaskService:
    task_repository = get_task_repository()
    return TaskService(task_repository=task_repository)


def get_analysis_service() -> AnalysisService:
    ollama_client = get_ollama_client()
    return AnalysisService(ollama_client=ollama_client)


def get_survey_repository() -> SurveyRepository:
    return SurveyRepository(session_factory=get_db_session)


def get_survey_service() -> SurveyService:
    survey_repository = get_survey_repository()
    return SurveyService(survey_repository=survey_repository)
