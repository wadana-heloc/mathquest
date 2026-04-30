"""Child-facing endpoints.

These endpoints require a bearer token whose ``public.users`` row has
``role='child'``. The role is read from the database on every call (TDD
§9.1) — never trusted from the JWT.

Endpoints:

* ``GET /child/me``     — return the authenticated child's combined profile.
* ``GET /child/streak`` — return the child's current streak counters.
* ``PATCH /child/streak`` — update streak based on whether the last answer was correct.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.errors import APIError, ForbiddenRole, NotAuthenticated
from app.schemas.parent import ChildProfile, StreakResponse, StreakUpdateRequest
from app.security import AuthUser, get_current_user
from app.supabase_clients import get_admin_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/child", tags=["child"])


# -----------------------------------------------------------------------------
# GET /child/me — return the child's own profile
# -----------------------------------------------------------------------------


@router.get(
    "/me",
    response_model=ChildProfile,
    summary="Return the authenticated child's combined profile.",
)
async def get_my_profile(
    current: AuthUser = Depends(get_current_user),
) -> ChildProfile:
    """Return the caller's ``public.users`` + ``public.children`` row merged
    into a ``ChildProfile``.

    Role is re-read from the DB on every call (TDD §9.1). A parent token
    gets ``403 forbidden_role``.
    """
    admin = get_admin_supabase()

    user_res = (
        admin.table("users")
        .select("role, email, display_name, parent_id")
        .eq("id", str(current.id))
        .limit(1)
        .execute()
    )
    if not user_res.data:
        raise NotAuthenticated("Profile row missing for authenticated user.")
    user_row = user_res.data[0]

    if user_row["role"] != "child":
        raise ForbiddenRole("Only children can access this endpoint.")

    child_res = (
        admin.table("children")
        .select("*")
        .eq("user_id", str(current.id))
        .limit(1)
        .execute()
    )
    if not child_res.data:
        raise APIError(
            "Child profile row missing.",
            code="child_profile_missing",
            status_code=500,
        )
    child_row = child_res.data[0]

    # Build the combined profile. user_row needs id for the ChildProfile
    # fields (user_id comes from child_row, but parent_id comes from user_row).
    user_row_with_id = {**user_row, "id": str(current.id)}

    return ChildProfile(
        id=child_row["id"],
        user_id=child_row["user_id"],
        avatar_id=child_row["avatar_id"],
        current_zone=child_row["current_zone"],
        coins=child_row["coins"],
        total_xp=child_row["total_xp"],
        difficulty_ceiling=child_row["difficulty_ceiling"],
        date_of_birth=child_row["date_of_birth"],
        grade=child_row["grade"],
        streak_current=child_row["streak_current"],
        streak_best=child_row["streak_best"],
        daily_coins_earned=child_row["daily_coins_earned"],
        current_difficulty=child_row["current_difficulty"],
        created_at=child_row["created_at"],
        email=user_row["email"],
        display_name=user_row["display_name"],
        parent_id=user_row["parent_id"],
    )


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _require_child(current: AuthUser) -> tuple[dict, dict]:
    """Return (user_row, child_row) after verifying role='child'.

    Raises ForbiddenRole for non-child callers and NotAuthenticated when
    profile rows are missing.
    """
    admin = get_admin_supabase()

    user_res = (
        admin.table("users")
        .select("role, email, display_name, parent_id")
        .eq("id", str(current.id))
        .limit(1)
        .execute()
    )
    if not user_res.data:
        raise NotAuthenticated("Profile row missing for authenticated user.")
    user_row = user_res.data[0]

    if user_row["role"] != "child":
        raise ForbiddenRole("Only children can access this endpoint.")

    child_res = (
        admin.table("children")
        .select("id, user_id, streak_current, streak_best")
        .eq("user_id", str(current.id))
        .limit(1)
        .execute()
    )
    if not child_res.data:
        raise APIError(
            "Child profile row missing.",
            code="child_profile_missing",
            status_code=500,
        )
    return user_row, child_res.data[0]


# -----------------------------------------------------------------------------
# GET /child/streak — read streak counters
# -----------------------------------------------------------------------------


@router.get(
    "/streak",
    response_model=StreakResponse,
    summary="Return the authenticated child's streak counters.",
)
async def get_streak(
    current: AuthUser = Depends(get_current_user),
) -> StreakResponse:
    _, child_row = _require_child(current)
    return StreakResponse(
        streak_current=child_row["streak_current"],
        streak_best=child_row["streak_best"],
    )


# -----------------------------------------------------------------------------
# PATCH /child/streak — update streak
# -----------------------------------------------------------------------------


@router.patch(
    "/streak",
    response_model=StreakResponse,
    summary="Update the child's streak based on whether the last answer was correct.",
)
async def update_streak(
    body: StreakUpdateRequest,
    current: AuthUser = Depends(get_current_user),
) -> StreakResponse:
    """Increment ``streak_current`` (and promote ``streak_best``) when
    ``correct=true``; reset ``streak_current`` to 0 when ``correct=false``.

    Uses SELECT-after-UPDATE so the returned values reflect the committed
    state (PostgREST UPDATE ``.data`` is unreliable).
    """
    admin = get_admin_supabase()
    _, child_row = _require_child(current)

    child_id = child_row["id"]
    current_streak = child_row["streak_current"]
    best_streak = child_row["streak_best"]

    if body.correct:
        new_current = current_streak + 1
        new_best = max(best_streak, new_current)
    else:
        new_current = 0
        new_best = best_streak

    admin.table("children").update(
        {"streak_current": new_current, "streak_best": new_best}
    ).eq("id", child_id).execute()

    # SELECT-after-UPDATE — don't trust .data from the UPDATE call
    refreshed = (
        admin.table("children")
        .select("streak_current, streak_best")
        .eq("id", child_id)
        .limit(1)
        .execute()
    )
    row = refreshed.data[0]
    return StreakResponse(
        streak_current=row["streak_current"],
        streak_best=row["streak_best"],
    )
