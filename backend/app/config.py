import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite-preview"
    GEMINI_COMPLEX_MODEL: str = "gemini-3.1-flash-lite-preview"
    ENABLE_COMPLEX_MODEL: bool = False
    MAX_AGENT_ITERATIONS: int = 2
    MAX_WORKFORCE_CALLS: int = 25
    MAX_OUTPUT_TOKENS: int = 768
    MAX_RETRIES: int = 2
    GLOBAL_TOKEN_BUDGET: int = 100000
    PER_AGENT_TOKEN_BUDGET: int = 15000
    DATABASE_URL: str = "sqlite+aiosqlite:///./project_forge.db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
