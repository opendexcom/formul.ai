from typing import TypeAlias

from sqlalchemy.exc import IntegrityError  # noqa
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.core import config

AsyncSessionFactoryType: TypeAlias = async_sessionmaker[AsyncSession]


def get_async_engine(settings: config.PostgresSettings) -> AsyncEngine:
    return create_async_engine(settings.get_async_uri(), pool_size=50, max_overflow=50, pool_pre_ping=True)


def get_async_session_factory(engine: AsyncEngine) -> AsyncSessionFactoryType:
    return async_sessionmaker[AsyncSession](engine)
