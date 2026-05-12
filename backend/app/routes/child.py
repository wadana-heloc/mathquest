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
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.errors import APIError, ForbiddenRole, NotAuthenticated
from app.schemas.parent import (
    ChildProfile,
    LifetimeStats,
    StatsSummaryResponse,
    StreakResponse,
    StreakUpdateRequest,
    StoryResponse,
    TodayStats,
    WeekStats,
)
from app.schemas.tricks import UnlockedTrick, UnlockedTricksResponse
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
# GET /child/tricks — return tricks the child has unlocked
# -----------------------------------------------------------------------------


@router.get(
    "/tricks",
    response_model=UnlockedTricksResponse,
    summary="Return all tricks the child has unlocked (unlocked=true in trick_discoveries).",
)
async def get_my_unlocked_tricks(
    current: AuthUser = Depends(get_current_user),
) -> UnlockedTricksResponse:
    """Return every trick the child has unlocked (``unlocked = true``).

    A trick unlocks after 3 insight detections (correct + fast + no hints).
    Returns an empty list when no tricks are unlocked yet.
    """
    _, child_row = _require_child(current)
    child_id = child_row["id"]
    admin = get_admin_supabase()

    discoveries_res = (
        admin.table("trick_discoveries")
        .select("trick_id, insight_count, unlocked_at")
        .eq("child_id", child_id)
        .eq("unlocked", True)
        .execute()
    )
    if not discoveries_res.data:
        return UnlockedTricksResponse(unlocked_tricks=[])

    trick_ids = [row["trick_id"] for row in discoveries_res.data]
    tricks_res = (
        admin.table("tricks")
        .select("id, name, category, description")
        .in_("id", trick_ids)
        .execute()
    )
    tricks_map = {row["id"]: row for row in tricks_res.data}

    unlocked = []
    for discovery in discoveries_res.data:
        trick = tricks_map.get(discovery["trick_id"])
        if trick is None:
            logger.warning("trick '%s' missing from tricks table — skipping", discovery["trick_id"])
            continue
        unlocked.append(
            UnlockedTrick(
                trick_id=trick["id"],
                name=trick["name"],
                category=trick["category"],
                description=trick["description"],
                insight_count=discovery["insight_count"],
                unlocked_at=discovery["unlocked_at"],
            )
        )

    return UnlockedTricksResponse(unlocked_tricks=unlocked)


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


# -----------------------------------------------------------------------------
# GET /child/stats/summary — lifetime, today, and this-week stats panel
# -----------------------------------------------------------------------------

_DAILY_GOAL = 5


