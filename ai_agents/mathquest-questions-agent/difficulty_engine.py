# difficulty_engine.py
# Pure Python difficulty logic for the MathQuest agent pipeline.
# No AI, no API calls — all deterministic computation.
# Owned by the AI pipeline (not the backend) so difficulty progression
# can be tuned and tested independently of the backend team.
# Produces two outputs consumed by the orchestrator:
#   - difficulty_target (int) passed to Agent 1
#   - eligible_tricks (list[str]) passed to Agent 1

from config import (
    DIFFICULTY_MIN,
    DIFFICULTY_MAX,
    ADVANCEMENT_CORRECT_RATE,
    ADVANCEMENT_WINDOW,
    CONSOLIDATE_HINTS_THRESHOLD,
    CONSOLIDATE_FAILED_THRESHOLD,
    CONSOLIDATE_DURATION_THRESHOLD_MS,
    ADVANCE_DURATION_THRESHOLD_MS,
    MIN_PROBLEMS_PER_LEVEL,
)
from schemas import ChildData, SessionStats, RecentProblem
from typing import List


# ---------------------------------------------------------------------------
# HOW DIFFICULTY IS COMPUTED — overview
#
# The engine makes two independent decisions every time the orchestrator asks
# for a new problem: (1) what difficulty to target, and (2) which tricks are
# eligible.  Both are deterministic — no AI, no randomness.
#
# ── DIFFICULTY TARGET ──────────────────────────────────────────────────────
#
# Difficulty is a number from 1 (basic arithmetic) to 10 (competition-level).
# The engine computes a target difficulty by running two checks in order:
#
#   Layer 1 — Session adjustment (short-term signal):
#     Looks at how the child is doing RIGHT NOW in this session.
#     Three possible outcomes, checked in priority order:
#       • "consolidate" → keep difficulty (child is struggling: too many hints,
#                          too many failures, or taking too long)
#       • "advance"     → raise difficulty by 1 (child is excelling: fast,
#                          no hints, no failures)
#       • "maintain"    → keep difficulty (child is progressing normally)
#
#   Layer 2 — Long-term advancement (sustained performance signal):
#     Only runs if Layer 1 did NOT already advance.
#     Looks at the last 10 problems (the "advancement window") and advances
#     difficulty by 1 if the child has sustained ≥ 80% correct rate.
#
#   Volume gate — applied to BOTH layers:
#     Neither layer may advance difficulty unless the child has correctly solved
#     at least MIN_PROBLEMS_PER_LEVEL problems AT the current difficulty.
#     This prevents a single lucky solve from pushing a child to a harder level.
#
#   Ceiling clamp — applied last:
#     The result is always clamped to [DIFFICULTY_MIN, child.difficulty_ceiling].
#     A child's ceiling is set by the backend and caps how far they can go.
#
# ── ELIGIBLE TRICKS ────────────────────────────────────────────────────────
#
# The eligible tricks list tells Agent 1 which tricks it may use when writing
# a problem.  The list is ordered — tricks earlier in the list have higher
# priority.  The order is:
#
#   1. Struggling tricks first  — tricks the child recently failed or needed
#                                  hints on. More practice on weak spots.
#   2. Solid unlocked tricks    — tricks the child is handling confidently.
#   3. New tricks to introduce  — up to 2 locked tricks whose full prerequisite
#                                  chain is already unlocked. Introducing them
#                                  gradually exposes the child to new concepts.
#
#   Prerequisite gate: a locked trick only appears in the eligible list once
#   all its prerequisites are unlocked. The prerequisite graph is defined in
#   PREREQUISITES below and is based on conceptual dependency (e.g. you need
#   to understand perfect squares before learning Difference of Squares), NOT
#   on the A→B→C→D category order.
#
# ── WHO WRITES DIFFICULTY BACK ─────────────────────────────────────────────
#
# This engine only READS the child's profile — it never writes to the database.
# The orchestrator returns difficulty_target as part of its response.  The
# backend must store that value in the child's record so the next call to this
# engine starts from the correct baseline.
# ---------------------------------------------------------------------------


# Full ordered trick sequence across all four categories.
# Within get_eligible_tricks this order determines which new tricks are introduced
# first when multiple locked tricks have their prerequisites satisfied.
TRICK_SEQUENCE = [
    "A1", "A2", "A3", "A4", "A5", "A6", "A7",
    "B1", "B2", "B3", "B4", "B5", "B6",
    "C1", "C2", "C3", "C4", "C5", "C6", "C7",
    "D1", "D2", "D3", "D4", "D5",
]

