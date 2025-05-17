from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class PostgresSettings(BaseSettings):
    host: str = Field(default="postgres", alias="SURVEY_DB_HOST")
    username: str = Field(default="postgres", alias="SURVEY_DB_USERNAME")
    db_name: str = Field(default="postgres", alias="SURVEY_DB_NAME")
    port: int = Field(default=5432, alias="SURVEY_DB_PORT")
    password: SecretStr = Field(default=SecretStr("postgres"), alias="SURVEY_DB_PASSWORD")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf8")


class Settings(BaseSettings):
    database: PostgresSettings = PostgresSettings()
    ollama_api_url: str = Field(default="http://localhost:11435", alias="OLLAMA_API_URL")

    def get_database_async_uri(self) -> str:
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.database.username,
                password=self.database.password.get_secret_value(),
                host=self.database.host,
                path=f"/{self.database.db_name}",
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
                path=f"/{self.database.db_name}",
            )
        )
