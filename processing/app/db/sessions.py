from typing import TypeAlias

from sqlalchemy.exc import IntegrityError  # noqa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.core import config

engine_async = create_async_engine(
    config.PostgresSettings.from_env().get_async_uri(), pool_size=50, max_overflow=50, pool_pre_ping=True
)
AsyncSessionFactoryType: TypeAlias = async_sessionmaker[AsyncSession]
AsyncSessionFactory = async_sessionmaker[AsyncSession](engine_async)
