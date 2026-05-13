"""Pydantic schemas for /child/wishes and /parent/wishes endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class WishItem(BaseModel):
    """Full wish object shape — returned on every wish endpoint."""

    id: uuid.UUID
    title: str
    status: str
    ai_suggested_cost: int | None
    final_cost: int | None
    ai_category: str | None
    ai_reasoning: str | None
    parent_note: str | None
    coins_needed: int | None
    created_at: datetime
    redeemed_at: datetime | None
    delivered_at: datetime | None


class WishItemWithChild(WishItem):
    """WishItem extended with child context for the parent list endpoint."""

    child_id: uuid.UUID
    child_name: str


class SubmitWishRequest(BaseModel):
    """Body for ``POST /child/wishes``."""

    title: str = Field(min_length=1, max_length=120)


class SubmitWishResponse(BaseModel):
    """Immediate response after submitting a wish (AI pricing still in flight)."""

    id: uuid.UUID
    title: str
    status: str
    ai_suggested_cost: int | None


class ChildWishlistResponse(BaseModel):
    """Response for ``GET /child/wishes``."""

    coins: int
    wishes: list[WishItem]


class ReviewWishRequest(BaseModel):
    """Body for ``PATCH /parent/wishes/{wish_id}/review``."""

    action: str
    final_cost: int | None = Field(default=None, ge=1)
    parent_note: str | None = None


class WishStatusResponse(BaseModel):
    """Minimal wish shape returned on state-change endpoints."""

    id: uuid.UUID
    status: str


class WishActionResponse(BaseModel):
    """Wrapper returned by review and deliver endpoints."""

    wish: WishStatusResponse


class RedeemWishResponse(BaseModel):
    """Response for ``POST /child/wishes/{wish_id}/redeem``."""

    new_balance: int
    wish: WishStatusResponse


class ParentWishlistResponse(BaseModel):
    """Response for ``GET /parent/wishes``."""

    pending_count: int
    wishes: list[WishItemWithChild]


class ParentChildWishesResponse(BaseModel):
    """Response for ``GET /parent/children/{child_id}/wishes``."""

    child_id: uuid.UUID
    coins: int
    wishes: list[WishItem]
