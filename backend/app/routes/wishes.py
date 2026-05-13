"""Wish (reward) endpoints for children and parents.

Child endpoints (prefix /child):
  POST /child/wishes                  — submit a new wish
  GET  /child/wishes                  — get wishlist + coin balance
  POST /child/wishes/{wish_id}/redeem — spend coins atomically via Postgres RPC

Parent endpoints (prefix /parent):
  GET   /parent/wishes                     — all wishes across the parent's children
  PATCH /parent/wishes/{wish_id}/review    — approve or reject a pending wish
  PATCH /parent/wishes/{wish_id}/deliver   — mark a redeemed wish as delivered
"""

from __future__ import annotations

import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends

# ---------------------------------------------------------------------------
# Pricing agent — direct Python import (same pattern as report/story agents).
# ---------------------------------------------------------------------------
_PRICING_AGENT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "ai_agents", "wishlist-agent")
)
if _PRICING_AGENT_DIR not in sys.path:
    sys.path.insert(0, _PRICING_AGENT_DIR)

try:
    from wishlist_agent import price_wish as _price_wish  # type: ignore[import]
    from wishlist_schemas import PriceRequest as _PriceRequest  # type: ignore[import]
    _PRICING_AGENT_AVAILABLE = True
except ImportError:
    _PRICING_AGENT_AVAILABLE = False

from app.errors import APIError, ChildNotFound, ForbiddenRole, NotAuthenticated, WishNotFound
from app.schemas.wishes import (
    ChildWishlistResponse,
    ParentChildWishesResponse,
    ParentWishlistResponse,
    RedeemWishResponse,
    ReviewWishRequest,
    SubmitWishRequest,
    SubmitWishResponse,
    WishActionResponse,
    WishItem,
    WishItemWithChild,
    WishStatusResponse,
)
from app.security import AuthUser, get_current_user
from app.supabase_clients import get_admin_supabase

logger = logging.getLogger(__name__)

child_router = APIRouter(prefix="/child", tags=["child-wishes"])
parent_router = APIRouter(prefix="/parent", tags=["parent-wishes"])

# Sort order for GET /parent/wishes: pending_approval first, redeemed second, rest last
_STATUS_SORT_ORDER: dict[str, int] = {"pending_approval": 0, "redeemed": 1}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _require_child(current: AuthUser) -> dict:
    """Return the child row after verifying role='child'.

    Selects id, user_id, grade, and coins — the fields needed by wish endpoints.
    """
    admin = get_admin_supabase()
    user_res = (
        admin.table("users")
        .select("role")
        .eq("id", str(current.id))
        .limit(1)
        .execute()
    )
    if not user_res.data:
        raise NotAuthenticated("Profile row missing for authenticated user.")
    if user_res.data[0]["role"] != "child":
        raise ForbiddenRole("Only children can access this endpoint.")

    child_res = (
        admin.table("children")
        .select("id, user_id, grade, coins")
        .eq("user_id", str(current.id))
        .limit(1)
        .execute()
    )
    if not child_res.data:
        raise APIError("Child profile row missing.", code="child_profile_missing", status_code=500)
    return child_res.data[0]


def _require_parent(current: AuthUser) -> None:
    """Verify that the authenticated user is a parent."""
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
    if res.data[0]["role"] != "parent":
        raise ForbiddenRole("Only parents can perform this action.")


def _get_wish_owned_by_parent(wish_id: str, parent_user_id: str, admin: Any) -> dict:
    """Return the wish_items row if it belongs to one of this parent's children.

    Returns 404 for both missing and unowned wishes — consistent with
    _require_owned_child in parent.py, avoids leaking wish existence.
    """
    try:
        uuid.UUID(wish_id)
    except ValueError:
        raise WishNotFound(f"Wish '{wish_id}' not found.")

    wish_res = (
        admin.table("wish_items").select("*").eq("id", wish_id).limit(1).execute()
    )
    if not wish_res.data:
        raise WishNotFound(f"Wish '{wish_id}' not found.")
    wish_row = wish_res.data[0]

    child_res = (
        admin.table("children")
        .select("user_id")
        .eq("id", wish_row["child_id"])
        .limit(1)
        .execute()
    )
    if not child_res.data:
        raise WishNotFound(f"Wish '{wish_id}' not found.")

    user_res = (
        admin.table("users")
        .select("parent_id")
        .eq("id", child_res.data[0]["user_id"])
        .limit(1)
        .execute()
    )
    if not user_res.data or user_res.data[0]["parent_id"] != parent_user_id:
        raise WishNotFound(f"Wish '{wish_id}' not found.")

    return wish_row


