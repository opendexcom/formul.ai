from typing import TypeAlias

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker

AsyncSessionFactory: TypeAlias = async_sessionmaker[AsyncSession]
