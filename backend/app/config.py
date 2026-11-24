from pathlib import Path
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "CarbonTrace API"
    database_url: str = Field(default="sqlite:///./carbontrace.db")
    jwt_secret_key: str = Field(
        ...,
        min_length=16,
        validation_alias=AliasChoices("JWT_SECRET_KEY", "JWT_SECRET"),
    )
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_hours: int = Field(default=12, ge=1, le=168)

    cors_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000")

    upload_dir: str = Field(default="./uploads")
    sample_data_dir: str = Field(default="./sample_data")
    max_upload_bytes: int = Field(default=10 * 1024 * 1024)

    demo_user_password: str = Field(..., min_length=6)
    login_rate_limit_max: int = Field(default=15)
    login_rate_limit_window_seconds: int = Field(default=60)

    # Gemini AI settings (loaded strictly from .env; never hard-code an API key)
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-3.8-flash")

    # Orchestration & Follow-up scheduler settings
    demo_mode: bool = Field(default=True)
    followup_interval_seconds: int = Field(default=12, ge=2, le=86400)
    outreach_max_tries: int = Field(default=3, ge=1, le=10)

    @property
    def cors_allowlist(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_upload_dir(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_sample_data_dir(self) -> Path:
        path = Path(self.sample_data_dir)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_cache_dir(self) -> Path:
        path = self.resolved_sample_data_dir / "cache"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_database_url(self) -> str:
        if self.database_url.startswith("sqlite:///./"):
            rel = self.database_url.replace("sqlite:///./", "", 1)
            return f"sqlite:///{(BACKEND_ROOT / rel).as_posix()}"
        return self.database_url


settings = Settings()
