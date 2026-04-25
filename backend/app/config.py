from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    app_name: str = "IntervAI Backend"
    admin_email: str = "admin@intervai.com"
    items_per_user: int = 10
    database_url: str = "sqlite:///./intervai.db"
    # Comma-separated list of allowed CORS origins.
    # Defaults to * (open) — set in production to your frontend URL.
    allowed_origins: str = "*"

    class Config:
        env_file = ".env"

settings = Settings()

def get_cors_origins() -> List[str]:
    raw = settings.allowed_origins.strip()
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]