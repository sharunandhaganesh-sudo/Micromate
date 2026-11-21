from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AeroPulse Microclimate & Extreme Weather Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "aeropulse_microclimate_super_secret_production_key_change_in_env_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database: Default SQLite for effortless local run, override with PostgreSQL in production
    DATABASE_URL: str = "sqlite:///./microclimate.db"

    # MQTT Settings
    MQTT_ENABLED: bool = False
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: Optional[str] = None
    MQTT_PASSWORD: Optional[str] = None
    MQTT_KEEPALIVE: int = 60
    MQTT_TLS_ENABLED: bool = False
    MQTT_TOPIC_PREFIX: str = "microclimate/v1"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    # Email / Telegram
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    ALERT_EMAIL: Optional[str] = None
    TELEGRAM_BOT_TOKEN: Optional[str] = None

    # ThingSpeak Cloud Integration (Option A)
    THINGSPEAK_ENABLED: bool = True
    THINGSPEAK_CHANNEL_ID: Optional[str] = None
    THINGSPEAK_READ_API_KEY: Optional[str] = None
    THINGSPEAK_WRITE_API_KEY: Optional[str] = None
    THINGSPEAK_SYNC_INTERVAL_SECONDS: int = 20

    # Optional AI Assistant Keys
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Stale device threshold (in seconds)
    DEVICE_STALE_THRESHOLD_SECONDS: int = 120
    DEVICE_OFFLINE_THRESHOLD_SECONDS: int = 300

    # Demo mode
    ENABLE_DEMO_SIMULATOR_BY_DEFAULT: bool = False

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
