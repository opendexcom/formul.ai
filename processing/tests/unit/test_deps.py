from unittest.mock import MagicMock

from ollama import AsyncClient

from app.api import deps
from app.repository.task_repository import TaskRepository
from app.services.analysis_service import AnalysisService
from app.services.task_service import TaskService


def test_get_ollama_client_returns_client():
    settings = MagicMock()
    settings.ollama_api_url = "http://localhost:11434"
    client = deps.get_ollama_client(settings)
    assert isinstance(client, AsyncClient)


def test_get_task_repository_returns_repo():
    factory = MagicMock()
    repo = deps.get_task_repository(factory)
    assert isinstance(repo, TaskRepository)


def test_get_task_service_returns_service():
    repo = MagicMock()
    service = deps.get_task_service(repo)
    assert isinstance(service, TaskService)


def test_get_analysis_service_returns_service():
    client = MagicMock()
    settings = MagicMock()
    settings.mcp_server_url = "http://localhost:8080/sse"
    service = deps.get_analysis_service(client, settings)
    assert isinstance(service, AnalysisService)

