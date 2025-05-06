import sys
from functools import lru_cache

from app.models import Task
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel
from sqlmodel import Table

owned_table_names = [Task.__tablename__]


@lru_cache()
def get_owned_tables() -> list[Table]:
    owned_tables: list[Table] = []
    tables = SQLModel.metadata.sorted_tables
    for table in tables:
        print(f"Table: {table.name}")
        if table.name in owned_table_names:
            owned_tables.append(table)
    print(f"owned_tables: {owned_tables}")
    return owned_tables


async def create_db_and_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        tables_to_create = get_owned_tables()
        await conn.run_sync(SQLModel.metadata.create_all, tables=tables_to_create)


async def reset_db(engine: AsyncEngine):
    async with engine.begin() as conn:
        tables_to_drop = get_owned_tables()
        await conn.run_sync(SQLModel.metadata.drop_all, tables=tables_to_drop)
        await conn.run_sync(SQLModel.metadata.create_all, tables=tables_to_drop)
