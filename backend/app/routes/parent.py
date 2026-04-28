"""Parent-facing endpoints.

These endpoints all require a bearer token whose ``public.users`` row has
``role='parent'``. The role is read from the database on every call (TDD
§9.1) — we never trust a client-supplied role claim.

Endpoints:

* ``POST  /parent/children``  — create a child account.
* ``GET   /parent/settings``  — read the parent's settings row.
* ``PATCH /parent/settings``  — partial-update the parent's settings.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from gotrue.errors import AuthApiError  # type: ignore[import-not-found]

# AuthWeakPasswordError was added in a later gotrue release; fall back if
# the installed version predates it (mirrors routes/auth.py).
try:
    from gotrue.errors import AuthWeakPasswordError  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover

    class AuthWeakPasswordError(AuthApiError):  # type: ignore[no-redef]
        pass


from app.errors import (
    APIError,
    ChildCreateFailed,
    EmailAlreadyRegistered,
    ForbiddenRole,
    NotAuthenticated,
    WeakPassword,
)
from app.schemas.parent import (
    ChildCreateRequest,
    ChildCreateResponse,
    ChildProfile,
    ChildrenListResponse,
    ParentSettings,
    ParentSettingsUpdate,
)
from app.security import AuthUser, get_current_user
from app.supabase_clients import get_admin_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/parent", tags=["parent"])


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _require_parent(current: AuthUser) -> None:
    """Verify that the authenticated user is a parent.

    Reads the role from ``public.users`` via the admin client (RLS-safe).
    Raises :class:`ForbiddenRole` if the role is not ``'parent'``.

    Why re-read on every call: TDD §9.1 — never trust a role claim from
    the JWT. A child whose role somehow appears as 'parent' in their
    token (forged, stale, etc.) must still be rejected here.
    """
    res = (
        get_admin_supabase()
        .table("users")
        .select("role")
        .eq("id", str(current.id))
        .limit(1)
        .execute()
    )
    if not res.data:
        # Authenticated but no profile row — should be impossible (the
        # signup trigger creates the row in the same tx). Treat as
        # not-authenticated rather than forbidden so the client retries
        # the auth flow.
        raise NotAuthenticated("Profile row missing for authenticated user.")
    if res.data[0]["role"] != "parent":
        raise ForbiddenRole("Only parents can perform this action.")


def _child_profile_from_rows(child_row: dict[str, Any], user_row: dict[str, Any]) -> ChildProfile:
    """Combine a public.children row with its public.users row into a ChildProfile."""
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
# POST /parent/children — create a child account
# -----------------------------------------------------------------------------


@router.post(
    "/children",
    response_model=ChildCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a child account (parent-authed).",
)
async def create_child(
    payload: ChildCreateRequest,
    current: AuthUser = Depends(get_current_user),
) -> ChildCreateResponse:
    """Create a child account owned by the authenticated parent.

    Flow:
    1. Verify the caller is a parent (re-read role from DB).
    2. Call ``auth.admin.create_user`` with ``app_metadata={role:'child',
       parent_id: <caller>}``. The ``handle_new_user`` trigger inserts the
       matching ``public.users`` row.
    3. Insert the matching ``public.children`` row with the gameplay
       defaults plus the parent-supplied ``date_of_birth`` / ``avatar_id``.
    4. If step 3 fails, roll back step 2 by deleting the auth user — we
       never want a half-built child (auth.users + public.users without
       public.children, which would let them log in but break gameplay
       endpoints).

    Returns 201 with the merged ChildProfile.
    """
    _require_parent(current)

    admin = get_admin_supabase()

    # Step 1: create the auth user. role/parent_id ride in app_metadata
    # (service-role-only writable; SC-06 guarantee). display_name rides in
    # user_metadata where the trigger expects it.
    try:
        result = admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "app_metadata": {
                    "role": "child",
                    "parent_id": str(current.id),
                    "display_name": payload.display_name,
                },
                "user_metadata": {"display_name": payload.display_name},
            }
        )
    except AuthWeakPasswordError as e:
        raise WeakPassword(str(e)) from e
    except AuthApiError as e:
        msg = (getattr(e, "message", None) or str(e)).lower()
        if "already" in msg and ("registered" in msg or "exists" in msg):
            raise EmailAlreadyRegistered(
                "An account with that email already exists."
            ) from e
        if "password" in msg and ("short" in msg or "weak" in msg):
            raise WeakPassword(str(e)) from e
        raise

    new_user = result.user
    if new_user is None:
        # supabase-py returns user=None on unknown shapes; collapse to the
        # closest meaningful error.
        raise EmailAlreadyRegistered(
            "The account could not be created. It may already exist."
        )

    new_user_id = uuid.UUID(new_user.id)

    # Step 2: defensively pin role + parent_id on public.users.
    #
    # The trigger reads role/parent_id from raw_app_meta_data (set above
    # via app_metadata=…). In some environments — notably projects where
    # an older handle_new_user() is still installed, or where GoTrue
    # silently merges but does not retain the caller's app_metadata
    # alongside its own provider/providers keys — the trigger ends up
    # defaulting v_role='parent' and v_parent_id=NULL, producing a child
    # that is mis-labelled as a parent in public.users.
    #
    # Rather than depend on every project having migration 0002+0004
    # applied perfectly, we explicitly UPDATE both fields here. service_role
    # bypasses RLS, the parent_consistency CHECK is satisfied because we
    # set both columns in one statement, and this is idempotent if the
    # trigger already produced the right state.
    admin.table("users").update(
        {"role": "child", "parent_id": str(current.id)}
    ).eq("id", str(new_user_id)).execute()

    # If the trigger also speculatively inserted a parent_settings row
    # (because v_role defaulted to 'parent'), it now points at a user who
    # is no longer a parent. Drop it. No-op if no such row exists.
    admin.table("parent_settings").delete().eq(
        "parent_id", str(new_user_id)
    ).execute()

    # Step 3: insert public.children. If this fails we roll back the auth
    # user so the next signup attempt with the same email works.
    insert_payload: dict[str, Any] = {"user_id": str(new_user_id), "grade": payload.grade}
    if payload.avatar_id is not None:
        insert_payload["avatar_id"] = payload.avatar_id
    if payload.date_of_birth is not None:
        insert_payload["date_of_birth"] = payload.date_of_birth.isoformat()

    try:
        child_res = admin.table("children").insert(insert_payload).execute()
    except Exception as e:  # noqa: BLE001 — rollback path; re-raise as APIError below.
        logger.exception("children insert failed for new auth user %s — rolling back", new_user_id)
        try:
            admin.auth.admin.delete_user(str(new_user_id))
        except Exception:
            logger.exception(
                "rollback failed: auth user %s could not be deleted; manual cleanup required",
                new_user_id,
            )
        raise ChildCreateFailed(
            "Failed to create child profile. The account was rolled back; please try again."
        ) from e

    # supabase-py occasionally returns res.data == [] for mutating calls
    # despite the row landing in the DB (e.g. when the project's PostgREST
    # default Prefer header is overridden). Don't trust .data here; do an
    # explicit SELECT for the row we just inserted.
    if child_res.data:
        child_row = child_res.data[0]
    else:
        logger.warning(
            "children insert returned no data for user %s; fetching row explicitly",
            new_user_id,
        )
        select_res = (
            admin.table("children")
            .select("*")
            .eq("user_id", str(new_user_id))
            .limit(1)
            .execute()
        )
        if not select_res.data:
            raise ChildCreateFailed("Child profile row missing after insert.")
        child_row = select_res.data[0]

    # Fetch the joined public.users row. By this point we've explicitly
    # set role and parent_id, so the values are guaranteed correct.
    user_res = (
        admin.table("users")
        .select("email, display_name, parent_id")
        .eq("id", str(new_user_id))
        .limit(1)
        .execute()
    )
    if not user_res.data:
        # Should be impossible: the trigger ran in the same tx as auth.users.
        raise ChildCreateFailed("Profile row missing after child creation.")

    return ChildCreateResponse(
        child=_child_profile_from_rows(child_row, user_res.data[0])
    )


# -----------------------------------------------------------------------------
# GET /parent/children — list all children of the authenticated parent
# -----------------------------------------------------------------------------


@router.get(
    "/children",
    response_model=ChildrenListResponse,
    summary="List all children belonging to the authenticated parent.",
)
async def list_children(
    current: AuthUser = Depends(get_current_user),
) -> ChildrenListResponse:
    """Return every child account owned by the caller.

    Queries ``public.users`` for all rows whose ``parent_id`` matches the
    caller, then fetches the matching ``public.children`` gameplay rows and
    merges them into ``ChildProfile`` objects.

    Returns an empty list (not 404) when the parent has no children yet.
    """
    _require_parent(current)

    admin = get_admin_supabase()

    # Fetch every child's identity row for this parent.
    users_res = (
        admin.table("users")
        .select("id, email, display_name, parent_id")
        .eq("parent_id", str(current.id))
        .eq("role", "child")
        .execute()
    )
    if not users_res.data:
        return ChildrenListResponse(children=[])

    child_user_ids = [row["id"] for row in users_res.data]

    # Fetch all gameplay rows in one query.
    children_res = (
        admin.table("children")
        .select("*")
        .in_("user_id", child_user_ids)
        .execute()
    )
    children_map: dict[str, Any] = {row["user_id"]: row for row in children_res.data}

    profiles = []
    for user_row in users_res.data:
        child_row = children_map.get(user_row["id"])
        if child_row is None:
            logger.warning(
                "children row missing for user %s — skipping from list",
                user_row["id"],
            )
            continue
        profiles.append(_child_profile_from_rows(child_row, user_row))

    return ChildrenListResponse(children=profiles)


# -----------------------------------------------------------------------------
# GET /parent/settings — read settings
# -----------------------------------------------------------------------------


@router.get(
    "/settings",
    response_model=ParentSettings,
    summary="Read the parent's settings row.",
)
async def get_settings(
    current: AuthUser = Depends(get_current_user),
) -> ParentSettings:
    """Return the caller's ``public.parent_settings`` row.

    Every parent has a settings row (created by the signup trigger), so a
    404 here would be a system bug, not a normal flow.
    """
    _require_parent(current)

    res = (
        get_admin_supabase()
        .table("parent_settings")
        .select("*")
        .eq("parent_id", str(current.id))
        .limit(1)
        .execute()
    )
    if not res.data:
        # Defensive: handle_new_user() should have created this at signup.
        # If a legacy parent (pre-migration-0004) hits this, run migration
        # 0007 to backfill.
        raise APIError(
            "Parent settings row missing. Run migration 0007 to backfill "
            "rows for parents that signed up before migration 0004.",
            code="parent_settings_missing",
            status_code=500,
        )
    return ParentSettings.model_validate(res.data[0])


# -----------------------------------------------------------------------------
# PATCH /parent/settings — partial update
# -----------------------------------------------------------------------------


@router.patch(
    "/settings",
    response_model=ParentSettings,
    summary="Update the parent's settings (partial).",
)
async def update_settings(
    payload: ParentSettingsUpdate,
    current: AuthUser = Depends(get_current_user),
) -> ParentSettings:
    """Apply a partial update to ``public.parent_settings`` for the caller.

    Only fields present in the payload are updated. Server-managed
    counters (``stars_earned``, ``stars_redeemed``, ``last_notified_at``)
    cannot be set through this endpoint — they aren't in the schema.
    """
    _require_parent(current)

    update = payload.model_dump(exclude_unset=True)
    if not update:
        # Nothing to do — return the current row.
        return await get_settings(current=current)

    admin = get_admin_supabase()
    admin.table("parent_settings").update(update).eq(
        "parent_id", str(current.id)
    ).execute()

    # Re-read to return current state. supabase-py's UPDATE response data
    # has been observed empty in the wild even on a successful write
    # (depends on PostgREST Prefer header negotiation), so we don't trust
    # .data from the update call. The follow-up SELECT also catches the
    # legitimate "no row to update" case for legacy parents pre-0007.
    res = (
        admin.table("parent_settings")
        .select("*")
        .eq("parent_id", str(current.id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise APIError(
            "Parent settings row missing. Run migration 0007 to backfill "
            "rows for parents that signed up before migration 0004.",
            code="parent_settings_missing",
            status_code=500,
        )
    return ParentSettings.model_validate(res.data[0])
