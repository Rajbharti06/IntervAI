from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "IntervAI Backend"
    admin_email: str = "admin@intervai.com"
    items_per_user: int = 10
    database_url: str = "sqlite:///./intervai.db"

    class Config:
        env_file = ".env"

settings = Settings()