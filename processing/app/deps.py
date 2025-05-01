from sqlmodel import create_engine
from app.config import Settings

def get_database_engine():
    postgres_url = str(Settings().database.db_connection_url)
    engine = create_engine(postgres_url, echo=True, future=True)
    return engine
