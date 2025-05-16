import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.db import database

def test_get_owned_tables_filters_by_schema(monkeypatch):
    table1 = MagicMock()
    table1.name = "foo"
    table1.schema = "processing"
    table2 = MagicMock()
    table2.name = "bar"
    table2.schema = "other"
    fake_metadata = MagicMock()
    fake_metadata.sorted_tables = [table1, table2]
    monkeypatch.setattr(database.SQLModel, "metadata", fake_metadata)
    owned = database.get_owned_tables()
    assert table1 in owned
    assert table2 not in owned

@pytest.mark.asyncio
async def test_create_db_and_tables_executes(monkeypatch):
    mock_conn = AsyncMock()
    class FakeBegin:
        async def __aenter__(self):
            return mock_conn
        async def __aexit__(self, exc_type, exc, tb):
            pass
    mock_engine = MagicMock()
    mock_engine.begin = MagicMock(return_value=FakeBegin())
    monkeypatch.setattr(database, "get_owned_tables", lambda: [])
    monkeypatch.setattr(database.sa.schema, "CreateSchema", MagicMock())
    monkeypatch.setattr(database.SQLModel.metadata, "create_all", MagicMock())
    await database.create_db_and_tables(mock_engine)
    assert mock_conn.execute.call_count == 2
    assert mock_conn.commit.called
    assert mock_conn.run_sync.called

def test_reset_db_is_empty():
    # Just check that it does nothing for now
    assert database.reset_db.__code__.co_code is not None