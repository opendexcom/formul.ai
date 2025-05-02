from pydantic import Field
from pydantic_settings import BaseSettings

class DatabaseSettings(BaseSettings):
    db_connection_url:str = Field(default="",alias="SURVEY_DB_CONNECTION_STRING")

class Settings(BaseSettings):
    database: DatabaseSettings = DatabaseSettings()
    ollama_api_url: str = Field(default="http://localhost:11435", alias="OLLAMA_API_URL")