# Learning prerequisite graph — maps each trick to the tricks a child must have
# unlocked before that trick can be introduced. An empty list means no prerequisites.
# Ordered by conceptual dependency, not by category position.
PREREQUISITES = {
    "A1": [],
    "A2": [],
    "A3": [],
    "A4": [],
    "A5": [],
    "A6": ["A4"],        # difference of squares builds on the square identity (A4)
    "A7": ["A3"],        # ×125 uses repeated doubling chains (A3)
    "B1": [],
    "B2": ["B1"],        # perimeter invariance extends invariant thinking (B1)
    "B3": [],
    "B4": ["B1", "B5"],  # modular arithmetic generalises parity (B1) and digit-sum mod (B5)
    "B5": ["B1"],        # digit-sum divisibility extends parity reasoning (B1)
    "B6": ["B1"],        # pigeonhole principle uses invariant-style reasoning (B1)
    "C1": [],
    "C2": [],
    "C3": ["C2"],        # benchmark numbers extend complement-to-100 (C2)
    "C4": ["A3"],        # near-doubles uses doubling knowledge (A3)
    "C5": [],
    "C6": ["C3"],        # estimation and bounds uses benchmark anchors (C3)
    "C7": ["C1"],        # left-to-right multiplication extends chunking (C1)
    "D1": ["A3"],        # symmetry/half-double relies on doubling (A3)
    "D2": ["B3"],        # state transitions build on conservation of sum (B3)
    "D3": ["B3"],        # balance/equilibrium IS conservation of sum in algebra (B3)
    "D4": ["A3"],        # geometric series intuition extends doubling chains (A3)
    "D5": ["A5"],        # triangular numbers connect to sum of first n odds (A5)
}


def compute_trick_mastery(recent_problems: List[RecentProblem]) -> dict:
    # What: aggregates per-trick performance stats from the child's recent problem history.
    #       Returns a dict that lets the engine see which tricks the child is struggling
    #       with (failures or hint usage) versus solving confidently.
    # Return: dict[str, dict] — {trick_id: {"correct": int, "failed": int, "total_hints": int}}
    # Example input: [RecentProblem(trick_id="A1", solved=True, hints_used=0), ...]
    # Example output: {"A1": {"correct": 1, "failed": 0, "total_hints": 0}}

    # dict[str, dict] — per-trick counts built up from recent_problems
    mastery = {}

    for p in recent_problems:
        if p.trick_id not in mastery:
            mastery[p.trick_id] = {"correct": 0, "failed": 0, "total_hints": 0}
        if p.solved:
            mastery[p.trick_id]["correct"] += 1
        else:
            mastery[p.trick_id]["failed"] += 1
        mastery[p.trick_id]["total_hints"] += p.hints_used

    return mastery


def get_eligible_tricks(
    unlocked_tricks: List[str],
    recent_problems: List[RecentProblem] = None,
    all_tricks: List[str] = TRICK_SEQUENCE,
) -> List[str]:
    # What: builds the ordered list of tricks Agent 1 may use for this problem.
    #       Tricks the child is currently struggling with (recent failures or hint usage)
    #       are placed first so Agent 1 gives more practice on weak spots.
    #       Solid unlocked tricks follow. Locked tricks whose prerequisites are all
    #       unlocked are appended last (at most 2) to gently introduce new concepts.
    #       New tricks are only introduced once their prerequisite chain is complete.
    # Return: list[str] of trick IDs in A1–D5 format, ordered by priority
    # Example input: unlocked_tricks=["A1", "A2"], recent_problems=[...A2 failed...]
    # Example output: ["A2", "A1", "A3", "A4"]  (A2 first — struggling)

    # list[RecentProblem] — default to empty list when no history is provided
    if recent_problems is None:
        recent_problems = []

    # set[str] — fast membership check for already-unlocked tricks
    unlocked_set = set(unlocked_tricks)

    # dict[str, dict] — per-trick performance stats from recent history
    mastery = compute_trick_mastery(recent_problems)

    # list[str], list[str] — split unlocked tricks into struggling vs solid.
    # A trick is "struggling" if it had any recent failures or hint usage.
    struggling = []
    solid = []
    for trick in unlocked_tricks:
        stats = mastery.get(trick, {"correct": 0, "failed": 0, "total_hints": 0})
        if stats["failed"] > 0 or stats["total_hints"] > 0:
            struggling.append(trick)
        else:
            solid.append(trick)

    # list[str] — locked tricks from the canonical sequence whose full prerequisite
    # chain is already unlocked; capped at 2 to avoid overwhelming the child.
    new_tricks = []
    for trick in all_tricks:
        if trick in unlocked_set:
            continue
        prereqs = PREREQUISITES.get(trick, [])
        if all(p in unlocked_set for p in prereqs):
            new_tricks.append(trick)
        if len(new_tricks) >= 2:
            break

    return struggling + solid + new_tricks


