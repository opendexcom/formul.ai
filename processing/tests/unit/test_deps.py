from ollama import AsyncClient
from unittest.mock import patch, MagicMock

from app.api import deps
from app.core.config import Settings
from app.repository.survey_repository import SurveyRepository
from app.repository.task_repository import TaskRepository
from app.services.analysis_service import AnalysisService
from app.services.processing_service import ProcessingService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService

def test_get_settings_returns_settings():
    s = deps.get_settings()
    assert isinstance(s, Settings)

@patch("app.api.deps.create_async_engine")
def test_get_db_engine_returns_engine(mock_create_engine):
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    settings = MagicMock()
    settings.database.db_connection_url = "postgresql+asyncpg://user:pass@localhost/db"
    engine = deps.get_db_engine(settings)
    assert engine == mock_engine

@patch("app.api.deps.async_sessionmaker")
def test_get_db_session_factory_returns_factory(mock_sessionmaker):
    mock_factory = MagicMock()
    mock_sessionmaker.return_value = mock_factory
    engine = MagicMock()
    factory = deps.get_db_session_factory(engine)
    assert factory == mock_factory

@patch("app.api.deps.Session")
def test_get_db_session_yields_session(mock_session):
    engine = MagicMock()
    mock_ctx = MagicMock()
    mock_session.return_value.__enter__.return_value = mock_ctx
    gen = deps.get_db_session(engine)
    session = next(gen)
    assert session == mock_ctx

def test_get_ollama_client_returns_client():
    settings = MagicMock()
    settings.ollama_api_url = "http://localhost:11434"
    client = deps.get_ollama_client(settings)
    assert isinstance(client, AsyncClient)

def test_get_task_repository_returns_repo():
    factory = MagicMock()
    repo = deps.get_task_repository(factory)
    assert isinstance(repo, TaskRepository)

def test_get_survey_repository_returns_repo():
    factory = MagicMock()
    repo = deps.get_survey_repository(factory)
    assert isinstance(repo, SurveyRepository)

def test_get_task_service_returns_service():
    repo = MagicMock()
    service = deps.get_task_service(repo)
    assert isinstance(service, TaskService)

def test_get_survey_service_returns_service():
    repo = MagicMock()
    service = deps.get_survey_service(repo)
    assert isinstance(service, SurveyService)

def test_get_analysis_service_returns_service():
    client = MagicMock()
    service = deps.get_analysis_service(client)
    assert isinstance(service, AnalysisService)

def test_get_processing_service_returns_service():
    task_service = MagicMock()
    analysis_service = MagicMock()
    survey_service = MagicMock()
    service = deps.get_processing_service(task_service, analysis_service, survey_service)
    assert isinstance(service, ProcessingService)