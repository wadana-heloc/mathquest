# difficulty_adjuster.py
# Updates difficulty and phase state after every child answer.
# The backend calls process_answer() — the single public entry point — immediately
# after the child submits an answer. Returns the new state; the backend writes it to the DB.
#
# This module is pure deterministic Python — no DB calls, no API calls.
# Difficulty logic is reused from difficulty_engine.py (never duplicated).

from config import (
    DIFFICULTY_MIN,
    DIFFICULTY_MAX,
    DISCOVERY_PROBLEMS_REQUIRED,
    MIN_PRACTICE_PROBLEMS,
    MIN_PROBLEMS_PER_LEVEL,
    MASTERY_THRESHOLD,
    MAX_PROBLEMS_PER_TRICK,
)
from difficulty_engine import compute_session_adjustment, TRICK_SEQUENCE, PREREQUISITES
from schemas import SessionStats, RecentProblem


def compute_difficulty_adjustment(
    answer_result: dict,
    current_difficulty: int,
    difficulty_ceiling: int,
) -> dict:
    # What: wraps compute_session_adjustment from difficulty_engine.py to compute
    #       the difficulty delta for a single answer. Maps answer_result fields to
    #       the session-stats and recent-problems inputs that compute_session_adjustment
    #       expects. Each failed attempt is modelled as a separate failed problem entry.
    # Return: dict with "new_difficulty" (int) and "reason" (str)
    # Example input: answer_result={"correct":True,"hints_used":0,"duration_ms":20000,"attempts":1},
    #                current_difficulty=4, difficulty_ceiling=10
    # Example output: {"new_difficulty": 5, "reason": "advance"}

    # int — number of attempts before the final answer; at least 1
    attempts = answer_result.get("attempts", 1)

    # bool — whether the child ultimately answered correctly
    correct = answer_result["correct"]

    # int — failed attempts = (attempts - 1) if correct, else all attempts
    failed_count = (attempts - 1) if correct else attempts

    # list[RecentProblem] — synthetic history built from this single answer.
    # Each failed attempt before a correct answer becomes one failed problem entry.
    synthetic_problems: list[RecentProblem] = []

    for _ in range(failed_count):
        synthetic_problems.append(RecentProblem(
            # trick_id is a required schema field but compute_session_adjustment
            # never reads it — only solved, hints_used, and duration_ms matter here.
            trick_id="A1",
            problem="",
            solved=False,
            hints_used=0,
            difficulty=current_difficulty,
            duration_ms=answer_result["duration_ms"],
            insight_detected=False,
            attempts=1,
        ))

    # Add the final correct attempt (if the child got it right)
    if correct:
        synthetic_problems.append(RecentProblem(
            trick_id="A1",  # schema placeholder — not read by compute_session_adjustment
            problem="",
            solved=True,
            hints_used=answer_result["hints_used"],
            difficulty=current_difficulty,
            duration_ms=answer_result["duration_ms"],
            insight_detected=False,
            attempts=1,
        ))

    # SessionStats — avg_time comes from the single answer's duration
    synthetic_stats = SessionStats(
        problems_solved_today=1,
        current_streak=1,
        avg_time_per_problem_ms=answer_result["duration_ms"],
    )

    # dict — {"delta": int, "reason": str} from the session-level rule engine
    adjustment = compute_session_adjustment(synthetic_stats, synthetic_problems)

    # int — new difficulty clamped to valid range and child's ceiling
    new_difficulty = current_difficulty + adjustment["delta"]
    new_difficulty = max(DIFFICULTY_MIN, min(new_difficulty, DIFFICULTY_MAX, difficulty_ceiling))

    return {"new_difficulty": new_difficulty, "reason": adjustment["reason"]}


def check_mastery(recent_performance: list, practice_problems_solved: int) -> bool:
    # What: determines whether the child has mastered the current trick by checking
    #       their correct rate over the last MIN_PRACTICE_PROBLEMS problems and
    #       confirming they have solved enough problems at this level.
    #       Returns False early when the history is too short to measure reliably.
    # Return: bool — True if mastery threshold is met, False otherwise
    # Example input: recent_performance=[{"correct":True,...}x10], practice_problems_solved=8
    # Example output: True

    # Guard: need at least MIN_PRACTICE_PROBLEMS entries to make a reliable assessment
    if len(recent_performance) < MIN_PRACTICE_PROBLEMS:
        return False

    # Guard: child must have solved a minimum number of problems before advancing
    if practice_problems_solved < MIN_PROBLEMS_PER_LEVEL:
        return False

    # list[dict] — the most recent MIN_PRACTICE_PROBLEMS entries
    window = recent_performance[-MIN_PRACTICE_PROBLEMS:]

    # float — fraction of problems in the window answered correctly
    correct_rate = sum(1 for p in window if p["correct"]) / len(window)

    return correct_rate >= MASTERY_THRESHOLD


