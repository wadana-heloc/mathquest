"""Pydantic schemas for the /tricks/* endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TrickResponse(BaseModel):
    """Full row from ``public.tricks``."""

    id: str
    name: str
    category: str
    description: str


class TricksListResponse(BaseModel):
    tricks: list[TrickResponse]


class UnlockedTrick(BaseModel):
    """A trick the child has unlocked, merged with its tricks-table details."""

    trick_id: str
    name: str
    category: str
    description: str
    insight_count: int
    unlocked_at: datetime | None


class UnlockedTricksResponse(BaseModel):
    unlocked_tricks: list[UnlockedTrick]