def compute_session_adjustment(
    session_stats: SessionStats,
    recent_problems: List[RecentProblem],
) -> dict:
    # What: evaluates the child's in-session performance and decides whether
    #       to hold, advance, or maintain the current difficulty for this problem.
    #       Checks rules in order: consolidate takes priority over advance.
    # Return: dict with two keys — "delta" (int, 0 or +1) and "reason" (str)
    # Example input: session_stats with avg_time=20000ms, recent_problems all solved, 0 hints
    # Example output: {"delta": 1, "reason": "advance"}

    # int — total hints the child used across all recent problems this session
    total_hints = sum(p.hints_used for p in recent_problems)

    # int — number of problems the child failed (did not solve) in recent history
    total_failed = sum(1 for p in recent_problems if not p.solved)

    # int — average milliseconds per problem from the session stats
    avg_duration_ms = session_stats.avg_time_per_problem_ms

    # Consolidate: child is struggling — hold difficulty to build confidence
    if (
        total_hints >= CONSOLIDATE_HINTS_THRESHOLD
        or total_failed >= CONSOLIDATE_FAILED_THRESHOLD
        or avg_duration_ms > CONSOLIDATE_DURATION_THRESHOLD_MS
    ):
        return {"delta": 0, "reason": "consolidate"}

    # Advance: child is excelling — no hints, fast, no failures
    if (
        total_hints == 0
        and total_failed == 0
        and avg_duration_ms < ADVANCE_DURATION_THRESHOLD_MS
    ):
        return {"delta": 1, "reason": "advance"}

    # Maintain: child is progressing normally — keep current difficulty
    return {"delta": 0, "reason": "maintain"}


def compute_difficulty_target(
    child: ChildData,
    recent_problems: List[RecentProblem],
) -> int:
    # What: computes the difficulty level Agent 1 should target for this problem.
    #       Applies session-level and long-term advancement rules, but only allows
    #       advancement when the child has solved at least MIN_PROBLEMS_PER_LEVEL
    #       problems at their current difficulty — preventing advancement after
    #       a single lucky solve. Result is clamped to [DIFFICULTY_MIN, ceiling].
    # Return: int in range [DIFFICULTY_MIN, DIFFICULTY_MAX]
    # Example input: child.current_difficulty=4, session delta=+1, 5 correct at level 4
    # Example output: 5

    # dict — session-level adjustment decision {"delta": int, "reason": str}
    adjustment = compute_session_adjustment(child.session_stats, recent_problems)

    # int — number of problems the child has correctly solved at their current difficulty.
    # Advancement is only allowed once this meets the minimum volume threshold.
    problems_at_level = sum(
        1 for p in recent_problems
        if p.difficulty == child.current_difficulty and p.solved
    )

    # int — start from current difficulty; advance only if volume requirement is met
    target = child.current_difficulty

    # bool — tracks whether the session rule already advanced difficulty this call,
    # to prevent the long-term rule from double-advancing in the same call.
    session_advanced = False

    if adjustment["delta"] == 1 and problems_at_level >= MIN_PROBLEMS_PER_LEVEL:
        target += 1
        session_advanced = True

    # Long-term advancement rule (PRD Section 09):
    # If the child has sustained >= 80% correct over the last 10 problems,
    # advance by 1 — but only if the session did not already advance, and only
    # if the volume requirement is met.
    if len(recent_problems) >= ADVANCEMENT_WINDOW and not session_advanced:
        # list[RecentProblem] — the most recent window of problems for this check
        window = recent_problems[-ADVANCEMENT_WINDOW:]

        # float — fraction of problems in the window that were solved correctly
        correct_rate = sum(1 for p in window if p.solved) / ADVANCEMENT_WINDOW

        if correct_rate >= ADVANCEMENT_CORRECT_RATE and problems_at_level >= MIN_PROBLEMS_PER_LEVEL:
            target += 1

    # int — difficulty clamped to valid range, never exceeding the child's ceiling
    target = max(DIFFICULTY_MIN, min(target, DIFFICULTY_MAX, child.difficulty_ceiling))

    return target
