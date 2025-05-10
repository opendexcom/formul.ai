from typing import TypeAlias

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession


AsyncSessionFactory: TypeAlias = async_sessionmaker[AsyncSession]
