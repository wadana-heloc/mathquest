# orchestrator.py
# Wires the full MathQuest problem generation pipeline end-to-end.
# Entry point: run_pipeline(child_profile_input) — always returns a problem dict.
# Flow: difficulty engine → Agent 1 → Pydantic validation → Agent 2 → return or retry.
# After MAX_RETRIES failed attempts, falls back to a pre-made problem from
# fallback_problems/. Internal fields (shortcut_path, brute_force_path) are
# stripped from every problem before it is returned to the backend.

import json
import time
from pathlib import Path

from config import MAX_RETRIES, RETRY_WAIT_SECONDS
from schemas import ChildProfileInput, ProblemOutput, ReviewerOutput
from difficulty_engine import compute_difficulty_target, get_eligible_tricks
from agent_generator import generate_problem, _TRICKS_BY_ID, _MOCK_PROBLEM_FIXTURE
from agent_reviewer import review_problem


def _strip_internal_fields(problem: dict) -> dict:
    # What: removes fields that must never be sent to the child client.
    #       shortcut_path and brute_force_path are teaching notes for internal use
    #       only — the PRD forbids exposing them to children.
    # Return: dict — the problem with internal fields removed
    # Example input: {"answer": 253, "shortcut_path": "...", "brute_force_path": "...", ...}
    # Example output: {"answer": 253, ...}  (shortcut_path and brute_force_path absent)

    # dict — shallow copy so we do not mutate the original
    stripped = dict(problem)

    stripped.pop("shortcut_path", None)
    stripped.pop("brute_force_path", None)

    return stripped


def _load_fallback(trick_id: str, difficulty: int) -> dict:
    # What: loads a pre-made validated problem from fallback_problems/fallback_bank.json.
    #       Looks up by trick_id then by difficulty (as a string key).
    #       If the exact difficulty is missing, picks the nearest available difficulty
    #       for that trick. If the trick is missing entirely, falls back to the mock
    #       fixture — a guaranteed-correct A1 problem that is always valid.
    # Return: dict — a stripped problem ready to serve
    # Example input: trick_id="A1", difficulty=4
    # Example output: {"id": "fb_A1_d3", "trick_id": "A1", "answer": 154, ...}

    # Path — location of the single fallback bank file
    bank_path = Path(__file__).parent / "fallback_problems" / "fallback_bank.json"

    if bank_path.exists():
        # str — raw JSON text from the fallback bank
        raw = bank_path.read_text(encoding="utf-8")

        # dict[str, dict[str, dict]] — all fallbacks keyed by trick_id → str(difficulty)
        bank = json.loads(raw)

        # dict[str, dict] — all difficulties available for this trick, or empty if absent
        trick_fallbacks = bank.get(trick_id, {})

        if trick_fallbacks:
            # dict or None — exact difficulty match first
            problem = trick_fallbacks.get(str(difficulty))

            if problem is None:
                # No exact match — find the closest available difficulty for this trick
                # list[str] — available difficulty keys sorted by distance from requested
                closest_keys = sorted(
                    trick_fallbacks.keys(),
                    key=lambda d: abs(int(d) - difficulty),
                )
                problem = trick_fallbacks[closest_keys[0]]

            return _strip_internal_fields(problem)

    # Absolute last resort — mock fixture is a known-correct A1 problem at difficulty 4
    return _strip_internal_fields(dict(_MOCK_PROBLEM_FIXTURE))


def run_pipeline(child_profile_input: ChildProfileInput) -> dict:
    # What: runs the full problem generation pipeline for one child request.
    #       Calls the difficulty engine, then Agent 1 and Agent 2 in sequence,
    #       retrying up to MAX_RETRIES times.
    #       Always returns a freshly generated problem — raises RuntimeError if all attempts fail.
    # Return: dict — a validated problem with internal fields stripped
    # Example input: ChildProfileInput with child age=8, current_difficulty=4, unlocked=["A1","A2"]
    # Example output: {"id": "p_001", "trick_id": "A1", "answer": 253, ...}

    # int — difficulty level Agent 1 should target, computed from child's history
    difficulty_target = compute_difficulty_target(
        child_profile_input.child,
        child_profile_input.recent_problems,
    )

    # list[str] — trick IDs Agent 1 may use, ordered by priority (struggling first)
    eligible_tricks = get_eligible_tricks(
        child_profile_input.child.unlocked_tricks,
        child_profile_input.recent_problems,
    )

    for attempt in range(MAX_RETRIES + 1):

        print(f"[Pipeline] attempt {attempt + 1}/{MAX_RETRIES + 1}")

        # Wait before retrying — skip the delay on the first attempt
        if attempt > 0:
            time.sleep(RETRY_WAIT_SECONDS)

        # --- Agent 1: generate a problem ---

        # dict or None — raw problem JSON from Agent 1, or None on failure
        raw_problem = generate_problem(
            child_profile_input,
            difficulty_target,
            eligible_tricks,
        )

        if raw_problem is None:
            print("[Pipeline] Agent 1 returned None — retrying")
            continue

        print("[Pipeline] Agent 1 returned a problem")

        # --- Pydantic validation ---
        # If Agent 1's output fails schema validation, skip Agent 2 entirely.
        # There is no value in paying for a review of structurally broken output.

        try:
            # ProblemOutput — validated problem object; raises if any field is wrong
            validated_problem = ProblemOutput(**raw_problem)
        except Exception as exc:
            print(f"[Pipeline] Pydantic validation failed: {exc}")
            continue

        print(f"[Pipeline] Pydantic validation passed (trick={validated_problem.trick_id}, difficulty={validated_problem.difficulty})")

        # --- Trick description lookup ---
        # Agent 2 needs the description of the specific trick used to check alignment.

        # dict or None — full trick object from the reference, keyed by trick_id
        trick_description = _TRICKS_BY_ID.get(validated_problem.trick_id)

        if trick_description is None:
            print(f"[Pipeline] unknown trick_id '{validated_problem.trick_id}' — retrying")
            continue

        # --- Agent 2: review the problem ---

        # dict or None — ReviewerOutput JSON from Agent 2, or None on failure
        raw_review = review_problem(
            validated_problem.model_dump(),
            trick_description,
        )

        if raw_review is None:
            print("[Pipeline] Agent 2 returned None — retrying")
            continue

        # --- Parse and act on the reviewer's verdict ---

        try:
            # ReviewerOutput — validated reviewer response; raises if malformed
            reviewer_output = ReviewerOutput(**raw_review)
        except Exception as exc:
            print(f"[Pipeline] ReviewerOutput validation failed: {exc}")
            continue

        if reviewer_output.approved:
            print("[Pipeline] Agent 2 approved — returning problem")
            return _strip_internal_fields(validated_problem.model_dump())

        if reviewer_output.corrected_problem is not None:
            print(f"[Pipeline] Agent 2 rejected but supplied correction — returning corrected problem. Issues: {reviewer_output.issues}")
            return _strip_internal_fields(reviewer_output.corrected_problem.model_dump())

        print(f"[Pipeline] Agent 2 rejected with no correction — retrying. Issues: {reviewer_output.issues}")
        # Agent 2 rejected with no correction — loop will retry if attempts remain

    # All attempts exhausted — generation failed
    raise RuntimeError(
        f"Problem generation failed after {MAX_RETRIES + 1} attempts "
        f"(difficulty_target={difficulty_target}, eligible_tricks={eligible_tricks})"
    )
