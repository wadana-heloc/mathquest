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
    CALIBRATION_DELTA,
    CALIBRATION_SLOW_DELTA,
    CALIBRATION_DROP,
    ADVANCE_DURATION_THRESHOLD_MS,
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
    calibration_active: bool = False,
    scorer=None,
) -> dict:
    # What: computes the new difficulty after one child answer.
    #       In calibration mode, uses answer quality (correct/wrong + hints + duration) to
    #       decide how aggressively to climb: confident answer → +CALIBRATION_DELTA,
    #       hesitant answer → +CALIBRATION_SLOW_DELTA, heavy struggle on correct →
    #       stay here (calibration_ceiling), wrong → drop -CALIBRATION_DROP and end.
    #       Outside calibration: calls scorer(session_stats, recent_problems) → {"delta", "reason"}.
    #       scorer defaults to None → uses the rule-based compute_session_adjustment.
    #       Pass a trained ML model's predict function as scorer to swap in ML with no
    #       other code changes. Scorer must accept (SessionStats, list[RecentProblem])
    #       and return {"delta": int, "reason": str}.
    # Return: dict with "new_difficulty" (int), "reason" (str), "calibration_active" (bool)
    # Example input (calibration, confident): answer_result={"correct":True,"hints_used":0,"duration_ms":5000,"attempts":1},
    #                current_difficulty=3, difficulty_ceiling=10, calibration_active=True
    # Example output: {"new_difficulty": 5, "reason": "calibration_advance", "calibration_active": True}

    # bool — whether the child ultimately answered correctly
    correct = answer_result["correct"]

    # Calibration path: climb toward the child's true level using answer quality signals.
    # Two outcomes on a correct answer:
    #   confident (no hints AND fast) → +CALIBRATION_DELTA — safe to skip a level
    #   hesitant  (hints OR slow)     → +CALIBRATION_SLOW_DELTA — climb carefully
    # Calibration only ends on a wrong answer: drop -CALIBRATION_DROP and lock in.
    # Keeping calibration active until a wrong answer preserves the invariant that
    # calibration_active is derivable from (attempted - solved == 0) — no DB column needed.
    if calibration_active:
        if correct:
            # int — hints the child needed on this specific answer
            hints_used = answer_result["hints_used"]

            # int — time in ms the child spent on this answer
            duration_ms = answer_result["duration_ms"]

            # bool — child solved it cleanly: no scaffolding needed, completed quickly
            confident = hints_used == 0 and duration_ms < ADVANCE_DURATION_THRESHOLD_MS

            # int — full jump when confident, smaller step when hesitant (hints or slow)
            jump = CALIBRATION_DELTA if confident else CALIBRATION_SLOW_DELTA

            # int — effective ceiling the child can never exceed
            effective_ceiling = min(DIFFICULTY_MAX, difficulty_ceiling)

            # int — new difficulty clamped to valid range and ceiling
            new_difficulty = max(DIFFICULTY_MIN, min(current_difficulty + jump, effective_ceiling))

            # bool — end calibration if there is nowhere higher to climb
            still_calibrating = new_difficulty < effective_ceiling

            return {"new_difficulty": new_difficulty, "reason": "calibration_advance", "calibration_active": still_calibrating}
        else:
            # int — drop back one step from the level that proved too hard; floor at minimum
            new_difficulty = max(DIFFICULTY_MIN, current_difficulty - CALIBRATION_DROP)
            return {"new_difficulty": new_difficulty, "reason": "calibration_complete", "calibration_active": False}

    # Normal path (post-calibration): use session-adjustment rules.

    # int — number of attempts before the final answer; at least 1
    attempts = answer_result.get("attempts", 1)

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

    # dict — {"delta": int, "reason": str} from the scorer (rule-based or ML)
    _scorer = scorer if scorer is not None else compute_session_adjustment
    adjustment = _scorer(synthetic_stats, synthetic_problems)

    # int — new difficulty clamped to valid range and child's ceiling
    new_difficulty = current_difficulty + adjustment["delta"]
    new_difficulty = max(DIFFICULTY_MIN, min(new_difficulty, DIFFICULTY_MAX, difficulty_ceiling))

    return {"new_difficulty": new_difficulty, "reason": adjustment["reason"], "calibration_active": False}


def check_mastery(recent_performance: list, practice_problems_solved: int) -> bool:
    # What: determines whether the child has mastered the current trick.
    #       Uses an adaptive window: up to MIN_PRACTICE_PROBLEMS entries if available,
    #       but at least MIN_PROBLEMS_PER_LEVEL. This lets new children reach mastery
    #       within a single trick stint even though MAX_PROBLEMS_PER_TRICK < MIN_PRACTICE_PROBLEMS.
    #       For experienced children with a full history the window is the full 10 entries,
    #       which is more rigorous. The correct-rate threshold is the same in both cases.
    # Return: bool — True if mastery threshold is met, False otherwise
    # Example input: recent_performance=[{"correct":True,...}x6], practice_problems_solved=5
    # Example output: True  (window=6, rate=100%)

    # Guard: child must have solved enough problems on this specific trick before advancing
    if practice_problems_solved < MIN_PROBLEMS_PER_LEVEL:
        return False

    # Guard: need at least MIN_PROBLEMS_PER_LEVEL entries to form a meaningful window
    if len(recent_performance) < MIN_PROBLEMS_PER_LEVEL:
        return False

    # int — adaptive window size: full history up to the cap, minimum MIN_PROBLEMS_PER_LEVEL
    window_size = min(len(recent_performance), MIN_PRACTICE_PROBLEMS)

    # list[dict] — the most recent window_size entries
    window = recent_performance[-window_size:]

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


