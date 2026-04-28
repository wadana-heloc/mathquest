"""Problems endpoints.

All endpoints require a bearer token whose public.users row has role='child'.
The role is verified from the database on every call — never trusted from the JWT.

Endpoints:
* GET  /problems        — fetch a batch of problems for the child's zone.
* POST /problems/attempt — submit an answer; awards coins and updates streak.
* POST /problems/hint    — request the next hint tier; deducts coin cost.

AI model integration is TODO. Until the AI engineer's model is ready, GET
/problems queries the seeded problems table directly. When AI is ready, the
flow becomes: call model → INSERT returned problem → serve to client.
"""

from __future__ import annotations

import datetime
import logging
import math
import random
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from typing import List, Optional

from app.errors import (
    APIError,
    ForbiddenRole,
    InsufficientCoins,
    NotAuthenticated,
    ProblemNotFound,
    SessionInvalid,
)
from app.schemas.problems import (
    AttemptRequest,
    AttemptResponse,
    HintRequest,
    HintResponse,
    HintItem,
    ProblemResponse,
    ProblemsListResponse,
)
from app.security import AuthUser, get_current_user
from app.supabase_clients import get_admin_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/problems", tags=["problems"])

BASE_COINS = 10
DAILY_CAP = 300
INSIGHT_THRESHOLD = 3       # insights needed to unlock a trick
BATCH_SIZE = 5              # problems returned per GET /problems call
HINT_COSTS = {1: 0, 2: 5, 3: 15}


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _get_child_context(current: AuthUser) -> tuple[dict[str, Any], dict[str, Any], int]:
    """Return (user_row, child_row, parent_difficulty_ceiling).

    Verifies the caller has role='child'. Raises ForbiddenRole otherwise.
    parent_difficulty_ceiling defaults to 10 if the parent_settings row is
    missing (should not happen in normal operation).
    """
    admin = get_admin_supabase()

    user_res = (
        admin.table("users")
        .select("role, parent_id")
        .eq("id", str(current.id))
        .limit(1)
        .execute()
    )
    if not user_res.data:
        raise NotAuthenticated("Profile row missing for authenticated user.")
    user_row = user_res.data[0]
    if user_row["role"] != "child":
        raise ForbiddenRole("Only children can access problems.")

    child_res = (
        admin.table("children")
        .select("*")
        .eq("user_id", str(current.id))
        .limit(1)
        .execute()
    )
    if not child_res.data:
        raise APIError(
            "Child profile missing.",
            code="child_profile_missing",
            status_code=500,
        )
    child_row = child_res.data[0]

    parent_res = (
        admin.table("parent_settings")
        .select("difficulty_ceiling")
        .eq("parent_id", user_row["parent_id"])
        .limit(1)
        .execute()
    )
    parent_ceiling = (
        parent_res.data[0]["difficulty_ceiling"] if parent_res.data else 10
    )

    return user_row, child_row, parent_ceiling


def _ensure_session(session_id: uuid.UUID, child_id: str) -> None:
    """Validate the session belongs to this child; create it implicitly if new.

    Until POST /problems/session is built, the frontend generates a UUID for
    the session and we insert the first time we see it. Once the session
    endpoint exists, rows will be pre-created and we will only validate here.
    """
    admin = get_admin_supabase()

    res = (
        admin.table("sessions")
        .select("child_id, is_active")
        .eq("id", str(session_id))
        .limit(1)
        .execute()
    )

    if not res.data:
        # Implicit creation — session endpoint is TODO.
        admin.table("sessions").insert(
            {"id": str(session_id), "child_id": child_id}
        ).execute()
        return

    session = res.data[0]
    if session["child_id"] != child_id:
        raise SessionInvalid("Session does not belong to this child.")
    if not session["is_active"]:
        raise SessionInvalid("Session has ended.")


