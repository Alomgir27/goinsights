from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/goinsights"
    redis_url: str = "redis://localhost:6379/0"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    assemblyai_api_key: str = ""
    elevenlabs_api_key: str = ""
    pexels_api_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/auth/callback"
    storage_path: str = "./storage"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()
