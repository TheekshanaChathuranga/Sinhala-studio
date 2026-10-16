import os
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Sinhala Subtitle Generator API"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    API_PREFIX: str = "/api/v1"
    
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR.parent / "storage"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR.parent / 'storage' / 'subtitles.db'}")
    
    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500"))
    MAX_MEDIA_DURATION_MINUTES: int = int(os.getenv("MAX_MEDIA_DURATION_MINUTES", "180"))
    
    # ASR Settings
    ASR_PROVIDER: str = os.getenv("ASR_PROVIDER", "faster_whisper")
    ASR_MODEL: str = os.getenv("ASR_MODEL", "tiny")  # tiny/base/small/medium/large-v3
    ASR_DEVICE: str = os.getenv("ASR_DEVICE", "cpu")  # cpu or cuda
    ASR_COMPUTE_TYPE: str = os.getenv("ASR_COMPUTE_TYPE", "int8")  # int8, float16, float32
    
    # Translation Settings
    TRANSLATION_PROVIDER: str = os.getenv("TRANSLATION_PROVIDER", "hybrid")  # hybrid, llm, google, mymemory, mock
    TRANSLATION_API_KEY: Optional[str] = os.getenv("TRANSLATION_API_KEY", None)
    TRANSLATION_MODEL: str = os.getenv("TRANSLATION_MODEL", "gpt-4o-mini")
    TRANSLATION_BASE_URL: Optional[str] = os.getenv("TRANSLATION_BASE_URL", None)
    
    # FFmpeg & Media
    FFMPEG_BINARY: Optional[str] = os.getenv("FFMPEG_BINARY", None)
    
    # Retention
    TEMP_FILE_RETENTION_HOURS: int = int(os.getenv("TEMP_FILE_RETENTION_HOURS", "24"))
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()

# Ensure storage directories exist
os.makedirs(settings.STORAGE_DIR / "uploads", exist_ok=True)
os.makedirs(settings.STORAGE_DIR / "audio", exist_ok=True)
os.makedirs(settings.STORAGE_DIR / "exports", exist_ok=True)
