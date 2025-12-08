from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/goinsights"
    redis_url: str = "redis://localhost:6379/0"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    assemblyai_api_key: str = ""
    elevenlabs_api_key: str = ""
    storage_path: str = "./storage"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()
