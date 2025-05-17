import os

from pydantic import PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class PostgresSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SURVEY_DB_")

    host: str
    username: str
    name: str
    password: SecretStr
    port: int = 5432


class Settings(BaseSettings):
    database: PostgresSettings
    ollama_api_url: str

    def get_database_async_uri(self) -> str:
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.database.username,
                password=self.database.password.get_secret_value(),
                host=self.database.host,
                path=f"{self.database.name}",
            )
        )

    def get_database_sync_uri(self) -> str:
        """
        This URL is used to apply migrations.
        """
        return str(
            PostgresDsn.build(
                scheme="postgresql",
                username=self.database.username,
                password=self.database.password.get_secret_value(),
                host=self.database.host,
                path=f"{self.database.name}",
            )
        )


def from_env() -> Settings:
    return Settings.model_validate(os.environ)
