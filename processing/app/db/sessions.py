from typing import TypeAlias

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

AsyncSessionFactory: TypeAlias = async_sessionmaker[AsyncSession]
