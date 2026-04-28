"""Pydantic schemas for the /problems/* endpoints."""

from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class HintItem(BaseModel):
    level: int
    text: str
    cost: int


# ---------------------------------------------------------------------------
# GET /problems
# ---------------------------------------------------------------------------


class ProblemResponse(BaseModel):
    """A problem as returned to the child — answer and shortcut fields omitted."""

    id: uuid.UUID
    zone: int
    category: str
    difficulty: int
    stem: str
    answer_type: str
    hints: List[HintItem]
    flavor_text: str | None = None
    tags: List[str]


class ProblemsListResponse(BaseModel):
    problems: List[ProblemResponse]


# ---------------------------------------------------------------------------
# POST /problems/attempt
# ---------------------------------------------------------------------------


class AttemptRequest(BaseModel):
    problem_id: uuid.UUID
    answer: str = Field(..., min_length=1, max_length=200)
    duration_ms: int = Field(..., ge=0)
    hint_level_used: int = Field(default=0, ge=0, le=3)
    session_id: uuid.UUID


class AttemptResponse(BaseModel):
    correct: bool
    coins_awarded: int
    insight_detected: bool
    new_balance: int
    streak_count: int
    trick_unlocked: str | None = None
    daily_cap_reached: bool


# ---------------------------------------------------------------------------
# POST /problems/hint
# ---------------------------------------------------------------------------


class HintRequest(BaseModel):
    problem_id: uuid.UUID
    hint_level: int = Field(..., ge=1, le=3)
    session_id: uuid.UUID


class HintResponse(BaseModel):
    hint_text: str
    cost_paid: int
    new_balance: int
