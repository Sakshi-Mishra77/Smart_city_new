import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(_BASE_DIR / ".env")

def _split_env_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value.strip())
    except ValueError:
        return default


def _resolve_secret_key() -> str:
    value = os.getenv("SECRET_KEY")
    if value:
        return value
    if os.getenv("ENV", "development").lower() == "production":
        raise RuntimeError("SECRET_KEY is required in production")
    return secrets.token_urlsafe(48)


class Settings:
    ENV = os.getenv("ENV", "development")
    PROJECT_NAME = os.getenv("PROJECT_NAME", "SafeLive")

    MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.getenv("DB_NAME", "safelive")

    SECRET_KEY = _resolve_secret_key()
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
    OTP_EXPIRE_MINUTES = _env_int("OTP_EXPIRE_MINUTES", 10)
    OTP_MAX_ATTEMPTS = _env_int("OTP_MAX_ATTEMPTS", 5)
    OTP_MIN_RESEND_SECONDS = _env_int("OTP_MIN_RESEND_SECONDS", 30)

    BASE_DIR = _BASE_DIR
    IMAGE_DIR = os.getenv("IMAGE_DIR", str(BASE_DIR / "images"))

    EMAIL_ENABLED = _env_bool("EMAIL_ENABLED", True)
    EMAIL_USER = os.getenv("EMAIL_USER", "safelive.alerts@gmail.com")
    EMAIL_PASS = os.getenv("EMAIL_PASS", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", EMAIL_USER)
    EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "SafeLive Alerts")
    EMAIL_REPLY_TO = os.getenv("EMAIL_REPLY_TO", "")
    EMAIL_ALERT_TO = os.getenv("EMAIL_ALERT_TO", EMAIL_USER)
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = _env_int("SMTP_PORT", 587)
    SMTP_USE_TLS = _env_bool("SMTP_USE_TLS", True)
    SMTP_USE_SSL = _env_bool("SMTP_USE_SSL", False)
    SMTP_TIMEOUT_SECONDS = _env_int("SMTP_TIMEOUT_SECONDS", 20)
    EMAIL_MAX_RETRIES = _env_int("EMAIL_MAX_RETRIES", 3)
    EMAIL_RETRY_BACKOFF_SECONDS = _env_float("EMAIL_RETRY_BACKOFF_SECONDS", 1.5)
    EMAIL_NOTIFY_ON_REGISTER = _env_bool("EMAIL_NOTIFY_ON_REGISTER", True)
    SMS_ALERT_TO = os.getenv("SMS_ALERT_TO", "")
    WHATSAPP_ALERT_TO = os.getenv("WHATSAPP_ALERT_TO", "")
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_SMS_FROM = os.getenv("TWILIO_SMS_FROM", "")
    TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")

    DOMAIN = os.getenv("DOMAIN", "https://safelive.in")
    CORS_ORIGINS = _split_env_list(os.getenv("CORS_ORIGINS")) or [
        "https://safelive.in",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

settings = Settings()

if settings.ENV.lower() == "production":
    if settings.EMAIL_ENABLED and not os.getenv("EMAIL_PASS"):
        raise RuntimeError("EMAIL_PASS is required in production")