@router.get(
    "/stats/summary",
    response_model=StatsSummaryResponse,
    summary="Powers the child stats panel — lifetime records, today's progress, and this week.",
)
async def get_stats_summary(
    current: AuthUser = Depends(get_current_user),
) -> StatsSummaryResponse:
    """Aggregate stats across three time windows.

    * ``lifetime`` — all-time records (attempts, accuracy, fastest solve, tricks/insights).
    * ``today``    — UTC day progress against the hardcoded daily goal of 5 problems.
    * ``this_week``— Mon–Sun UTC window (current calendar week).

    ``correct`` always means first-try correct: ``solved_correctly=true AND
    previously_failed=false``, consistent with all other analysis endpoints.
    """
    _, child_row = _require_child(current)
    child_id = child_row["id"]
    admin = get_admin_supabase()

    # --- date boundaries (UTC) -----------------------------------------------
    now = datetime.now(timezone.utc)
    today_date = now.date()
    week_start_date = today_date - timedelta(days=today_date.weekday())  # Monday

    # --- Q1: all problem_attempts for this child ------------------------------
    all_res = (
        admin.table("problem_attempts")
        .select("problem_id, solved_correctly, previously_failed, duration_ms, hints_used, answered_at")
        .eq("child_id", child_id)
        .execute()
    )
    all_attempts = all_res.data or []

    # --- partition into lifetime buckets -------------------------------------
    today_attempts: list[dict] = []
    week_attempts: list[dict] = []
    total_correct = 0
    fastest_correct_ms: int | None = None
    fastest_correct_problem_id: str | None = None

    for a in all_attempts:
        ts = datetime.fromisoformat(a["answered_at"])
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        a_date = ts.date()

        if a["solved_correctly"] and not a["previously_failed"]:
            total_correct += 1

        dur = a["duration_ms"]
        if a["solved_correctly"] and dur is not None:
            if fastest_correct_ms is None or dur < fastest_correct_ms:
                fastest_correct_ms = dur
                fastest_correct_problem_id = a["problem_id"]

        if a_date == today_date:
            today_attempts.append(a)
        if a_date >= week_start_date:
            week_attempts.append(a)

    total_attempted = len(all_attempts)
    correct_rate = round(total_correct / total_attempted * 100) if total_attempted else 0

    # --- Q2: stem of fastest lifetime solve -----------------------------------
    fastest_stem: str | None = None
    if fastest_correct_problem_id:
        stem_res = (
            admin.table("problems")
            .select("stem")
            .eq("id", fastest_correct_problem_id)
            .limit(1)
            .execute()
        )
        if stem_res.data:
            fastest_stem = stem_res.data[0]["stem"]

    # --- Q3: trick_discoveries — unlocked count + total insights -------------
    # insight_detected is tracked per-trick as insight_count in trick_discoveries,
    # not as a column on problem_attempts.
    discoveries_res = (
        admin.table("trick_discoveries")
        .select("insight_count, unlocked")
        .eq("child_id", child_id)
        .execute()
    )
    discoveries = discoveries_res.data or []
    tricks_unlocked = sum(1 for d in discoveries if d["unlocked"])
    total_insights = sum(d["insight_count"] or 0 for d in discoveries)

    # --- today stats ---------------------------------------------------------
    today_attempted = len(today_attempts)
    today_correct = sum(
        1 for a in today_attempts if a["solved_correctly"] and not a["previously_failed"]
    )
    today_hints = sum(a["hints_used"] or 0 for a in today_attempts)
    today_fastest_ms: int | None = None
    for a in today_attempts:
        dur = a["duration_ms"]
        if a["solved_correctly"] and dur is not None:
            if today_fastest_ms is None or dur < today_fastest_ms:
                today_fastest_ms = dur

    # --- this-week stats -----------------------------------------------------
    week_attempted = len(week_attempts)
    week_correct = sum(
        1 for a in week_attempts if a["solved_correctly"] and not a["previously_failed"]
    )
    week_correct_rate = round(week_correct / week_attempted * 100) if week_attempted else 0
    week_days_active = len(
        {datetime.fromisoformat(a["answered_at"]).date() for a in week_attempts}
    )

    return StatsSummaryResponse(
        lifetime=LifetimeStats(
            total_attempted=total_attempted,
            total_correct=total_correct,
            correct_rate=correct_rate,
            fastest_solve_ms=fastest_correct_ms,
            fastest_problem=fastest_stem,
            tricks_unlocked=tricks_unlocked,
            total_insights=total_insights,
        ),
        today=TodayStats(
            attempted=today_attempted,
            correct=today_correct,
            daily_goal=_DAILY_GOAL,
            hints_used=today_hints,
            fastest_today_ms=today_fastest_ms,
        ),
        this_week=WeekStats(
            attempted=week_attempted,
            correct=week_correct,
            correct_rate=week_correct_rate,
            days_active=week_days_active,
        ),
    )


# -----------------------------------------------------------------------------
# GET /child/stories/latest — most recent approved story for this child
# -----------------------------------------------------------------------------


@router.get(
    "/stories/latest",
    response_model=StoryResponse | None,
    summary="Return the latest approved story for the authenticated child, or null if none.",
)
async def get_latest_story(
    current: AuthUser = Depends(get_current_user),
) -> StoryResponse | None:
    """Return the most recently saved story for the child.

    Returns ``null`` (200) when no story has been approved yet so the
    frontend can render a 'no story yet' state without catching a 404.
    """
    _, child_row = _require_child(current)
    child_id = child_row["id"]
    admin = get_admin_supabase()

    res = (
        admin.table("stories")
        .select("id, child_id, chapters, word_count, created_at")
        .eq("child_id", child_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    return StoryResponse(
        id=row["id"],
        child_id=row["child_id"],
        chapters=row["chapters"],
        word_count=row["word_count"],
        created_at=row["created_at"],
    )
