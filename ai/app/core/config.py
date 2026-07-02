import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Load environment from the directory where this file resides (app/core/) up to project root (ai/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
env_path = PROJECT_ROOT / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)
else:
    load_dotenv()


class Settings:
  
    APP_NAME: str = "ai-interview-engine"
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = ENV != "production"

    API_KEY: str = os.getenv("API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    REDIS_URL: str = os.getenv("REDIS_URL")

    # LLM
    # LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")
    # LLM_API_KEY: str = os.getenv("LLM_API_KEY")
    # LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4")

    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "huggingface")
    HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
    HUGGINGFACE_MODEL = os.getenv(
        "HUGGINGFACE_MODEL",
        "mistralai/Mistral-7B-Instruct-v0.2",
    )

    MAX_QUESTIONS: int = int(os.getenv("NUMBER_OF_QUESTIONS", os.getenv("MAX_QUESTIONS", "8")))
    INTERVIEW_SESSION_TTL_SECONDS: int = int(
        os.getenv("INTERVIEW_SESSION_TTL_SECONDS", "3600")
    )

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
