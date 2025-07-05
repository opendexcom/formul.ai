import typing as t
from functools import lru_cache
import os

from fastapi import Depends
from ollama import AsyncClient
import redis.asyncio as redis

from app.core import config
from app.db.sessions import AsyncSession
from app.db.sessions import AsyncSessionFactoryType
from app.db.sessions import get_async_engine
from app.db.sessions import get_async_session_factory
from app.repository.task_repository import TaskRepository
from app.services.analysis_service import AnalysisService
from app.services.task_service import TaskService


@lru_cache()
def get_settings() -> config.Settings:
    return config.Settings.from_env()


def get_db_session_factory(settings: config.Settings = Depends(get_settings)) -> AsyncSessionFactoryType:
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


def get_task_service(
    repo: TaskRepository = Depends(get_task_repository),
) -> TaskService:
    return TaskService(task_repository=repo)


def get_analysis_service(
    ollama_client: AsyncClient = Depends(get_ollama_client),
    settings: config.Settings = Depends(get_settings),
) -> AnalysisService:
    return AnalysisService(ollama_client=ollama_client, mcp_server_url=settings.mcp_server_url)


async def get_redis() -> redis.Redis:
    host = os.getenv("REDIS_HOST", "redis")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = int(os.getenv("REDIS_DB", "0"))
    redis_client = redis.Redis(host=host, port=port, db=db)
    try:
        await redis_client.ping()
        return redis_client
    except Exception as e:
        raise Exception(f"Redis connection failed: {e}")
