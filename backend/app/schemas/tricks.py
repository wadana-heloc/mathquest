"""Pydantic schemas for the /tricks/* endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class TrickResponse(BaseModel):
    """Full row from ``public.tricks``."""

    id: str
    name: str
    category: str
    description: str


class TricksListResponse(BaseModel):
    tricks: list[TrickResponse]
