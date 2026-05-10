"""Tricks endpoints.

Requires a child bearer token. Role is read from the database on every
call (TDD §9.1) — never trusted from the JWT.

Endpoints:

* ``GET /tricks/{trick_id}`` — return full trick info from ``public.tricks``.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.errors import ForbiddenRole, NotAuthenticated, TrickNotFound
from app.schemas.tricks import TrickResponse, TricksListResponse
from app.security import AuthUser, get_current_user
from app.supabase_clients import get_admin_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tricks", tags=["tricks"])


def _require_child(current: AuthUser) -> None:
    """Verify the caller has role='child'. Raises ForbiddenRole otherwise."""
    res = (
        get_admin_supabase()
        .table("users")
        .select("role")
        .eq("id", str(current.id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotAuthenticated("Profile row missing for authenticated user.")
    if res.data[0]["role"] != "child":
        raise ForbiddenRole("Only children can access tricks.")


@router.get(
    "",
    response_model=TricksListResponse,
    summary="Return all tricks (child-authed).",
)
async def list_tricks(
    current: AuthUser = Depends(get_current_user),
) -> TricksListResponse:
    """Return every row from ``public.tricks``, ordered by ``id``.

    Role is re-read from the DB on every call. A parent token gets
    ``403 forbidden_role``.
    """
    _require_child(current)

    res = (
        get_admin_supabase()
        .table("tricks")
        .select("id, name, category, description")
        .order("id")
        .execute()
    )
    return TricksListResponse(tricks=[TrickResponse(**row) for row in res.data])


@router.get(
    "/{trick_id}",
    response_model=TrickResponse,
    summary="Return full trick information by ID (child-authed).",
)
async def get_trick(
    trick_id: str,
    current: AuthUser = Depends(get_current_user),
) -> TrickResponse:
    """Return the ``public.tricks`` row for the given trick ID (e.g. ``A1``).

    Role is re-read from the DB on every call. A parent token gets
    ``403 forbidden_role``.
    """
    _require_child(current)

    res = (
        get_admin_supabase()
        .table("tricks")
        .select("id, name, category, description")
        .eq("id", trick_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise TrickNotFound(f"Trick '{trick_id}' not found.")

    return TrickResponse(**res.data[0])
