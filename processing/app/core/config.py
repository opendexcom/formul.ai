from __future__ import annotations

import typing as t

from pydantic import PostgresDsn
from pydantic import SecretStr
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


class PostgresSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="POSTGRES_", extra="ignore")

    host: str
    username: str
    name: str
    password: SecretStr
    port: int = 5432

    def get_async_uri(self) -> str:
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                port=self.port,
                username=self.username,
                password=self.password.get_secret_value(),
                host=self.host,
                path=f"{self.name}",
            )
        )

    def get_sync_uri(self) -> str:
        """
        This URL is used to apply migrations.
        """
        return str(
            PostgresDsn.build(
                scheme="postgresql",
                port=self.port,
                username=self.username,
                password=self.password.get_secret_value(),
                host=self.host,
                path=f"{self.name}",
            )
        )

    @classmethod
    def from_env(cls: t.Type[PostgresSettings]) -> PostgresSettings:
        return PostgresSettings()  # type: ignore


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")
    database: PostgresSettings
    ollama_api_url: str = "http://ai:11434"
    mcp_server_url: str = "http://survey:8080/sse"

    @classmethod
    def from_env(cls: t.Type[Settings]) -> Settings:
        return Settings(database=PostgresSettings())  # type: ignore
