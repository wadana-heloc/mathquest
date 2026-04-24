"""Runtime configuration loaded from environment variables.

All secrets live in ``backend/.env`` (git-ignored). Tests provide their
own values via ``backend/.env.test`` (also git-ignored).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pydantic-validated application settings.

    Access via :func:`get_settings`.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Supabase -----------------------------------------------------------
    supabase_url: str = Field(..., description="Supabase project URL.")
    supabase_anon_key: SecretStr = Field(..., description="Anon public key.")
    supabase_service_role_key: SecretStr = Field(
        ..., description="Service role secret key. Bypasses RLS."
    )
    supabase_jwt_secret: SecretStr = Field(
        ..., description="JWT signing secret for verifying access tokens."
    )

    # ---- App ----------------------------------------------------------------
    cors_origins: str = Field(
        "http://localhost:3000",
        description="Comma-separated list of origins allowed by CORS.",
    )
    app_env: Literal["dev", "prod"] = "dev"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached :class:`Settings` singleton.

    Tests override this dependency via ``app.dependency_overrides`` rather
    than mutating environment variables.
    """
    return Settings()  # type: ignore[call-arg]
