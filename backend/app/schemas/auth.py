"""Pydantic schemas for the /auth/* endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# --- constants ----------------------------------------------------------------

# Supabase Auth enforces a minimum of 6 characters on its own; we raise it
# to 8 to match the signup UI ("Min. 8 characters") and to give us a little
# headroom if Supabase relaxes its default.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128  # match Supabase's own cap.

DISPLAY_NAME_MIN = 1
DISPLAY_NAME_MAX = 80  # matches users_display_name_length CHECK constraint.


# --- requests -----------------------------------------------------------------


class SignupRequest(BaseModel):
    """Parent signup payload.

    Child signup is NOT possible through this endpoint (SC-06); children are
    created from the parent dashboard via a separate admin-backed flow.
    """

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    display_name: str = Field(min_length=DISPLAY_NAME_MIN, max_length=DISPLAY_NAME_MAX)
    terms_accepted: bool = Field(
        ...,
        description="Must be true. Corresponds to the 'I confirm I am a parent or guardian' checkbox.",
    )

    @field_validator("display_name")
    @classmethod
    def _strip_display_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("display_name must not be blank")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class RefreshRequest(BaseModel):
    """Payload for ``POST /auth/refresh``.

    The refresh_token is the long-lived credential the client received
    alongside the access_token on signup/login. Rotating it returns a
    fresh pair.
    """

    refresh_token: str = Field(min_length=1, max_length=2048)


# --- responses ----------------------------------------------------------------


class UserPublic(BaseModel):
    """Subset of ``public.users`` safe to return to the caller themselves."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    role: Literal["parent", "child"]
    display_name: str
    parent_id: uuid.UUID | None = None
    created_at: datetime
    last_active_at: datetime


class Session(BaseModel):
    """Tokens returned by /auth/login and /auth/signup.

    The access token is short-lived (1 hour by default in Supabase). The
    refresh token is long-lived and used to rotate access tokens. The
    client stores both; on logout we revoke the refresh token server-side.
    """

    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(..., description="Seconds until access_token expires.")
    expires_at: int = Field(..., description="Unix timestamp when access_token expires.")


class AuthResponse(BaseModel):
    """Shared shape for /auth/login and /auth/signup."""

    user: UserPublic
    session: Session | None = Field(
        None,
        description="Present when email confirmation is disabled or the user is already confirmed. Absent when email confirmation is required and the user must click the link first.",
    )
