"""Pydantic schemas for the /parent/* endpoints."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.auth import (
    DISPLAY_NAME_MAX,
    DISPLAY_NAME_MIN,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
)


# --- POST /parent/children ---------------------------------------------------


class ChildCreateRequest(BaseModel):
    """Payload for ``POST /parent/children`` (parent-authed).

    Per TDD §9.1 and SC-06, child accounts cannot self-register; they are
    always created by an authenticated parent. The parent supplies the
    login email + password and the in-game display name; backend defaults
    fill in everything else (zone, coins, difficulty, etc.).
    """

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    display_name: str = Field(min_length=DISPLAY_NAME_MIN, max_length=DISPLAY_NAME_MAX)
    date_of_birth: date | None = None
    avatar_id: int | None = Field(default=None, ge=0)
    grade: int = Field(default=2, ge=1, le=12)

    @field_validator("display_name")
    @classmethod
    def _strip_display_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("display_name must not be blank")
        return v


class ChildProfile(BaseModel):
    """A child's combined identity + gameplay state.

    Joins ``public.users`` (email, display_name, parent_id) with
    ``public.children`` (zone, coins, streaks, …) into one wire shape.
    """

    model_config = ConfigDict(from_attributes=True)

    # From public.children
    id: uuid.UUID = Field(..., description="children.id")
    user_id: uuid.UUID = Field(..., description="children.user_id == users.id")
    avatar_id: int | None = None
    current_zone: int
    coins: int
    total_xp: int
    difficulty_ceiling: int
    date_of_birth: date | None = None
    grade: int
    streak_current: int
    streak_best: int
    daily_coins_earned: int
    current_difficulty: int
    created_at: datetime

    # Joined from public.users
    email: EmailStr
    display_name: str
    parent_id: uuid.UUID


class ChildCreateResponse(BaseModel):
    child: ChildProfile


# --- GET /parent/settings, PATCH /parent/settings ---------------------------


class ParentSettings(BaseModel):
    """A parent's configuration row (1:1 with the parent's users row)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID
    daily_limit_mins: int
    session_limit_mins: int
    auto_scaling: bool
    difficulty_ceiling: int
    star_threshold_coins: int
    stars_earned: int
    stars_redeemed: int
    audio_volume: int
    notification_email: EmailStr | None = None
    last_notified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ParentSettingsUpdate(BaseModel):
    """Partial-update payload for ``PATCH /parent/settings``.

    All fields optional. Only the fields the parent is allowed to change
    are accepted — server-managed counters (``stars_earned``,
    ``stars_redeemed``, ``last_notified_at``) are NOT in this schema, even
    though the columns exist; mutating those is a server-side concern
    (TDD §6.4).
    """

    daily_limit_mins: int | None = Field(default=None, ge=0, le=1440)
    session_limit_mins: int | None = Field(default=None, ge=0, le=1440)
    auto_scaling: bool | None = None
    difficulty_ceiling: int | None = Field(default=None, ge=1, le=10)
    star_threshold_coins: int | None = Field(default=None, gt=0)
    audio_volume: int | None = Field(default=None, ge=0, le=100)
    notification_email: EmailStr | None = None
