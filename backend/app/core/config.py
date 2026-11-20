from functools import lru_cache
from typing import Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "insecure-dev-secret-change-me-in-production"


class Settings(BaseSettings):
    """Application settings, loaded from environment variables (and `.env` in development)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Team Task & Sprint Tracker API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://tracker:tracker@localhost:5432/tracker"

    jwt_secret_key: str = INSECURE_DEFAULT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    # bcrypt work factor. 12 is a sensible production default; tests lower it for speed.
    bcrypt_rounds: int = 12

    # Comma-separated list of allowed browser origins, e.g. "http://localhost:3000,https://app.example.com"
    cors_origins: str = "http://localhost:3000"

    # Shared secret used by the Next.js BFF to sign the browser's client IP. When unset, the
    # API ignores all forwarding/identity headers and keys rate limits by the direct peer.
    client_ip_secret: str | None = None
    # SlowAPI storage. Use (for example) `redis://host:6379/0` when running multiple workers or
    # instances so limits are shared instead of counted per process.
    rate_limit_storage_uri: str = "memory://"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Hosting providers (Render, Neon, Heroku) hand out `postgres://` or `postgresql://` URLs;
        # SQLAlchemy needs the driver spelled out to pick psycopg 3.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @model_validator(mode="after")
    def require_real_secret_in_production(self) -> Self:
        if self.is_production and self.jwt_secret_key == INSECURE_DEFAULT_SECRET:
            raise ValueError("JWT_SECRET_KEY must be set to a strong secret in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
