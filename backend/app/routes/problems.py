"""Problems endpoints.

All endpoints require a bearer token whose public.users row has role='child'.
The role is verified from the database on every call — never trusted from the JWT.

Endpoints:
* GET  /problems         — fetch the next recommended problem for the child.
* POST /problems/attempt — submit an answer; awards coins, updates streak and
                           advances difficulty/phase/trick via the AI adjuster.
* POST /problems/hint    — request the next hint tier; deducts coin cost.

AI integration: problem_recommender and difficulty_adjuster are imported
directly from the AI pipeline (same repo, no HTTP boundary). The pipeline
directory is added to sys.path at module load time.

POST /problems/attempt skips the adjuster when the problem has no trick_id.
"""

from __future__ import annotations

import datetime
import logging
import math
import sys
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends

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
DAILY_CAP = 600
INSIGHT_THRESHOLD = 3
HINT_COSTS = {1: 0, 2: 5, 3: 15}

# -----------------------------------------------------------------------------
# AI pipeline imports
# Wire in problem_recommender and difficulty_adjuster from the AI pipeline
# directory. These are pure Python functions — no HTTP boundary.
# -----------------------------------------------------------------------------

_AI_DIR = Path(__file__).parents[3] / "ai_agents" / "mathquest-questions-agent"
if str(_AI_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_DIR))

try:
    from problem_recommender import recommend  # type: ignore[import-untyped]
    from difficulty_adjuster import process_answer  # type: ignore[import-untyped]
    from difficulty_engine import get_eligible_tricks  # type: ignore[import-untyped]
    _AI_AVAILABLE = True
except Exception:
    logger.warning("AI pipeline not importable — recommender disabled.", exc_info=True)
    _AI_AVAILABLE = False


# -----------------------------------------------------------------------------
# Helpers — auth / context
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
    """Validate the session belongs to this child; create it implicitly if new."""
    admin = get_admin_supabase()

    res = (
        admin.table("sessions")
        .select("child_id, is_active")
        .eq("id", str(session_id))
        .limit(1)
        .execute()
    )

    if not res.data:
        admin.table("sessions").insert(
            {"id": str(session_id), "child_id": child_id}
        ).execute()
        return

    session = res.data[0]
    if session["child_id"] != child_id:
        raise SessionInvalid("Session does not belong to this child.")
    if not session["is_active"]:
        raise SessionInvalid("Session has ended.")


