from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    API_VERSION: str = "v1"
    APP_NAME: str = "Status Indicator API"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str
    DB_ECHO: bool = False
    
    # Redis
    REDIS_URL: str
    REDIS_CACHE_TTL: int = 300
    
    # Security
    SECRET_KEY: str
    API_KEY_LENGTH: int = 32
    MASTER_API_KEY: str
    
    # Ping Configuration
    OFFLINE_THRESHOLD_MINUTES: int = 20
    STATUS_CHECK_INTERVAL_MINUTES: int = 5
    
    # Email Alerts
    ENABLE_EMAIL_ALERTS: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""  # Gmail App Password
    ALERT_EMAIL_TO: str = ""
    ALERT_EMAIL_FROM_NAME: str = "Status Indicator API"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
