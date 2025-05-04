import sys

from sqlalchemy import Engine
from sqlmodel import SQLModel


def create_db_and_tables(engine: Engine):
    SQLModel.metadata.create_all(engine)


def reset_db(engine: Engine):
    tables = SQLModel.metadata.sorted_tables
    tables_to_drop = []
    for table in tables:
        if table.name.startswith("processing_"):
            tables_to_drop.append(table)
    print(f"Tables: {tables}")
    print(f"Tables to drop: {tables_to_drop}")
    sys.stdout.flush()
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
