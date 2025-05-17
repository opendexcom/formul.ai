from functools import lru_cache

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel, Table


@lru_cache()
def get_owned_tables() -> list[Table]:
    owned_tables: list[Table] = []
    tables = SQLModel.metadata.sorted_tables
    for table in tables:
        print(f"Table: {table.name}, schema: {table.schema}")
        if table.schema == "processing":
            owned_tables.append(table)
    print(f"owned_tables: {owned_tables}")
    return owned_tables


async def create_db_and_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        await conn.execute(sa.schema.CreateSchema("processing", if_not_exists=True))
        await conn.commit()


async def reset_db(engine: AsyncEngine):
    pass
    # async with engine.begin() as conn:
    #    tables_to_drop = get_owned_tables()
    #    await conn.run_sync(SQLModel.metadata.drop_all, tables=tables_to_drop)
    #    await conn.run_sync(SQLModel.metadata.create_all, tables=tables_to_drop)