def _build_wish_item(row: dict, child_coins: int) -> WishItem:
    """Build a WishItem from a wish_items DB row and the child's current coins."""
    coins_needed = None
    if row["final_cost"] is not None:
        coins_needed = max(0, row["final_cost"] - child_coins)
    return WishItem(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        ai_suggested_cost=row["ai_suggested_cost"],
        final_cost=row["final_cost"],
        ai_category=row["ai_category"],
        ai_reasoning=row["ai_reasoning"],
        parent_note=row["parent_note"],
        coins_needed=coins_needed,
        created_at=row["created_at"],
        redeemed_at=row["redeemed_at"],
        delivered_at=row["delivered_at"],
    )


# ---------------------------------------------------------------------------
# Pricing background task
# ---------------------------------------------------------------------------


def _run_pricing(wish_id: str, title: str, grade: int) -> None:
    """Call the pricing agent and write the result back to wish_items.

    Falls back to cost=500 / category='other' if the agent is unavailable
    or raises. The IS NULL guard prevents double-writes if this fires twice.
    """
    cost, category, reasoning = 500, "other", ""

    if _PRICING_AGENT_AVAILABLE:
        try:
            result = _price_wish(_PriceRequest(wish_id=wish_id, title=title, grade=grade))
            cost = result.cost
            category = result.category
            reasoning = result.reasoning
        except Exception:
            logger.exception(
                "Pricing agent failed for wish %s — falling back to cost=500", wish_id
            )

    (
        get_admin_supabase()
        .table("wish_items")
        .update({
            "ai_suggested_cost": cost,
            "final_cost": cost,
            "ai_category": category,
            "ai_reasoning": reasoning,
        })
        .eq("id", wish_id)
        .is_("ai_suggested_cost", "null")
        .execute()
    )


# ---------------------------------------------------------------------------
# POST /child/wishes — submit a new wish
# ---------------------------------------------------------------------------


@child_router.post(
    "/wishes",
    response_model=SubmitWishResponse,
    status_code=201,
    summary="Submit a new wish. Dispatches AI pricing in the background immediately.",
)
async def submit_wish(
    body: SubmitWishRequest,
    background_tasks: BackgroundTasks,
    current: AuthUser = Depends(get_current_user),
) -> SubmitWishResponse:
    """Insert a wish row with status=pending_approval and return immediately.

    The AI pricing task runs in the background. The frontend polls
    ``GET /child/wishes`` every 5 seconds until ``ai_suggested_cost`` is
    no longer null.
    """
    child_row = _require_child(current)
    admin = get_admin_supabase()

    res = (
        admin.table("wish_items")
        .insert({"child_id": child_row["id"], "title": body.title, "status": "pending_approval"})
        .execute()
    )
    row = res.data[0]
    background_tasks.add_task(_run_pricing, row["id"], body.title, child_row["grade"])

    return SubmitWishResponse(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        ai_suggested_cost=None,
    )


# ---------------------------------------------------------------------------
# GET /child/wishes — wishlist + coin balance
# ---------------------------------------------------------------------------