def _check_answer(answer_type: str, stored: str, submitted: str) -> bool:
    """Return True if the submitted answer matches the stored answer."""
    s = submitted.strip()
    t = stored.strip()

    if answer_type == "exact":
        try:
            return math.isclose(float(s), float(t), rel_tol=1e-9)
        except (ValueError, TypeError):
            return s.lower() == t.lower()

    if answer_type == "set":
        return s.lower() == t.lower()

    if answer_type == "range":
        # Stored as "low,high".
        try:
            low, high = map(float, t.split(","))
            return low <= float(s) <= high
        except (ValueError, TypeError):
            return False

    return False


def _coins_for_attempt(correct: bool, insight: bool, hint_level_used: int) -> int:
    """Return raw coins earned before the daily cap is applied."""
    if not correct:
        return 0
    if insight:
        return round(BASE_COINS * 3)
    multipliers = {0: 1.0, 1: 0.7, 2: 0.5, 3: 0.3}
    return round(BASE_COINS * multipliers.get(hint_level_used, 0.0))


def _apply_daily_reset(child_row: dict[str, Any]) -> tuple[int, bool]:
    """Return (current_daily_earned, did_reset).

    Checks whether the 24 h rolling window has expired. If so, the
    caller must include daily_coins_reset_at in the children UPDATE.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    reset_str = child_row["daily_coins_reset_at"]
    # PostgREST returns timestamptz as ISO-8601 with offset or 'Z'.
    reset_at = datetime.datetime.fromisoformat(
        reset_str.replace("Z", "+00:00")
    )
    if (now - reset_at).total_seconds() >= 86400:
        return 0, True
    return child_row["daily_coins_earned"], False


def _update_trick_insight(child_id: str, trick_ids: list[str]) -> str | None:
    """Increment insight_count for each trick; return the first one just unlocked."""
    admin = get_admin_supabase()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    trick_unlocked: str | None = None

    for trick_id in trick_ids:
        res = (
            admin.table("trick_discoveries")
            .select("id, insight_count, unlocked")
            .eq("child_id", child_id)
            .eq("trick_id", trick_id)
            .limit(1)
            .execute()
        )

        if res.data:
            row = res.data[0]
            new_count = row["insight_count"] + 1
            update: dict[str, Any] = {
                "insight_count": new_count,
                "last_insight_at": now,
            }
            newly_unlocked = new_count >= INSIGHT_THRESHOLD and not row["unlocked"]
            if newly_unlocked:
                update["unlocked"] = True
                update["unlocked_at"] = now
            admin.table("trick_discoveries").update(update).eq(
                "id", row["id"]
            ).execute()
            if newly_unlocked and trick_unlocked is None:
                trick_unlocked = trick_id
        else:
            admin.table("trick_discoveries").insert(
                {
                    "child_id": child_id,
                    "trick_id": trick_id,
                    "insight_count": 1,
                    "last_insight_at": now,
                }
            ).execute()

    return trick_unlocked


def _row_to_problem_response(row: dict[str, Any]) -> ProblemResponse:
    hints = [HintItem(**h) for h in (row.get("hints") or [])]
    return ProblemResponse(
        id=row["id"],
        zone=row["zone"],
        category=row["category"],
        difficulty=row["difficulty"],
        stem=row["stem"],
        answer_type=row["answer_type"],
        hints=hints,
        flavor_text=row.get("flavor_text"),
        tags=row.get("tags") or [],
    )


# -----------------------------------------------------------------------------
# GET /problems — fetch a batch
# -----------------------------------------------------------------------------


@router.get(
    "",
    response_model=ProblemsListResponse,
    summary="Fetch a batch of problems for the authenticated child.",
)
async def get_problems(
    zone: int = Query(..., ge=1, le=5, description="Zone number (1–5)."),
    difficulty: Optional[int] = Query(
        None,
        ge=1,
        le=10,
        description="Override difficulty. Cannot exceed the parent-set ceiling.",
    ),
    exclude_ids: List[uuid.UUID] = Query(
        default=[],
        description="Problem UUIDs already seen in the current session.",
    ),
    current: AuthUser = Depends(get_current_user),
) -> ProblemsListResponse:
    """Return up to 5 randomised problems for the requested zone.

    Difficulty is capped at min(child.difficulty_ceiling, parent ceiling).
    The answer, shortcut_path, and shortcut_time_threshold_ms columns are
    never selected — they remain server-side only.

    TODO (AI integration): replace the DB query with a model call, INSERT
    the returned problem, and serve the UUID-backed row.
    """
    _, child_row, parent_ceiling = _get_child_context(current)

    # Effective difficulty: use override or adaptive target; cap at both ceilings.
    base = difficulty if difficulty is not None else child_row["current_difficulty"]
    effective = min(base, child_row["difficulty_ceiling"], parent_ceiling)

    admin = get_admin_supabase()
    res = (
        admin.table("problems")
        .select(
            "id, zone, category, difficulty, stem, answer_type, hints, flavor_text, tags"
        )
        .eq("zone", zone)
        .lte("difficulty", effective)
        .execute()
    )

    rows = res.data or []

    # Filter already-seen problems for this session.
    if exclude_ids:
        exclude_set = {str(eid) for eid in exclude_ids}
        rows = [r for r in rows if str(r["id"]) not in exclude_set]

    random.shuffle(rows)
    return ProblemsListResponse(
        problems=[_row_to_problem_response(r) for r in rows[:BATCH_SIZE]]
    )


# -----------------------------------------------------------------------------
# POST /problems/attempt — submit an answer
# -----------------------------------------------------------------------------


@router.post(
    "/attempt",
    response_model=AttemptResponse,
    summary="Submit the child's answer to a problem.",
)
async def attempt_problem(
    payload: AttemptRequest,
    current: AuthUser = Depends(get_current_user),
) -> AttemptResponse:
    """Verify the answer, award coins, update streak and trick discoveries.

    Coin logic (TDD §6.4):
      - Correct + insight (fast, no hints): 3× base coins
      - Correct + no hints, normal speed:   1× base coins
      - Correct + hint level 1 used:        0.7× base coins
      - Correct + hint level 2 used:        0.5× base coins
      - Correct + hint level 3 used:        0.3× base coins, no insight
      - Incorrect: 0 coins
    Daily cap: 300 coins. Deduction happens at hint request time (hint endpoint).

    insight_detected is raised when: correct AND hint_level_used == 0 AND
    duration_ms < shortcut_time_threshold_ms for the problem.
    """
    _, child_row, _ = _get_child_context(current)
    _ensure_session(payload.session_id, child_row["id"])

    admin = get_admin_supabase()

    # Fetch problem including server-only fields needed for verification.
    prob_res = (
        admin.table("problems")
        .select("id, answer, answer_type, shortcut_time_threshold_ms, trick_ids")
        .eq("id", str(payload.problem_id))
        .limit(1)
        .execute()
    )
    if not prob_res.data:
        raise ProblemNotFound(f"Problem {payload.problem_id} not found.")
    problem = prob_res.data[0]

    # Answer verification.
    correct = _check_answer(
        problem["answer_type"], problem["answer"], payload.answer
    )

    # Insight detection: correct + no hints + faster than the shortcut threshold.
    threshold_ms = problem.get("shortcut_time_threshold_ms")
    insight_detected = (
        correct
        and payload.hint_level_used == 0
        and threshold_ms is not None
        and payload.duration_ms <= threshold_ms
    )

    # Daily reset check.
    daily_earned, did_reset = _apply_daily_reset(child_row)

    # Coin calculation with daily cap.
    raw_coins = _coins_for_attempt(correct, insight_detected, payload.hint_level_used)
    daily_cap_reached = False

    if daily_earned >= DAILY_CAP:
        coins_awarded = 0
        daily_cap_reached = True
    else:
        coins_awarded = min(raw_coins, DAILY_CAP - daily_earned)
        if daily_earned + coins_awarded >= DAILY_CAP:
            daily_cap_reached = True

    # Streak update.
    if correct:
        new_streak = child_row["streak_current"] + 1
        new_streak_best = max(new_streak, child_row["streak_best"])
    else:
        new_streak = 0
        new_streak_best = child_row["streak_best"]

    # Build children UPDATE.
    child_update: dict[str, Any] = {
        "streak_current": new_streak,
        "streak_best": new_streak_best,
    }
    if coins_awarded > 0:
        child_update["coins"] = child_row["coins"] + coins_awarded
        child_update["daily_coins_earned"] = daily_earned + coins_awarded
    if did_reset:
        child_update["daily_coins_reset_at"] = (
            datetime.datetime.now(datetime.timezone.utc).isoformat()
        )
        # daily_earned was reset to 0, so daily_coins_earned = only what we just awarded.
        child_update["daily_coins_earned"] = coins_awarded

    admin.table("children").update(child_update).eq(
        "id", child_row["id"]
    ).execute()

    # Re-fetch to get authoritative balance (don't trust UPDATE .data).
    updated_res = (
        admin.table("children")
        .select("coins, streak_current")
        .eq("id", child_row["id"])
        .limit(1)
        .execute()
    )
    if updated_res.data:
        new_balance = updated_res.data[0]["coins"]
        streak_count = updated_res.data[0]["streak_current"]
    else:
        # Fallback: compute locally — better than a 500.
        new_balance = child_row["coins"] + coins_awarded
        streak_count = new_streak

    # Trick insight tracking.
    trick_unlocked: str | None = None
    if insight_detected:
        trick_ids: list[str] = problem.get("trick_ids") or []
        if trick_ids:
            trick_unlocked = _update_trick_insight(child_row["id"], trick_ids)

    return AttemptResponse(
        correct=correct,
        coins_awarded=coins_awarded,
        insight_detected=insight_detected,
        new_balance=new_balance,
        streak_count=streak_count,
        trick_unlocked=trick_unlocked,
        daily_cap_reached=daily_cap_reached,
    )


# -----------------------------------------------------------------------------
# POST /problems/hint — request the next hint tier
# -----------------------------------------------------------------------------


@router.post(
    "/hint",
    response_model=HintResponse,
    summary="Request the next hint tier for an active problem.",
)
async def request_hint(
    payload: HintRequest,
    current: AuthUser = Depends(get_current_user),
) -> HintResponse:
    """Return the requested hint tier and deduct its coin cost.

    Hint costs (TDD §08): level 1 = 0 coins, level 2 = 5 coins, level 3 = 15 coins.
    The child must have sufficient coins for levels 2 and 3 — if not, raises
    InsufficientCoins (422) and the hint is NOT revealed.

    Sequence enforcement (hint_level must be the next tier in order) is a
    TODO pending the problem_attempts table being added.
    """
    _, child_row, _ = _get_child_context(current)
    _ensure_session(payload.session_id, child_row["id"])

    admin = get_admin_supabase()

    prob_res = (
        admin.table("problems")
        .select("hints")
        .eq("id", str(payload.problem_id))
        .limit(1)
        .execute()
    )
    if not prob_res.data:
        raise ProblemNotFound(f"Problem {payload.problem_id} not found.")

    hints: list[dict[str, Any]] = prob_res.data[0].get("hints") or []
    hint_row = next((h for h in hints if h.get("level") == payload.hint_level), None)
    if hint_row is None:
        raise APIError(
            f"Hint level {payload.hint_level} not found for this problem.",
            code="hint_not_found",
            status_code=404,
        )

    cost = HINT_COSTS.get(payload.hint_level, 0)

    if cost > 0:
        if child_row["coins"] < cost:
            raise InsufficientCoins(
                f"This hint costs {cost} coins but your balance is {child_row['coins']}."
            )
        new_coins = child_row["coins"] - cost
        admin.table("children").update({"coins": new_coins}).eq(
            "id", child_row["id"]
        ).execute()
        # Re-fetch authoritative balance.
        bal_res = (
            admin.table("children")
            .select("coins")
            .eq("id", child_row["id"])
            .limit(1)
            .execute()
        )
        new_balance = bal_res.data[0]["coins"] if bal_res.data else new_coins
    else:
        new_balance = child_row["coins"]

    return HintResponse(
        hint_text=hint_row["text"],
        cost_paid=cost,
        new_balance=new_balance,
    )