def compute_phase_update(
    current_phase: str,
    phase_counters: dict,
    mastery_reached: bool,
    current_trick: str,
    unlocked_tricks: list,
) -> dict:
    # What: decides whether the child's phase or trick should change after this answer.
    #       In discovery, advances to "practice" once enough problems have been seen.
    #       In practice, advances to the next trick when mastery is reached OR when
    #       practice_problems_attempted hits MAX_PROBLEMS_PER_TRICK — whichever comes
    #       first. The cap prevents the child grinding the same trick endlessly.
    #       Returns None for both fields when no transition condition is met.
    # Return: dict with "phase_update" (str or None) and "trick_update" (str or None)
    # Example input: current_phase="practice", mastery_reached=False, current_trick="A1",
    #                phase_counters={"practice_problems_attempted": 7, ...},
    #                unlocked_tricks=["A1","A2"]
    # Example output: {"phase_update": "discovery", "trick_update": "A2"}

    # Discovery phase: advance to practice once enough problems have been seen.
    # If below threshold, fall through to the final return (no change).
    if current_phase == "discovery":
        if phase_counters["discovery_problems_seen"] >= DISCOVERY_PROBLEMS_REQUIRED:
            return {"phase_update": "practice", "trick_update": None}

    # Practice phase: advance if mastered OR if the trick cap is hit.
    # The cap prevents the child grinding the same trick past MAX_PROBLEMS_PER_TRICK
    # regardless of whether they reached the mastery threshold.
    trick_cap_hit = (
        current_phase == "practice"
        and phase_counters.get("practice_problems_attempted", 0) >= MAX_PROBLEMS_PER_TRICK
    )

    if current_phase == "practice" and (mastery_reached or trick_cap_hit):
        # set[str] — fast membership check for already-unlocked tricks
        unlocked_set = set(unlocked_tricks)

        # str or None — next locked trick whose full prerequisite chain is already unlocked
        next_trick = None
        for trick in TRICK_SEQUENCE:
            if trick in unlocked_set:
                continue
            # list[str] — prerequisites for this trick from the graph
            prereqs = PREREQUISITES.get(trick, [])
            if all(p in unlocked_set for p in prereqs):
                next_trick = trick
                break

        if next_trick is not None:
            # Transition to the new trick starting in discovery phase
            return {"phase_update": "discovery", "trick_update": next_trick}

    # No transition condition met — caller keeps current phase and trick
    return {"phase_update": None, "trick_update": None}


def build_adjuster_response(difficulty_result: dict, phase_result: dict) -> dict:
    # What: assembles the final response dict the /adjust endpoint returns.
    #       When a trick transition occurs, resets the difficulty target to
    #       DIFFICULTY_MIN so the child starts the new trick from the beginning.
    # Return: dict with new_difficulty_target, adjustment_reason, phase_update, trick_update
    # Example output: {"new_difficulty_target": 5, "adjustment_reason": "advance",
    #                  "phase_update": None, "trick_update": None}

    # int — base difficulty from the adjustment; overridden to 1 on trick change
    new_difficulty = difficulty_result["new_difficulty"]

    # When the child advances to a new trick, reset difficulty to the floor so
    # they are not immediately dropped into a hard problem on an unfamiliar concept
    if phase_result["trick_update"] is not None:
        new_difficulty = DIFFICULTY_MIN

    return {
        "new_difficulty_target": new_difficulty,
        "adjustment_reason": difficulty_result["reason"],
        "phase_update": phase_result["phase_update"],
        "trick_update": phase_result["trick_update"],
    }


def process_answer(
    answer_result: dict,
    current_difficulty: int,
    difficulty_ceiling: int,
    current_phase: str,
    phase_counters: dict,
    recent_performance: list,
    current_trick: str,
    unlocked_tricks: list,
) -> dict:
    # What: single entry point the backend calls after every child answer.
    #       Coordinates compute_difficulty_adjustment → check_mastery →
    #       compute_phase_update → build_adjuster_response in the correct order.
    #       The backend never calls those four functions directly.
    # Return: dict with new_difficulty_target, adjustment_reason, phase_update, trick_update
    # Example input: answer_result={"correct":True,"hints_used":0,"duration_ms":2900,"attempts":1},
    #                current_difficulty=4, difficulty_ceiling=10, current_phase="practice",
    #                phase_counters={"discovery_problems_seen":0,"practice_problems_solved":8},
    #                recent_performance=[...10 entries...], current_trick="A1",
    #                unlocked_tricks=["A1","A2"]
    # Example output: {"new_difficulty_target": 5, "adjustment_reason": "advance",
    #                  "phase_update": None, "trick_update": None}

    # dict — {"new_difficulty": int, "reason": str}
    difficulty_result = compute_difficulty_adjustment(
        answer_result, current_difficulty, difficulty_ceiling
    )

    # bool — True if the child has hit the mastery threshold for the current trick
    mastery_reached = check_mastery(
        recent_performance, phase_counters["practice_problems_solved"]
    )

    # dict — {"phase_update": str or None, "trick_update": str or None}
    phase_result = compute_phase_update(
        current_phase, phase_counters, mastery_reached, current_trick, unlocked_tricks
    )

    return build_adjuster_response(difficulty_result, phase_result)
