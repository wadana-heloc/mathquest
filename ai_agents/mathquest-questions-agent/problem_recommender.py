# problem_recommender.py
# Scores candidate problems and picks the best one for a given child.
# The backend calls recommend() — the single public entry point — after its SQL
# query has pre-filtered unseen and previously-failed problems for the child.
#
# This module is pure Python — no DB calls, no API calls, no generator calls.
# The backend owns data retrieval; this module owns the scoring decision.

from config import (
    MIN_BANK_SIZE,
    DISCOVERY_PROBLEMS_REQUIRED,
    WEIGHT_RETRY,
    WEIGHT_UNSEEN,
    WEIGHT_PHASE_FIT,
    WEIGHT_DIFFICULTY_PENALTY,
)


def score_candidate(candidate: dict, child: dict) -> int:
    # What: computes the fit score for one candidate problem given the child's state.
    #       Applies four rules in order: retry bonus, unseen bonus, phase fit bonus,
    #       and difficulty-mismatch penalty. Higher score = better fit for this child now.
    # Return: int — composite score (higher is better, can be negative)
    # Example input: candidate={"id":"p_001","phase_tag":"practice","previously_failed":False,"difficulty":4},
    #                child={"current_phase":"practice","current_difficulty":4}
    # Example output: 45

    # int — accumulated score; starts at zero
    score = 0

    # Retry bonus vs unseen bonus — mutually exclusive on previously_failed
    if candidate["previously_failed"]:
        score += WEIGHT_RETRY
    else:
        score += WEIGHT_UNSEEN

    # Phase fit — reward problems that match the child's current pedagogical phase
    if candidate["phase_tag"] == child["current_phase"]:
        score += WEIGHT_PHASE_FIT

    # Difficulty penalty — penalise problems that are off the child's current target
    # int — absolute distance from the child's current difficulty level
    difficulty_delta = abs(candidate["difficulty"] - child["current_difficulty"])
    score -= difficulty_delta * WEIGHT_DIFFICULTY_PENALTY

    return score


def pick_best_problem(
    candidates: list,
    child: dict,
    scorer=None,
) -> dict | None:
    # What: scores every candidate using the provided scorer and returns the one with
    #       the highest score. Defaults to score_candidate (weighted formula).
    #       Accepts any callable with signature scorer(candidate, child) -> numeric,
    #       so swapping to an ML model requires no changes here or in recommend().
    # Return: dict — the winning candidate, or None if candidates is empty
    # Example input: candidates=[{"id":"p_001",...},{"id":"p_002",...}], child={...}
    # Example output: {"id": "p_001", "trick_id": "A1", "difficulty": 4, ...}

    if not candidates:
        return None

    # callable — use the default weighted scorer when none is provided
    active_scorer = scorer if scorer is not None else score_candidate

    # dict — candidate with the highest score across all candidates
    best = max(candidates, key=lambda c: active_scorer(c, child))
    return best


def check_phase_signal(child: dict, problems_seen_in_phase: int) -> str | None:
    # What: checks whether the child has completed the discovery phase and should
    #       now see the trick reveal screen. Only fires when in "discovery" phase
    #       and the child has seen at least DISCOVERY_PROBLEMS_REQUIRED problems.
    #       The backend uses the returned signal to trigger the reveal animation.
    # Return: "reveal" when the reveal should fire, None otherwise
    # Example input: child={"current_phase":"discovery"}, problems_seen_in_phase=2
    # Example output: "reveal"

    if child["current_phase"] != "discovery":
        return None

    if problems_seen_in_phase >= DISCOVERY_PROBLEMS_REQUIRED:
        return "reveal"

    return None


def build_response(
    best: dict | None,
    candidates: list,
    child: dict,
    phase_signal: str | None,
) -> dict:
    # What: assembles the final response dict the /recommend endpoint returns.
    #       When a phase_signal is present, returns the transition response with
    #       no problem_id. Otherwise, picks a problem_id, computes the needs_refill
    #       flag, and builds refill_context when the bank is running low.
    # Return: dict with problem_id, needs_refill, refill_context, phase_signal
    # Example output: {"problem_id": "p_001", "needs_refill": True,
    #                  "refill_context": {"trick_id":"A1","difficulty":4,...},
    #                  "phase_signal": None}

    # Phase transition — return the signal; the backend shows the reveal screen.
    # No problem is served in this response.
    if phase_signal is not None:
        return {
            "problem_id": None,
            "phase_signal": phase_signal,
            "needs_refill": False,
            "refill_context": None,
        }

    # int — count of unseen candidates remaining after this problem is served.
    # Subtracts 1 to account for the problem being served right now.
    remaining = len([p for p in candidates if not p["previously_failed"]]) - 1

    # bool — True when remaining unseen problems fall below the refill threshold
    needs_refill = remaining < MIN_BANK_SIZE

    # dict or None — context the generator needs to refill this (trick, difficulty) slot
    refill_context = None
    if needs_refill and best is not None:
        refill_context = {
            "trick_id": best["trick_id"],
            "difficulty": best["difficulty"],
            "grade": best["grade"],
            "current_count": remaining,
        }

    return {
        "problem_id": best["id"] if best is not None else None,
        "needs_refill": needs_refill,
        "refill_context": refill_context,
        "phase_signal": None,
    }


def recommend(child: dict, candidates: list, scorer=None) -> dict:
    # What: single entry point the backend calls after its SQL query.
    #       Coordinates check_phase_signal → pick_best_problem → build_response
    #       in the correct order. The backend never calls those three directly.
    #
    #       scorer — optional callable with signature scorer(candidate, child) -> numeric.
    #       Defaults to score_candidate (weighted formula). Pass a different function
    #       to swap the ranking algorithm without touching anything else:
    #
    #         recommend(child, candidates, scorer=my_ml_model.score)
    #
    #       The candidate dict format (from the SQL query) is extensible — add more
    #       columns to the query and the ML scorer can read them. The weighted default
    #       will simply ignore unfamiliar keys.
    #
    # Return: dict with problem_id, needs_refill, refill_context, phase_signal
    # Example input: child={"current_phase":"discovery","discovery_problems_seen":2,...},
    #                candidates=[{"id":"p_001","trick_id":"A1","difficulty":4,...},...]
    # Example output: {"problem_id": "p_001", "needs_refill": False,
    #                  "refill_context": None, "phase_signal": None}

    # str or None — "reveal" if the child has completed enough discovery problems
    phase_signal = check_phase_signal(child, child["discovery_problems_seen"])

    # dict or None — highest-scoring candidate using the active scorer
    best = pick_best_problem(candidates, child, scorer=scorer)

    return build_response(best, candidates, child, phase_signal)
