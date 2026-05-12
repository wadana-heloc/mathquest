# schemas.py
# Defines all Pydantic models used across the MathQuest agent pipeline.
# Two groups: (1) child profile input — validated before entering the pipeline,
# (2) problem output and reviewer output — validated between agents and before
# serving to the backend. Nothing leaves or enters the pipeline without passing
# through one of these models.

from pydantic import BaseModel
from typing import Optional, Literal, List


# ---------------------------------------------------------------------------
# Group 1 — Child Profile Input
# These models represent the structured JSON the backend pre-fetches from the
# DB and passes into the pipeline. The agents never read the DB directly.
# ---------------------------------------------------------------------------

class SessionStats(BaseModel):
    # What: holds the child's performance stats for the current session.
    # These three numbers drive the difficulty engine's session-level adjustment.

    # int — number of problems the child has solved in this session
    problems_solved_today: int

    # int — how many problems in a row the child has answered correctly
    current_streak: int

    # int — average time the child takes per problem, in milliseconds
    avg_time_per_problem_ms: int


class ChildData(BaseModel):
    # What: holds the child's profile — identity, progression state, and which
    # tricks they have unlocked. Nested inside ChildProfileInput.

    # int — child's age in years, used for age-appropriateness checks
    age: int

    # int — school grade, used alongside age for difficulty calibration
    grade: int

    # int — current game zone (1–5), controls flavor and problem theme
    current_zone: int

    # int — the child's current difficulty level on the 1–10 scale
    current_difficulty: int

    # int — maximum difficulty the child is currently allowed to reach (1–10)
    difficulty_ceiling: int

    # list[str] — trick IDs the child has unlocked, in A1–D5 format
    unlocked_tricks: List[str]

    # SessionStats — current session performance stats
    session_stats: SessionStats


class RecentProblem(BaseModel):
    # What: represents one problem from the child's recent history.
    # The pipeline receives a list of these (capped at 5) to inform
    # difficulty and trick selection. Never more than 5 are sent to Agent 1.

    # str — which trick this problem tested, in A1–D5 format
    trick_id: str

    # str — the problem text shown to the child
    problem: str

    # bool — whether the child answered correctly
    solved: bool

    # int — number of hints the child used on this problem
    hints_used: int

    # int — difficulty level of this problem on the 1–10 scale
    difficulty: int

    # int — total time the child spent on this problem, in milliseconds
    duration_ms: int

    # bool — whether the system detected the child used the shortcut (insight)
    insight_detected: bool

    # int — how many attempts the child made before a correct answer
    attempts: int


class ChildProfileInput(BaseModel):
    # What: top-level input schema — the exact shape the backend must send.
    # This is the entry point to the pipeline. If this validation fails,
    # the request is rejected before any agent is called.

    # ChildData — the child's full profile
    child: ChildData

    # list[RecentProblem] — up to 5 most recent problems; orchestrator caps this
    recent_problems: List[RecentProblem]


# ---------------------------------------------------------------------------
# Group 2 — Problem Output
# These models represent what Agent 1 produces. Pydantic validates the output
# before it is passed to Agent 2. If validation fails, Agent 2 is skipped and
# the pipeline goes directly to fallback.
# ---------------------------------------------------------------------------

class Hint(BaseModel):
    # What: a single hint for a problem. Every problem must have exactly 3 hints.
    # Level 1 is always free. Levels 2 and 3 cost coins.

    # int — hint level: must be 1, 2, or 3
    level: Literal[1, 2, 3]

    # str — the hint text shown to the child; must not reveal the answer
    text: str

    # int — coin cost to unlock this hint (level 1 = 0, level 2 = 5, level 3 = 15)
    cost: int


class ProblemOutput(BaseModel):
    # What: the full problem JSON that Agent 1 must produce and Agent 2 must
    # approve. Every field here is required — this is the authoritative schema
    # from PRD Section 06. The orchestrator strips shortcut_path and
    # brute_force_path before the problem is served to the child client.

    # str — unique problem identifier
    id: str

    # int — game zone this problem belongs to (1–5)
    zone: int

    # str — broad category label (e.g. "pattern", "invariant", "mental", "structural")
    category: str

    # int — difficulty level on the 1–10 scale
    difficulty: int

    # str — which trick this problem targets, in A1–D5 format
    trick_id: str

    # str — the problem statement shown to the child
    stem: str

    # int — the correct answer (always a single whole number)
    answer: int

    # str — answer type; currently always "exact" in this implementation
    answer_type: Literal["exact", "range", "set"]

    # str — step-by-step brute-force solution path (internal only, never sent to child)
    brute_force_path: str

    # str — step-by-step shortcut solution path (internal only, never sent to child)
    shortcut_path: str

    # int — time in milliseconds under which a correct answer signals shortcut use
    shortcut_time_threshold_ms: int

    # list[Hint] — exactly 3 hints in ascending level order
    hints: List[Hint]

    # str — the key insight the child should take away from this problem
    aha_moment: str

    # str — in-world narrative text that frames the problem in the game story
    flavor_text: str

    # list[str] — searchable labels for this problem (trick, operation, zone, etc.)
    tags: List[str]

    # int — estimated seconds for a child solving without the trick
    estimated_brute_force_seconds: int

    # int — estimated seconds for a child who applies the trick correctly
    estimated_trick_seconds: int


# ---------------------------------------------------------------------------
# Group 3 — Reviewer Output
# What Agent 2 returns after validating a problem. If approved is False,
# corrected_problem holds a fixed version of the problem. If approved is True,
# corrected_problem is None.
# ---------------------------------------------------------------------------

class ReviewerOutput(BaseModel):
    # What: Agent 2's verdict on a generated problem.
    # The orchestrator reads `approved` first; if False it uses `corrected_problem`
    # or falls back to the pre-made problem bank after two failed attempts.

    # bool — True if the problem passes all checks, False if it needs correction
    approved: bool

    # list[str] — descriptions of any issues found; empty list if approved
    issues: List[str]

    # ProblemOutput or None — a corrected problem if approved is False, else None
    corrected_problem: Optional[ProblemOutput] = None