@child_router.get(
    "/wishes",
    response_model=ChildWishlistResponse,
    summary="Return the child's full wishlist (including rejected wishes) and coin balance.",
)
async def get_wishlist(
    current: AuthUser = Depends(get_current_user),
) -> ChildWishlistResponse:
    child_row = _require_child(current)
    coins = child_row["coins"]
    admin = get_admin_supabase()

    res = (
        admin.table("wish_items")
        .select(
            "id, title, status, ai_suggested_cost, final_cost, ai_category, "
            "ai_reasoning, parent_note, created_at, redeemed_at, delivered_at"
        )
        .eq("child_id", child_row["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return ChildWishlistResponse(
        coins=coins,
        wishes=[_build_wish_item(row, coins) for row in res.data or []],
    )


# ---------------------------------------------------------------------------
# POST /child/wishes/{wish_id}/redeem — atomic coin spend via Postgres RPC
# ---------------------------------------------------------------------------


@child_router.post(
    "/wishes/{wish_id}/redeem",
    response_model=RedeemWishResponse,
    summary="Redeem an approved wish. Atomically deducts coins via a Postgres function.",
)
async def redeem_wish(
    wish_id: str,
    current: AuthUser = Depends(get_current_user),
) -> RedeemWishResponse:
    """Calls the ``redeem_wish`` Postgres function which holds row-level locks
    on both the wish and the child's coins row to prevent double-spend.
    """
    child_row = _require_child(current)

    try:
        uuid.UUID(wish_id)
    except ValueError:
        raise WishNotFound(f"Wish '{wish_id}' not found.")

    admin = get_admin_supabase()
    result = admin.rpc(
        "redeem_wish", {"p_wish_id": wish_id, "p_child_id": child_row["id"]}
    ).execute()

    data = result.data
    if isinstance(data, list):
        data = data[0] if data else {}

    error = (data or {}).get("error")
    if error in ("wish_not_found", "forbidden"):
        raise WishNotFound(f"Wish '{wish_id}' not found.")
    if error == "invalid_status":
        raise APIError(
            f"Wish cannot be redeemed in status: {data.get('status', 'unknown')}",
            code="invalid_wish_status",
            status_code=400,
        )
    if error == "insufficient_coins":
        raise APIError(
            "Not enough coins",
            code="insufficient_coins",
            status_code=400,
        )

    return RedeemWishResponse(
        new_balance=data["new_balance"],
        wish=WishStatusResponse(id=uuid.UUID(wish_id), status="redeemed"),
    )


# ---------------------------------------------------------------------------
# GET /parent/wishes — all wishes across the parent's children
# ---------------------------------------------------------------------------


@parent_router.get(
    "/wishes",
    response_model=ParentWishlistResponse,
    summary="Return all wishes across the parent's children, with a pending action count.",
)
async def get_parent_wishes(
    child_id: str | None = None,
    status: str | None = None,
    current: AuthUser = Depends(get_current_user),
) -> ParentWishlistResponse:
    """Optional query params:
    - ``child_id`` — filter to one child.
    - ``status``   — filter by wish status.

    ``pending_count`` is always the total of pending_approval + redeemed
    across all the parent's children, regardless of the filter params.
    """
    _require_parent(current)
    admin = get_admin_supabase()

    # Step 1: child user IDs for this parent
    users_res = (
        admin.table("users")
        .select("id")
        .eq("parent_id", str(current.id))
        .eq("role", "child")
        .execute()
    )
    child_user_ids = [u["id"] for u in users_res.data or []]
    if not child_user_ids:
        return ParentWishlistResponse(pending_count=0, wishes=[])

    # Step 2: children rows (id → user_id, coins)
    children_res = (
        admin.table("children")
        .select("id, user_id, coins")
        .in_("user_id", child_user_ids)
        .execute()
    )
    children_rows = children_res.data or []
    child_id_to_user_id = {c["id"]: c["user_id"] for c in children_rows}
    child_id_to_coins = {c["id"]: c["coins"] for c in children_rows}
    all_child_ids = list(child_id_to_user_id.keys())

    # Step 3: display names
    names_res = (
        admin.table("users")
        .select("id, display_name")
        .in_("id", child_user_ids)
        .execute()
    )
    user_id_to_name = {u["id"]: u["display_name"] for u in names_res.data or []}

    # Step 4: all wishes — fetch unfiltered so pending_count is always correct
    all_res = (
        admin.table("wish_items")
        .select(
            "id, child_id, title, status, ai_suggested_cost, final_cost, "
            "ai_category, ai_reasoning, parent_note, created_at, redeemed_at, delivered_at"
        )
        .in_("child_id", all_child_ids)
        .execute()
    )
    all_rows = all_res.data or []

    # pending_count: pending_approval + redeemed across all children
    pending_count = sum(
        1 for w in all_rows if w["status"] in ("pending_approval", "redeemed")
    )

    # Apply optional filters in Python (after computing pending_count)
    filtered = all_rows
    if child_id:
        filtered = [w for w in filtered if w["child_id"] == child_id]
    if status:
        filtered = [w for w in filtered if w["status"] == status]

    # Sort: pending_approval → redeemed → rest; within each group newest first
    def _sort_key(w: dict) -> tuple:
        order = _STATUS_SORT_ORDER.get(w["status"], 2)
        ts = datetime.fromisoformat(w["created_at"])
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return (order, -ts.timestamp())

    filtered.sort(key=_sort_key)

    wishes = []
    for row in filtered:
        cid = row["child_id"]
        child_coins = child_id_to_coins.get(cid, 0)
        user_id = child_id_to_user_id.get(cid, "")
        coins_needed = None
        if row["final_cost"] is not None:
            coins_needed = max(0, row["final_cost"] - child_coins)
        wishes.append(
            WishItemWithChild(
                id=row["id"],
                title=row["title"],
                status=row["status"],
                ai_suggested_cost=row["ai_suggested_cost"],
                final_cost=row["final_cost"],
                ai_category=row["ai_category"],
                ai_reasoning=row["ai_reasoning"],
                parent_note=row["parent_note"],
                coins_needed=coins_needed,
                created_at=row["created_at"],
                redeemed_at=row["redeemed_at"],
                delivered_at=row["delivered_at"],
                child_id=uuid.UUID(cid),
                child_name=user_id_to_name.get(user_id, ""),
            )
        )

    return ParentWishlistResponse(pending_count=pending_count, wishes=wishes)


# ---------------------------------------------------------------------------
# PATCH /parent/wishes/{wish_id}/review — approve or reject
# ---------------------------------------------------------------------------


@parent_router.patch(
    "/wishes/{wish_id}/review",
    response_model=WishActionResponse,
    summary="Approve or reject a pending wish (parent-authed).",
)
async def review_wish(
    wish_id: str,
    body: ReviewWishRequest,
    current: AuthUser = Depends(get_current_user),
) -> WishActionResponse:
    """Valid transitions: pending_approval → approved / rejected.

    ``final_cost`` is required when action='approve'. The parent can
    adjust the AI-suggested cost before approving.
    """
    _require_parent(current)

    if body.action not in ("approve", "reject"):
        raise APIError(
            "action must be 'approve' or 'reject'",
            code="invalid_action",
            status_code=422,
        )
    if body.action == "approve" and body.final_cost is None:
        raise APIError(
            "final_cost is required when approving a wish",
            code="missing_final_cost",
            status_code=422,
        )

    admin = get_admin_supabase()
    wish_row = _get_wish_owned_by_parent(wish_id, str(current.id), admin)

    if wish_row["status"] != "pending_approval":
        raise APIError(
            f"Wish cannot be reviewed in status: {wish_row['status']}",
            code="invalid_wish_status",
            status_code=400,
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    if body.action == "approve":
        admin.table("wish_items").update({
            "status": "approved",
            "final_cost": body.final_cost,
            "reviewed_at": now_iso,
        }).eq("id", wish_id).execute()
        new_status = "approved"
    else:
        admin.table("wish_items").update({
            "status": "rejected",
            "parent_note": body.parent_note,
            "reviewed_at": now_iso,
        }).eq("id", wish_id).execute()
        new_status = "rejected"

    return WishActionResponse(wish=WishStatusResponse(id=uuid.UUID(wish_id), status=new_status))


# ---------------------------------------------------------------------------
# PATCH /parent/wishes/{wish_id}/deliver — mark redeemed wish as delivered
# ---------------------------------------------------------------------------


@parent_router.patch(
    "/wishes/{wish_id}/deliver",
    response_model=WishActionResponse,
    summary="Mark a redeemed wish as delivered in real life (parent-authed).",
)
async def deliver_wish(
    wish_id: str,
    current: AuthUser = Depends(get_current_user),
) -> WishActionResponse:
    """Valid transition: redeemed → delivered."""
    _require_parent(current)
    admin = get_admin_supabase()
    wish_row = _get_wish_owned_by_parent(wish_id, str(current.id), admin)

    if wish_row["status"] != "redeemed":
        raise APIError(
            f"Wish cannot be delivered in status: {wish_row['status']}",
            code="invalid_wish_status",
            status_code=400,
        )

    admin.table("wish_items").update({
        "status": "delivered",
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", wish_id).execute()

    return WishActionResponse(wish=WishStatusResponse(id=uuid.UUID(wish_id), status="delivered"))


# ---------------------------------------------------------------------------
# GET /parent/children/{child_id}/wishes — one child's wishlist (parent view)
# ---------------------------------------------------------------------------


@parent_router.get(
    "/children/{child_id}/wishes",
    response_model=ParentChildWishesResponse,
    summary="Return all wishes for one child (parent-authed).",
)
async def get_child_wishes(
    child_id: str,
    status: str | None = None,
    current: AuthUser = Depends(get_current_user),
) -> ParentChildWishesResponse:
    """Return every wish for the specified child.

    Optional ``?status`` query param filters by wish status.
    Returns ``404 child_not_found`` if the child doesn't exist or belongs
    to another parent.
    """
    _require_parent(current)
    admin = get_admin_supabase()

    try:
        uuid.UUID(child_id)
    except ValueError:
        raise ChildNotFound(f"Child '{child_id}' not found.")

    child_res = (
        admin.table("children")
        .select("id, user_id, coins")
        .eq("id", child_id)
        .limit(1)
        .execute()
    )
    if not child_res.data:
        raise ChildNotFound(f"Child '{child_id}' not found.")
    child_row = child_res.data[0]

    user_res = (
        admin.table("users")
        .select("parent_id")
        .eq("id", child_row["user_id"])
        .limit(1)
        .execute()
    )
    if not user_res.data or user_res.data[0]["parent_id"] != str(current.id):
        raise ChildNotFound(f"Child '{child_id}' not found.")

    query = (
        admin.table("wish_items")
        .select(
            "id, title, status, ai_suggested_cost, final_cost, ai_category, "
            "ai_reasoning, parent_note, created_at, redeemed_at, delivered_at"
        )
        .eq("child_id", child_row["id"])
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    res = query.execute()

    coins = child_row["coins"]
    return ParentChildWishesResponse(
        child_id=uuid.UUID(child_id),
        coins=coins,
        wishes=[_build_wish_item(row, coins) for row in res.data or []],
    )