def build_adjuster_response(difficulty_result: dict, phase_result: dict, calibration_active: bool) -> dict:
    # What: assembles the final response dict the /adjust endpoint returns.
    #       When a trick transition occurs, resets the difficulty target to
    #       DIFFICULTY_MIN and restarts calibration so the child finds their
    #       true level on the new trick from scratch.
    # Return: dict with new_difficulty_target, adjustment_reason, phase_update, trick_update, calibration_active
    # Example output: {"new_difficulty_target": 5, "adjustment_reason": "advance",
    #                  "phase_update": None, "trick_update": None, "calibration_active": False}

    # int — base difficulty from the adjustment; overridden to 1 on trick change
    new_difficulty = difficulty_result["new_difficulty"]

    # bool — calibration state to return to the backend; reset on every trick change
    new_calibration_active = calibration_active

    # When the child advances to a new trick, reset difficulty to the floor and
    # restart calibration — the child must find their true level on the new concept
    if phase_result["trick_update"] is not None:
        new_difficulty = DIFFICULTY_MIN
        new_calibration_active = True

    return {
        "new_difficulty_target": new_difficulty,
        "adjustment_reason": difficulty_result["reason"],
        "phase_update": phase_result["phase_update"],
        "trick_update": phase_result["trick_update"],
        "calibration_active": new_calibration_active,
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
    scorer=None,
) -> dict:
    # What: single entry point the backend calls after every child answer.
    #       Coordinates compute_difficulty_adjustment → check_mastery →
    #       compute_phase_update → build_adjuster_response in the correct order.
    #       The backend never calls those four functions directly.
    #       calibration_active is derived internally — the backend does not pass it.
    #       scorer: optional callable(SessionStats, list[RecentProblem]) -> {"delta", "reason"}.
    #       Pass a trained ML model's predict function here to replace the rule-based
    #       session-adjustment logic. Omit (or pass None) to keep rule-based behavior.
    #       The calibration path always uses fixed rules regardless of scorer.
    # Return: dict with new_difficulty_target, adjustment_reason, phase_update, trick_update, calibration_active
    # Example input: answer_result={"correct":True,"hints_used":0,"duration_ms":2900,"attempts":1},
    #                current_difficulty=4, difficulty_ceiling=10, current_phase="practice",
    #                phase_counters={"discovery_problems_seen":0,"practice_problems_solved":8,
    #                                "practice_problems_attempted":9},
    #                recent_performance=[...10 entries...], current_trick="A1",
    #                unlocked_tricks=["A1","A2"]
    # Example output: {"new_difficulty_target": 5, "adjustment_reason": "advance",
    #                  "phase_update": None, "trick_update": None, "calibration_active": False}

    # Calibration state: True when the child has had zero wrong answers on this trick
    # AND has not yet hit their difficulty ceiling.
    #
    # Timing correction: the backend increments practice_problems_attempted BEFORE
    # calling process_answer (so the current answer is already counted). For a wrong
    # answer, attempted - solved is 1 too high — subtract 1 to recover the pre-answer
    # wrong count. For a correct answer no adjustment is needed (both attempted and
    # solved both incremented, so the difference is unchanged).
    # In discovery phase the practice counters are not updated, so pre_wrong = 0.
    if current_phase == "practice":
        attempted = phase_counters.get("practice_problems_attempted", 0)
        solved = phase_counters.get("practice_problems_solved", 0)
        correction = 0 if answer_result.get("correct", True) else 1
        pre_wrong = max(0, attempted - solved - correction)
    else:
        pre_wrong = 0  # discovery: practice counters not yet updated

    # bool — True when calibration is still active
    calibration_active = pre_wrong == 0 and current_difficulty < min(DIFFICULTY_MAX, difficulty_ceiling)

    # dict — {"new_difficulty": int, "reason": str, "calibration_active": bool}
    difficulty_result = compute_difficulty_adjustment(
        answer_result, current_difficulty, difficulty_ceiling, calibration_active, scorer
    )

    # bool — updated calibration state after this answer
    updated_calibration = difficulty_result["calibration_active"]

    # bool — True if the child has hit the mastery threshold for the current trick.
    # Mastery is never checked during calibration: the child is jumping through levels
    # rapidly and has not proven sustained correctness at any one difficulty level.
    mastery_reached = (
        False if calibration_active
        else check_mastery(recent_performance, phase_counters["practice_problems_solved"])
    )

    # dict — {"phase_update": str or None, "trick_update": str or None}
    phase_result = compute_phase_update(
        current_phase, phase_counters, mastery_reached, current_trick, unlocked_tricks
    )

    return build_adjuster_response(difficulty_result, phase_result, updated_calibration)