# -----------------------------------------------------------------------------
# Helpers — answer verification / coin logic
# -----------------------------------------------------------------------------


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
    """Return (current_daily_earned, did_reset)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    reset_str = child_row["daily_coins_reset_at"]
    reset_at = datetime.datetime.fromisoformat(reset_str.replace("Z", "+00:00"))
    if (now - reset_at).total_seconds() >= 86400:
        return 0, True
    return child_row["daily_coins_earned"], False


# -----------------------------------------------------------------------------
# Helpers — trick insight (TDD §06 mechanic, unchanged)
# -----------------------------------------------------------------------------


def _update_trick_insight(child_id: str, trick_ids: list[str]) -> str | None:
    """Increment insight_count for each trick; return the first one just unlocked."""
    admin = get_admin_supabase()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat() #Get the current time
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
            update: dict[str, Any] = {"insight_count": new_count, "last_insight_at": now}
            newly_unlocked = new_count >= INSIGHT_THRESHOLD and not row["unlocked"]
            if newly_unlocked:
                update["unlocked"] = True
                update["unlocked_at"] = now
            admin.table("trick_discoveries").update(update).eq("id", row["id"]).execute()
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


# -----------------------------------------------------------------------------
# Helpers — AI recommender
# -----------------------------------------------------------------------------


def _fetch_unlocked_tricks(child_id: str, admin: Any) -> list[str]:
    """Return trick IDs where unlocked=true for this child."""
    res = (
        admin.table("trick_discoveries")
        .select("trick_id")
        .eq("child_id", child_id)
        .eq("unlocked", True)
        .execute()
    )
    return [r["trick_id"] for r in (res.data or [])]


def _fetch_phase_row(child_id: str, trick_id: str, admin: Any) -> dict[str, Any] | None:
    """Return the trick_discoveries row for this child+trick, or None."""
    res = (
        admin.table("trick_discoveries")
        .select(
            "id, current_phase, discovery_problems_seen, "
            "practice_problems_solved, practice_problems_attempted"
        )
        .eq("child_id", child_id)
        .eq("trick_id", trick_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _ensure_trick_row(child_id: str, trick_id: str, admin: Any) -> None:
    """Insert a trick_discoveries row for this child+trick if it doesn't exist."""
    existing = (
        admin.table("trick_discoveries")
        .select("id")
        .eq("child_id", child_id)
        .eq("trick_id", trick_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        admin.table("trick_discoveries").insert(
            {
                "child_id": child_id,
                "trick_id": trick_id,
                "insight_count": 0,
                "current_phase": "discovery",
                "discovery_problems_seen": 0,
                "practice_problems_solved": 0,
                "practice_problems_attempted": 0,
            }
        ).execute()


def _fetch_attempts_summary(child_id: str, admin: Any) -> list[dict[str, Any]]:
    """Return all problem_attempts rows for this child (id, solved_correctly, previously_failed)."""
    res = (
        admin.table("problem_attempts")
        .select("problem_id, solved_correctly, previously_failed")
        .eq("child_id", child_id)
        .execute()
    )
    return res.data or []


async def _refill_problem_bank(
    child_row: dict[str, Any],
    refill_context: dict[str, Any],
    *,
    skip_if_count_gte: int = 2,
) -> dict[str, Any] | None:
    """Generate a new problem, insert it, and return the safe response fields.

    Returns a dict with id/zone/category/difficulty/stem/answer_type/hints/
    flavor_text/tags on success, or None on failure or when the guard skips.

    skip_if_count_gte: skip if this (trick, difficulty) slot already has this
    many problems.  Pass 0 to always generate (inline / bank-empty path).
    Default 2 prevents duplicate concurrent background inserts.
    """
    try:
        from orchestrator import run_pipeline  # type: ignore[import-untyped]
        from schemas import ChildProfileInput, ChildData, SessionStats, RecentProblem  # type: ignore[import-untyped]

        admin = get_admin_supabase()

        if skip_if_count_gte > 0:
            existing = (
                admin.table("problems")
                .select("id")
                .eq("trick_id", refill_context["trick_id"])
                .eq("difficulty", refill_context["difficulty"])
                .execute()
            )
            if len(existing.data or []) >= skip_if_count_gte:
                logger.info(
                    "Refill skipped: slot trick=%s difficulty=%d already has %d problems",
                    refill_context["trick_id"],
                    refill_context["difficulty"],
                    len(existing.data),
                )
                return None

        child_grade: int = child_row.get("grade", refill_context.get("grade", 3))
        unlocked = _fetch_unlocked_tricks(child_row["id"], admin)

        dob = child_row.get("date_of_birth")
        if dob:
            today = datetime.date.today()
            dob_date = datetime.date.fromisoformat(str(dob))
            age = today.year - dob_date.year - (
                (today.month, today.day) < (dob_date.month, dob_date.day)
            )
        else:
            age = child_grade + 5

        # Fetch last 5 attempts to give the AI context about recent problem history.
        attempts_res = (
            admin.table("problem_attempts")
            .select("problem_id, solved_correctly, hints_used, duration_ms, difficulty, attempts")
            .eq("child_id", child_row["id"])
            .order("answered_at", desc=True)
            .limit(5)
            .execute()
        )
        recent_attempts = attempts_res.data or []

        recent_problems: list[Any] = []
        if recent_attempts:
            prob_ids = [str(r["problem_id"]) for r in recent_attempts]
            probs_res = (
                admin.table("problems")
                .select("id, trick_id, stem")
                .in_("id", prob_ids)
                .execute()
            )
            prob_map = {str(p["id"]): p for p in (probs_res.data or [])}
            for r in recent_attempts:
                prob = prob_map.get(str(r["problem_id"]))
                if prob and prob.get("trick_id") and prob.get("stem"):
                    recent_problems.append(
                        RecentProblem(
                            trick_id=prob["trick_id"],
                            problem=prob["stem"],
                            solved=bool(r["solved_correctly"]),
                            hints_used=r["hints_used"] or 0,
                            difficulty=r["difficulty"] or refill_context["difficulty"],
                            duration_ms=r["duration_ms"] or 0,
                            insight_detected=False,
                            attempts=r["attempts"] or 1,
                        )
                    )

        avg_duration = (
            sum(r["duration_ms"] or 0 for r in recent_attempts) // len(recent_attempts)
            if recent_attempts else 5000
        )

        profile = ChildProfileInput(
            child=ChildData(
                age=age,
                grade=child_grade,
                current_zone=child_row.get("current_zone", 1),
                current_difficulty=refill_context["difficulty"],
                difficulty_ceiling=child_row.get("difficulty_ceiling", 10),
                unlocked_tricks=unlocked or [refill_context["trick_id"]],
                session_stats=SessionStats(
                    problems_solved_today=0,
                    current_streak=child_row.get("streak_current", 0),
                    avg_time_per_problem_ms=avg_duration,
                ),
            ),
            recent_problems=recent_problems,
        )

        problem_dict = run_pipeline(profile)

        insert_res = admin.table("problems").insert(
            {
                "zone": problem_dict.get("zone", child_row.get("current_zone", 1)),
                "category": problem_dict.get("category", "pattern"),
                "difficulty": problem_dict["difficulty"],
                "trick_ids": [problem_dict["trick_id"]],
                "trick_id": problem_dict["trick_id"],
                "stem": problem_dict["stem"],
                "answer": str(problem_dict["answer"]),
                "answer_type": problem_dict.get("answer_type", "exact"),
                "shortcut_time_threshold_ms": problem_dict.get("shortcut_time_threshold_ms"),
                "hints": problem_dict.get("hints", []),
                "aha_moment": problem_dict.get("aha_moment"),
                "flavor_text": problem_dict.get("flavor_text"),
                "tags": problem_dict.get("tags", []),
                "estimated_brute_force_seconds": problem_dict.get("estimated_brute_force_seconds"),
                "estimated_trick_seconds": problem_dict.get("estimated_trick_seconds"),
                "grade": child_grade,
                "phase_tag": "practice",
            }
        ).execute()

        logger.info(
            "Refill: inserted new problem for trick=%s difficulty=%d grade=%d",
            refill_context["trick_id"],
            refill_context["difficulty"],
            child_grade,
        )

        if insert_res.data:
            row = insert_res.data[0]
            return {
                "id": row["id"],
                "zone": row.get("zone") or problem_dict.get("zone", 1),
                "category": row.get("category") or problem_dict.get("category", "pattern"),
                "difficulty": row.get("difficulty") or problem_dict["difficulty"],
                "stem": row.get("stem") or problem_dict["stem"],
                "answer_type": row.get("answer_type") or problem_dict.get("answer_type", "exact"),
                "hints": row.get("hints") or problem_dict.get("hints", []),
                "flavor_text": row.get("flavor_text") or problem_dict.get("flavor_text"),
                "tags": row.get("tags") or problem_dict.get("tags", []),
            }
        return None

    except Exception:
        logger.exception("Refill failed for context %s", refill_context)
        return None


# -----------------------------------------------------------------------------
# Helpers — problem response
# -----------------------------------------------------------------------------


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
# Helpers — AI adjuster
# -----------------------------------------------------------------------------


def _upsert_problem_attempt(
    child_id: str,
    problem_id: str,
    correct: bool,
    hints_used: int,
    duration_ms: int,
    difficulty: int,
    admin: Any,
) -> int:
    """Insert or update the attempt row. Returns the new total attempts count."""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    existing = (
        admin.table("problem_attempts")
        .select("previously_failed, attempts")
        .eq("child_id", child_id)
        .eq("problem_id", problem_id)
        .limit(1)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        new_attempts = row["attempts"] + 1
        # previously_failed is sticky: once true, stays true regardless of later correct answers.
        admin.table("problem_attempts").update(
            {
                "solved_correctly": correct,
                "previously_failed": row["previously_failed"] or (not correct),
                "hints_used": hints_used,
                "duration_ms": duration_ms,
                "attempts": new_attempts,
                "answered_at": now,
            }
        ).eq("child_id", child_id).eq("problem_id", problem_id).execute()
        return new_attempts
    else:
        admin.table("problem_attempts").insert(
            {
                "child_id": child_id,
                "problem_id": problem_id,
                "solved_correctly": correct,
                "previously_failed": not correct,
                "hints_used": hints_used,
                "duration_ms": duration_ms,
                "attempts": 1,
                "difficulty": difficulty,
            }
        ).execute()
        return 1


def _apply_adjuster_results(
    child_id: str,
    current_trick: str,
    result: dict[str, Any],
    admin: Any,
) -> None:
    """Write new difficulty, phase, and trick changes back to the DB."""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    admin.table("children").update(
        {"current_difficulty": result["new_difficulty_target"]}
    ).eq("id", child_id).execute()

    phase_update = result.get("phase_update")
    if phase_update:
        admin.table("trick_discoveries").update(
            {"current_phase": phase_update}
        ).eq("child_id", child_id).eq("trick_id", current_trick).execute()

    trick_update = result.get("trick_update")
    if trick_update:
        # Ensure the new trick has a fresh discovery row.
        existing = (
            admin.table("trick_discoveries")
            .select("id")
            .eq("child_id", child_id)
            .eq("trick_id", trick_update)
            .limit(1)
            .execute()
        )
        if existing.data:
            admin.table("trick_discoveries").update(
                {
                    "current_phase": "discovery",
                    "discovery_problems_seen": 0,
                    "practice_problems_solved": 0,
                    "practice_problems_attempted": 0,
                }
            ).eq("child_id", child_id).eq("trick_id", trick_update).execute()
        else:
            admin.table("trick_discoveries").insert(
                {
                    "child_id": child_id,
                    "trick_id": trick_update,
                    "insight_count": 0,
                    "current_phase": "discovery",
                    "discovery_problems_seen": 0,
                    "practice_problems_solved": 0,
                    "practice_problems_attempted": 0,
                    "first_seen_at": now,
                }
            ).execute()

        admin.table("children").update(
            {"current_trick": trick_update}
        ).eq("id", child_id).execute()


# -----------------------------------------------------------------------------
# GET /problems — fetch the next problem
# -----------------------------------------------------------------------------


@router.get(
    "",
    response_model=ProblemsListResponse,
    summary="Fetch the next recommended problem for the authenticated child.",
)
async def get_problems(
    background_tasks: BackgroundTasks,
    current: AuthUser = Depends(get_current_user),
) -> ProblemsListResponse:
    """Return the best problem for the child via the AI recommender.

    Flow: build candidate list → call recommend() → act on its response.
    recommend() owns all decisions: which problem to serve, when to reveal
    the trick, and when to trigger a bank refill. This endpoint reads the DB,
    calls recommend(), and writes the result back — nothing more.
    """
    _, child_row, parent_ceiling = _get_child_context(current)
    admin = get_admin_supabase()

    if not _AI_AVAILABLE:
        logger.error("AI pipeline not available — GET /problems cannot serve a problem.")
        return ProblemsListResponse(problems=[])

    effective = min(child_row["current_difficulty"], child_row["difficulty_ceiling"], parent_ceiling)
    child_id: str = child_row["id"]

    # Assign the first eligible trick for a new child.
    current_trick: str | None = child_row.get("current_trick")
    if not current_trick:
        unlocked = _fetch_unlocked_tricks(child_id, admin)
        try:
            eligible = get_eligible_tricks(unlocked)
        except Exception:
            logger.warning("get_eligible_tricks failed", exc_info=True)
            eligible = []
        if not eligible:
            return ProblemsListResponse(problems=[])
        current_trick = eligible[0]
        _ensure_trick_row(child_id, current_trick, admin)
        admin.table("children").update(
            {"current_trick": current_trick}
        ).eq("id", child_id).execute()

    # Fetch current phase state for this child+trick.
    phase_row = _fetch_phase_row(child_id, current_trick, admin)
    current_phase = (phase_row or {}).get("current_phase", "discovery")
    disc_seen = (phase_row or {}).get("discovery_problems_seen", 0)

    # Build candidate list: unsolved problems for this trick at exact difficulty and grade.
    attempts_summary = _fetch_attempts_summary(child_id, admin)
    solved_ids = {r["problem_id"] for r in attempts_summary if r["solved_correctly"]}
    failed_ids = {r["problem_id"] for r in attempts_summary if r["previously_failed"]}

    candidates_res = (
        admin.table("problems")
        .select("id, trick_id, difficulty, grade, phase_tag")
        .eq("trick_id", current_trick)
        .eq("difficulty", effective)
        .execute()
    )
    candidates = [
        {
            "id": str(r["id"]),
            "trick_id": r["trick_id"],
            "difficulty": r["difficulty"],
            "grade": r["grade"] or child_row["grade"],
            "phase_tag": r["phase_tag"] or "practice",
            "previously_failed": str(r["id"]) in failed_ids,
        }
        for r in (candidates_res.data or [])
        if str(r["id"]) not in solved_ids
    ]
    logger.debug(
        "candidates: trick=%s difficulty=%d child_grade=%d found=%d",
        current_trick, effective, child_row["grade"], len(candidates),
    )

    child_ctx = {
        "current_phase": current_phase,
        "current_difficulty": effective,
        "current_trick": current_trick,
        "discovery_problems_seen": disc_seen,
    }

    try:
        rec = recommend(child_ctx, candidates)
        logger.debug("recommend() → %s", rec)
    except Exception:
        logger.warning("recommend() failed", exc_info=True)
        return ProblemsListResponse(problems=[])

    # Phase reveal: child has completed discovery.
    if rec.get("phase_signal") == "reveal":
        if phase_row:
            admin.table("trick_discoveries").update(
                {"current_phase": "practice"}
            ).eq("child_id", child_id).eq("trick_id", current_trick).execute()
        return ProblemsListResponse(problems=[], phase_signal="reveal")

    # Refill: recommender says the bank is running low or empty.
    # When refill_context is None the bank is fully depleted — build the
    # context from child state so we can still queue a generation.
    # Bypass the skip guard (skip_if_count_gte=0) when current_count=0,
    # meaning all existing problems at this slot are already solved.
    if rec.get("needs_refill"):
        refill_ctx = rec.get("refill_context") or {
            "trick_id": current_trick,
            "difficulty": effective,
            "grade": child_row["grade"],
            "current_count": 0,
        }
        skip_guard = 0 if refill_ctx.get("current_count", 1) == 0 else 2
        logger.debug(
            "refill queued: child_id=%s grade=%s current_trick=%s "
            "difficulty=%s ctx=%s skip_guard=%d",
            child_id, child_row["grade"], current_trick,
            effective, refill_ctx, skip_guard,
        )
        background_tasks.add_task(
            _refill_problem_bank,
            child_row.copy(),
            refill_ctx,
            skip_if_count_gte=skip_guard,
        )

    # Serve the recommended problem.
    problem_id = rec.get("problem_id")
    if problem_id:
        prob_res = (
            admin.table("problems")
            .select(
                "id, zone, category, difficulty, stem, "
                "answer_type, hints, flavor_text, tags"
            )
            .eq("id", problem_id)
            .limit(1)
            .execute()
        )
        if prob_res.data:
            if current_phase == "discovery" and phase_row:
                admin.table("trick_discoveries").update(
                    {"discovery_problems_seen": disc_seen + 1}
                ).eq("child_id", child_id).eq("trick_id", current_trick).execute()
            return ProblemsListResponse(
                problems=[_row_to_problem_response(prob_res.data[0])],
                phase_signal=None,
            )

    return ProblemsListResponse(problems=[])


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

    After the existing coin/streak logic, calls the AI difficulty adjuster
    (process_answer) when the problem has a trick_id and the child has a
    current_trick assigned. Writes new difficulty, phase, and trick back to DB.

    Adjuster block is wrapped in try/except — a failure there does NOT fail
    the attempt response (coins and streak are already committed).
    """
    _, child_row, parent_ceiling = _get_child_context(current)
    _ensure_session(payload.session_id, child_row["id"])

    admin = get_admin_supabase()

    # Fetch problem including server-only fields + trick_id/difficulty for adjuster.
    prob_res = (
        admin.table("problems")
        .select(
            "id, answer, answer_type, shortcut_time_threshold_ms, "
            "trick_ids, trick_id, difficulty"
        )
        .eq("id", str(payload.problem_id))
        .limit(1)
        .execute()
    )
    if not prob_res.data:
        raise ProblemNotFound(f"Problem {payload.problem_id} not found.")
    problem = prob_res.data[0]

    correct = _check_answer(
        problem["answer_type"], problem["answer"], payload.answer
    )
    logger.debug(
        "attempt: problem=%s answer_type=%s stored=%r submitted=%r correct=%s",
        payload.problem_id, problem["answer_type"], problem["answer"],
        payload.answer, correct,
    )

    threshold_ms = problem.get("shortcut_time_threshold_ms")
    insight_detected = (
        correct
        and payload.hint_level_used == 0
        and threshold_ms is not None
        and payload.duration_ms <= threshold_ms
    )

    daily_earned, did_reset = _apply_daily_reset(child_row)

    raw_coins = _coins_for_attempt(correct, insight_detected, payload.hint_level_used)
    daily_cap_reached = False

    if daily_earned >= DAILY_CAP:
        coins_awarded = 0
        daily_cap_reached = True
    else:
        coins_awarded = min(raw_coins, DAILY_CAP - daily_earned)
        if daily_earned + coins_awarded >= DAILY_CAP:
            daily_cap_reached = True

    if correct:
        new_streak = child_row["streak_current"] + 1
        new_streak_best = max(new_streak, child_row["streak_best"])
    else:
        new_streak = 0
        new_streak_best = child_row["streak_best"]

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
        child_update["daily_coins_earned"] = coins_awarded

    admin.table("children").update(child_update).eq("id", child_row["id"]).execute()

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
        new_balance = child_row["coins"] + coins_awarded
        streak_count = new_streak

    trick_unlocked: str | None = None
    if insight_detected:
        trick_ids: list[str] = problem.get("trick_ids") or []
        if trick_ids:
            trick_unlocked = _update_trick_insight(child_row["id"], trick_ids)

    # ------------------------------------------------------------------
    # AI difficulty adjuster
    # Only runs when the problem has a trick_id (AI-generated) and the
    # child has a current_trick assigned. Wrapped in try/except so a
    # failure here never rolls back the coins/streak already committed.
    # ------------------------------------------------------------------
    new_difficulty: int | None = None
    phase_update: str | None = None
    trick_advance: str | None = None

    problem_trick_id: str | None = problem.get("trick_id")
    current_trick: str | None = child_row.get("current_trick")

    if _AI_AVAILABLE and problem_trick_id and current_trick:
        try:
            child_id = child_row["id"]
            problem_difficulty = problem.get("difficulty") or child_row["current_difficulty"]
            effective_ceiling = min(child_row["difficulty_ceiling"], parent_ceiling)

            # 1. Upsert problem_attempts.
            new_attempts = _upsert_problem_attempt(
                child_id=child_id,
                problem_id=str(payload.problem_id),
                correct=correct,
                hints_used=payload.hint_level_used,
                duration_ms=payload.duration_ms,
                difficulty=problem_difficulty,
                admin=admin,
            )

            # 2. Fetch current phase row.
            phase_row = _fetch_phase_row(child_id, current_trick, admin)

            if phase_row:
                current_phase = phase_row["current_phase"]

                # 3. Update practice phase counters (after the attempt is recorded).
                if current_phase == "practice":
                    counter_update: dict[str, Any] = {
                        "practice_problems_attempted": (
                            phase_row["practice_problems_attempted"] + 1
                        )
                    }
                    if correct:
                        counter_update["practice_problems_solved"] = (
                            phase_row["practice_problems_solved"] + 1
                        )
                    admin.table("trick_discoveries").update(counter_update).eq(
                        "id", phase_row["id"]
                    ).execute()
                    # Re-fetch so adjuster sees post-increment values.
                    refreshed = (
                        admin.table("trick_discoveries")
                        .select(
                            "discovery_problems_seen, practice_problems_solved, "
                            "practice_problems_attempted"
                        )
                        .eq("id", phase_row["id"])
                        .limit(1)
                        .execute()
                    )
                    phase_counters = refreshed.data[0] if refreshed.data else {
                        "discovery_problems_seen": 0,
                        "practice_problems_solved": 0,
                        "practice_problems_attempted": 0,
                    }
                else:
                    phase_counters = {
                        "discovery_problems_seen": phase_row["discovery_problems_seen"],
                        "practice_problems_solved": phase_row["practice_problems_solved"],
                        "practice_problems_attempted": phase_row["practice_problems_attempted"],
                    }

                # 4. Recent performance: last 10 attempts at current difficulty.
                perf_res = (
                    admin.table("problem_attempts")
                    .select("solved_correctly, hints_used, duration_ms, difficulty")
                    .eq("child_id", child_id)
                    .eq("difficulty", problem_difficulty)
                    .order("answered_at", desc=True)
                    .limit(10)
                    .execute()
                )
                recent_performance = [
                    {
                        "difficulty": r["difficulty"] or problem_difficulty,
                        "correct": r["solved_correctly"],
                        "hints_used": r["hints_used"],
                        "duration_ms": r["duration_ms"] or 0,
                    }
                    for r in (perf_res.data or [])
                ]

                # 5. Unlocked tricks for next-trick computation.
                unlocked_tricks = _fetch_unlocked_tricks(child_id, admin)

                # 6. Call adjuster.
                adjuster_result = process_answer(
                    answer_result={
                        "correct": correct,
                        "hints_used": payload.hint_level_used,
                        "duration_ms": payload.duration_ms,
                        "attempts": new_attempts,
                    },
                    current_difficulty=problem_difficulty,
                    difficulty_ceiling=effective_ceiling,
                    current_phase=current_phase,
                    phase_counters=phase_counters,
                    recent_performance=recent_performance,
                    current_trick=current_trick,
                    unlocked_tricks=unlocked_tricks,
                )

                # 7. Write results back to DB.
                _apply_adjuster_results(child_id, current_trick, adjuster_result, admin)

                new_difficulty = adjuster_result.get("new_difficulty_target")
                phase_update = adjuster_result.get("phase_update")
                trick_advance = adjuster_result.get("trick_update")

        except Exception:
            logger.exception(
                "AI adjuster failed for child=%s problem=%s — coins/streak unaffected",
                child_row["id"],
                payload.problem_id,
            )

    return AttemptResponse(
        correct=correct,
        coins_awarded=coins_awarded,
        insight_detected=insight_detected,
        new_balance=new_balance,
        streak_count=streak_count,
        trick_unlocked=trick_unlocked,
        daily_cap_reached=daily_cap_reached,
        new_difficulty=new_difficulty,
        phase_update=phase_update,
        trick_advance=trick_advance,
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

    Hint costs: level 1 = 0 coins, level 2 = 5 coins, level 3 = 15 coins.
    Sequence enforcement (must request tier 1 before tier 2) is a TODO
    pending problem_attempts being extended to track hint tiers per attempt.
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
