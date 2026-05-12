# schemas.py
# Pydantic models for the MathQuest report agent.
# These models validate the JSON payload the backend sends before any
# agent call is made. If validation fails, the request is rejected early —
# the agent never sees malformed data.
# Shape mirrors the contract defined in BACKEND_CONTRACT.md exactly.

from pydantic import BaseModel
from typing import Optional, Literal, List


# ---------------------------------------------------------------------------
# Child info
# ---------------------------------------------------------------------------

class ChildInfo(BaseModel):
    # What: the child's identity and progression state as of the report period.

    # str — child's display name from the users table
    name: str

    # int — child's age in years, derived from date_of_birth
    age: int

    # int — school grade
    grade: int

    # int — current game zone (1–5)
    zone: int

    # int — current difficulty level on the 1–10 scale
    current_difficulty: int

    # int — maximum difficulty the child may reach (1–10)
    difficulty_ceiling: int

    # int — current consecutive-day streak
    streak_current: int

    # int — all-time best streak
    streak_best: int


# ---------------------------------------------------------------------------
# Aggregate stats
# ---------------------------------------------------------------------------

class OverallStats(BaseModel):
    # What: aggregate performance numbers across the full report period.

    # int — total problem_attempts rows in the period
    attempts: int

    # float — overall accuracy 0.00–1.00, two decimal places
    accuracy: float

    # float — average duration_ms / 1000, rounded to nearest second
    avg_seconds: float

    # float — average hints used per problem, one decimal place
    avg_hints_per_problem: float


class CategoryStat(BaseModel):
    # What: performance breakdown for one problem category.

    # str — category label matching problems.category ("arithmetic", "pattern", etc.)
    category: str

    # int — number of attempts in this category during the period
    attempts: int

    # float — accuracy 0.00–1.00
    accuracy: float

    # float — average seconds per problem in this category
    avg_seconds: float


class DifficultyStat(BaseModel):
    # What: performance at one difficulty level. Only levels actually attempted are included.

    # int — difficulty level 1–10
    level: int

    # int — number of attempts at this difficulty level
    attempts: int

    # float — accuracy 0.00–1.00 at this difficulty level
    accuracy: float


# ---------------------------------------------------------------------------
# Tricks
# ---------------------------------------------------------------------------

class TrickInProgress(BaseModel):
    # What: a trick the child has seen but not yet unlocked.

    # str — trick ID in A1–D5 format
    id: str

    # str — trick display name from the tricks table
    name: str

    # str — current learning phase: "discovery" (first exposure) or "practice"
    phase: Literal["discovery", "practice"]

    # float or None — practice accuracy 0.00–1.00; None if still in discovery phase
    accuracy: Optional[float] = None


class TrickSummary(BaseModel):
    # What: a snapshot of where the child stands across all tricks.

    # list[str] — IDs of tricks fully unlocked (trick_discoveries.unlocked = true)
    unlocked: List[str]

    # list[TrickInProgress] — tricks seen but not yet unlocked
    in_progress: List[TrickInProgress]

    # int — count of tricks with no trick_discovery row for this child yet
    not_yet_started: int


# ---------------------------------------------------------------------------
# Struggled problems
# ---------------------------------------------------------------------------

class StruggledProblem(BaseModel):
    # What: one problem the child failed during the period.
    # Up to 9 problems, prioritised: previously_failed first, then longest duration.

    # str — the actual question text from problems.stem
    stem: str

    # str — problem category
    category: str

    # int — difficulty level of this attempt
    difficulty: int

    # int — hints the child used on this problem
    hints_used: int

    # bool — True if the child previously failed this same problem
    failed_twice: bool


# ---------------------------------------------------------------------------
# Top-level payload
# ---------------------------------------------------------------------------

class ReportPayload(BaseModel):
    # What: the complete payload the backend sends to the report agent endpoint.
    # This is validated before generate_report() is called.

    # ChildInfo — child identity and progression state
    child: ChildInfo

    # int — how many days back the report covers (typically 30)
    period_days: int

    # OverallStats — aggregate performance across the period
    overall: OverallStats

    # list[CategoryStat] — one entry per category with at least 1 attempt
    by_category: List[CategoryStat]

    # list[DifficultyStat] — one entry per difficulty level attempted
    difficulty_curve: List[DifficultyStat]

    # TrickSummary — snapshot of trick progress
    tricks: TrickSummary

    # list[StruggledProblem] — up to 9 problems the child struggled with
    struggled_problems: List[StruggledProblem]

    # str — direction of accuracy change over the period
    trend: Literal["improving", "stable", "declining"]
