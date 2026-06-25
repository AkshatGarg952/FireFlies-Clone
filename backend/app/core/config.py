from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Fireflies Clone"
    database_url: str = "sqlite:///./fireflies.db"
    frontend_url: str = "http://localhost:3000"


settings = Settings()
