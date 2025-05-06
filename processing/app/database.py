import sys

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel


async def create_db_and_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def reset_db(engine: AsyncEngine):
    async with engine.begin() as conn:
        tables = SQLModel.metadata.sorted_tables
        tables_to_drop = []
        for table in tables:
            if table.name.startswith("processing_"):
                tables_to_drop.append(table)
        print(f"Tables: {tables}")
        print(f"Tables to drop: {tables_to_drop}")
        sys.stdout.flush()
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)
