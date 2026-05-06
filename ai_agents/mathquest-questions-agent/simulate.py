# simulate.py
# Simulates a full child session end-to-end using recommend() and process_answer().
# No database, no API calls — everything is fake in-memory state.
# Run with: python simulate.py
#
# Four scenarios are run back-to-back:
#   1. Discovery phase   — child sees 2 problems, gets the trick reveal, moves to practice
#   2. Practice mastery  — child answers correctly enough to master the trick and advance
#   3. Trick cap         — child never masters but hits 7 attempts and is forced forward
#   4. Calibration       — child climbs fast to find their true level, then settles in normal mode

from problem_recommender import recommend
from difficulty_adjuster import process_answer
from config import (
    DISCOVERY_PROBLEMS_REQUIRED,
    MIN_PROBLEMS_PER_LEVEL,
    MIN_PRACTICE_PROBLEMS,
    MAX_PROBLEMS_PER_TRICK,
    MASTERY_THRESHOLD,
    DIFFICULTY_MIN,
    CALIBRATION_DELTA,
    CALIBRATION_SLOW_DELTA,
    CALIBRATION_DROP,
    CONSOLIDATE_HINTS_THRESHOLD,
)

# ---------------------------------------------------------------------------
# Fake problem bank — 20 problems per (trick, difficulty, phase) slot
# IDs are generated programmatically so they are unique and easy to read.
# ---------------------------------------------------------------------------

def _make_problems(trick_id, difficulty, phase_tag, count, id_prefix):
    return [
        {"id": f"{id_prefix}_{i:02d}", "trick_id": trick_id,
         "difficulty": difficulty, "grade": 3, "phase_tag": phase_tag}
        for i in range(1, count + 1)
    ]

PROBLEM_BANK = (
    _make_problems("A1", 1, "discovery", 3,  "A1d1disc")   # 3 discovery problems at diff 1
  + _make_problems("A1", 1, "practice",  20, "A1d1prac")   # 20 practice problems at diff 1
  + _make_problems("A1", 2, "practice",  20, "A1d2prac")   # 20 practice problems at diff 2
  + _make_problems("A1", 3, "discovery", 3,  "A1d3disc")   # discovery problems at diff 3 (calibration jump)
  + _make_problems("A1", 3, "practice",  20, "A1d3prac")   # 20 practice problems at diff 3
  + _make_problems("A1", 5, "practice",  20, "A1d5prac")   # 20 practice problems at diff 5 (calibration jump)
  + _make_problems("A1", 6, "practice",  20, "A1d6prac")   # 20 practice problems at diff 6 (post-calibration)
  + _make_problems("A1", 7, "practice",  20, "A1d7prac")   # 20 practice problems at diff 7 (calibration ceiling)
  + _make_problems("A2", 1, "discovery", 3,  "A2d1disc")   # A2 discovery (for trick advance)
  + _make_problems("A2", 1, "practice",  20, "A2d1prac")
)


# ---------------------------------------------------------------------------
# Fake child state (what would normally live in the DB)
# ---------------------------------------------------------------------------

def make_child_state(trick_id="A1", phase="discovery", difficulty=1, ceiling=10):
    return {
        "current_trick":      trick_id,
        "current_phase":      phase,
        "current_difficulty": difficulty,
        "difficulty_ceiling": ceiling,
        "unlocked_tricks":    [trick_id],
        "discovery_problems_seen":    0,
        "practice_problems_solved":   0,
        "practice_problems_attempted": 0,
        "solved_problem_ids":  set(),    # replaces child_problem_state.solved_correctly=true
        "failed_problem_ids":  set(),    # replaces child_problem_state.previously_failed=true
        "recent_performance":  [],       # replaces child_problem_state rows for process_answer
    }


# ---------------------------------------------------------------------------
# Helpers that mirror what the backend SQL queries do
# ---------------------------------------------------------------------------

def get_candidates(state):
    # Returns unsolved problems for the child's current trick + difficulty + grade 3,
    # with previously_failed populated — mirrors Flow 1 Step 2 SQL.
    candidates = []
    for p in PROBLEM_BANK:
        if p["trick_id"] != state["current_trick"]:
            continue
        if p["difficulty"] != state["current_difficulty"]:
            continue
        if p["id"] in state["solved_problem_ids"]:
            continue
        candidates.append({
            **p,
            "previously_failed": p["id"] in state["failed_problem_ids"],
        })
    return candidates


def record_answer(state, problem_id, correct, hints_used, duration_ms, attempts):
    # Mirrors Flow 2 Step 1: write to child_problem_state + increment phase counters.
    if correct:
        state["solved_problem_ids"].add(problem_id)
        state["failed_problem_ids"].discard(problem_id)
    else:
        state["failed_problem_ids"].add(problem_id)

    if state["current_phase"] == "practice":
        state["practice_problems_attempted"] += 1
        if correct:
            state["practice_problems_solved"] += 1

    # Mirrors Flow 2 Step 2: append to recent_performance (capped at 10)
    state["recent_performance"].append({
        "difficulty": state["current_difficulty"],
        "correct": correct,
        "hints_used": hints_used,
        "duration_ms": duration_ms,
    })
    if len(state["recent_performance"]) > 10:
        state["recent_performance"].pop(0)


def apply_adjuster_response(state, response):
    # Mirrors Flow 2 Step 4: write process_answer() output back to DB.
    state["current_difficulty"] = response["new_difficulty_target"]

    if response["phase_update"]:
        state["current_phase"] = response["phase_update"]

    if response["trick_update"]:
        new_trick = response["trick_update"]
        state["unlocked_tricks"].append(new_trick)
        state["current_trick"] = new_trick
        state["discovery_problems_seen"] = 0
        state["practice_problems_solved"] = 0
        state["practice_problems_attempted"] = 0
        state["recent_performance"] = []


# ---------------------------------------------------------------------------
# Printing helpers
# ---------------------------------------------------------------------------

SEP = "-" * 60

def print_state(state):
    print(f"  trick={state['current_trick']}  phase={state['current_phase']}"
          f"  difficulty={state['current_difficulty']}")
    print(f"  discovery_seen={state['discovery_problems_seen']}"
          f"  practice_solved={state['practice_problems_solved']}"
          f"  practice_attempted={state['practice_problems_attempted']}")
    print(f"  unlocked={state['unlocked_tricks']}")


def print_recommend_response(resp):
    if resp["phase_signal"]:
        print(f"  >>> recommend() -> PHASE SIGNAL: {resp['phase_signal']}")
    else:
        tag = " [NEEDS REFILL]" if resp["needs_refill"] else ""
        print(f"  >>> recommend() -> problem_id={resp['problem_id']}{tag}")


def print_adjuster_response(resp):
    parts = [
        f"new_difficulty={resp['new_difficulty_target']}",
        f"reason={resp['adjustment_reason']}",
        f"phase_update={resp['phase_update']}",
        f"trick_update={resp['trick_update']}",
        f"calibration={'ON' if resp['calibration_active'] else 'OFF'}",
    ]
    print(f"  >>> process_answer() -> {', '.join(parts)}")


# ---------------------------------------------------------------------------
# Step runner — one problem served + one answer submitted
# ---------------------------------------------------------------------------

def run_step(state, answer_correct, hints_used=0, duration_ms=20000, attempts=1, label=""):
    candidates = get_candidates(state)

    child_dict = {
        "current_phase":      state["current_phase"],
        "current_difficulty": state["current_difficulty"],
        "current_trick":      state["current_trick"],
        "discovery_problems_seen": state["discovery_problems_seen"],
    }

    rec = recommend(child_dict, candidates)
    tag = f" [{label}]" if label else ""
    print(f"\n  Step{tag}")
    print_recommend_response(rec)

    # Handle reveal signal — no problem served, no answer submitted
    if rec["phase_signal"] == "reveal":
        state["current_phase"] = "practice"
        print("  (Backend shows reveal screen; child taps 'I got it')")
        print("  (Backend writes current_phase='practice' to child_trick_phase)")
        return

    problem_id = rec["problem_id"]
    if problem_id is None:
        print("  (No problem available — bank empty)")
        return

    # Increment discovery_problems_seen when problem is served (not after answer)
    if state["current_phase"] == "discovery":
        state["discovery_problems_seen"] += 1
        print(f"  (discovery_problems_seen incremented to {state['discovery_problems_seen']})")

    result_label = "CORRECT" if answer_correct else "WRONG"
    print(f"  Child answers {problem_id}: {result_label}  hints={hints_used}  "
          f"duration={duration_ms}ms  attempts={attempts}")

    record_answer(state, problem_id, answer_correct, hints_used, duration_ms, attempts)

    adj = process_answer(
        answer_result={
            "correct": answer_correct,
            "hints_used": hints_used,
            "duration_ms": duration_ms,
            "attempts": attempts,
        },
        current_difficulty=state["current_difficulty"],
        difficulty_ceiling=state["difficulty_ceiling"],
        current_phase=state["current_phase"],
        phase_counters={
            "discovery_problems_seen":     state["discovery_problems_seen"],
            "practice_problems_solved":    state["practice_problems_solved"],
            "practice_problems_attempted": state["practice_problems_attempted"],
        },
        recent_performance=state["recent_performance"],
        current_trick=state["current_trick"],
        unlocked_tricks=state["unlocked_tricks"],
    )
    print_adjuster_response(adj)
    apply_adjuster_response(state, adj)


# ---------------------------------------------------------------------------
# Scenario 1: Discovery phase -> reveal -> practice
# ---------------------------------------------------------------------------

def scenario_discovery():
    print(f"\n{'=' * 60}")
    print("SCENARIO 1: Discovery phase -> trick reveal -> practice")
    print(f"{'=' * 60}")
    print(f"\nConfig: DISCOVERY_PROBLEMS_REQUIRED = {DISCOVERY_PROBLEMS_REQUIRED}")

    state = make_child_state(trick_id="A1", phase="discovery", difficulty=1)
    print("\nInitial state:")
    print_state(state)

    print(f"\n{SEP}")
    print("Serving discovery problems until reveal fires...")
    print("(Using 30 000 ms answers so difficulty stays at 1 — between advance and consolidate thresholds)\n")

    for i in range(DISCOVERY_PROBLEMS_REQUIRED):
        run_step(state, answer_correct=True, duration_ms=30000, label=f"discovery {i+1}")

    # After DISCOVERY_PROBLEMS_REQUIRED problems, the next recommend() fires "reveal"
    print(f"\n  Step [reveal check]")
    candidates = get_candidates(state)
    child_dict = {
        "current_phase": state["current_phase"],
        "current_difficulty": state["current_difficulty"],
        "current_trick": state["current_trick"],
        "discovery_problems_seen": state["discovery_problems_seen"],
    }
    rec = recommend(child_dict, candidates)
    print_recommend_response(rec)

    if rec["phase_signal"] == "reveal":
        state["current_phase"] = "practice"
        print("  (Backend shows reveal screen; child taps 'I got it')")
        print("  (Backend writes current_phase='practice')")

    print(f"\nFinal state:")
    print_state(state)
    print(f"\nResult: Child is now in PRACTICE phase [OK]")


# ---------------------------------------------------------------------------
# Scenario 2: Practice -> mastery -> next trick
# ---------------------------------------------------------------------------

def scenario_mastery():
    print(f"\n{'=' * 60}")
    print("SCENARIO 2: Practice -> mastery -> advance to next trick")
    print(f"{'=' * 60}")
    print(f"\nConfig: MIN_PRACTICE_PROBLEMS={MIN_PRACTICE_PROBLEMS}  "
          f"MIN_PROBLEMS_PER_LEVEL={MIN_PROBLEMS_PER_LEVEL}  "
          f"MASTERY_THRESHOLD={MASTERY_THRESHOLD}  "
          f"MAX_PROBLEMS_PER_TRICK={MAX_PROBLEMS_PER_TRICK}")
    print()
    print("NOTE: MAX_PROBLEMS_PER_TRICK (7) < MIN_PRACTICE_PROBLEMS (10).")
    print("Mastery needs 10 recent answers but the cap fires after 7 on any single trick.")
    print("This is intentional: recent_performance in the real DB carries over from previous")
    print("tricks at the same difficulty. Here we pre-seed 5 entries from a prior session")
    print("so the child only needs 5 more to hit the 10-entry mastery window.")

    state = make_child_state(trick_id="A1", phase="practice", difficulty=1)

    # One prior wrong answer ended calibration — child is now in normal mode at diff 1.
    # Without this, practice_problems_attempted=0 → pre_wrong=0 → calibration ON → difficulty jumps.
    state["practice_problems_attempted"] = 1

    # Pre-seed 5 correct answers from a previous session (would come from DB in real world)
    prior_history = [
        {"difficulty": 1, "correct": True, "hints_used": 0, "duration_ms": 30000}
        for _ in range(5)
    ]
    state["recent_performance"] = prior_history

    print("\nInitial state (5 prior session answers already in recent_performance):")
    print_state(state)
    print(f"  recent_performance: {len(state['recent_performance'])} entries (all correct)")
    print(f"  practice_problems_attempted=1 -> calibration already ended (one prior wrong)\n")

    print(f"{SEP}")
    print(f"Mastery fires on practice answer {MIN_PROBLEMS_PER_LEVEL}")
    print("when practice_problems_solved reaches 5 AND recent window hits 10.\n")

    trick_advanced = False
    for i in range(MIN_PRACTICE_PROBLEMS):
        run_step(state, answer_correct=True, hints_used=0, duration_ms=30000,
                 label=f"practice {i+1}")
        if state["current_trick"] != "A1":
            trick_advanced = True
            break

    print(f"\nFinal state:")
    print_state(state)
    if trick_advanced:
        print(f"\nResult: Child mastered A1 and advanced to {state['current_trick']} [OK]")
    else:
        print("\nResult: Mastery not yet reached (more answers needed)")


# ---------------------------------------------------------------------------
# Scenario 3: Practice -> trick cap hit without mastery
# ---------------------------------------------------------------------------

def scenario_cap():
    print(f"\n{'=' * 60}")
    print("SCENARIO 3: Practice -> trick cap (7 attempts, no mastery) -> forced advance")
    print(f"{'=' * 60}")
    print(f"\nConfig: MAX_PROBLEMS_PER_TRICK = {MAX_PROBLEMS_PER_TRICK}")

    state = make_child_state(trick_id="A1", phase="practice", difficulty=1)
    print("\nInitial state:")
    print_state(state)

    print(f"\n{SEP}")
    print("Child struggles — answering wrong every time...")

    trick_advanced = False
    for i in range(MAX_PROBLEMS_PER_TRICK + 1):
        run_step(state, answer_correct=False, hints_used=2, duration_ms=60000,
                 label=f"practice {i+1}")
        if state["current_trick"] != "A1":
            trick_advanced = True
            break

    print(f"\nFinal state:")
    print_state(state)
    if trick_advanced:
        print(f"\nResult: Cap hit — child forced forward to {state['current_trick']} "
              f"even without mastery [OK]")
    else:
        print("\nResult: Cap not yet hit")


# ---------------------------------------------------------------------------
# Scenario 4: Calibration — fast climb to true level, then normal mode
# ---------------------------------------------------------------------------

def scenario_calibration():
    print(f"\n{'=' * 60}")
    print("SCENARIO 4: Calibration — quality-aware climb to true level")
    print(f"{'=' * 60}")
    print(f"\nConfig: CALIBRATION_DELTA={CALIBRATION_DELTA}  CALIBRATION_SLOW_DELTA={CALIBRATION_SLOW_DELTA}"
          f"  CALIBRATION_DROP={CALIBRATION_DROP}")
    print()
    print("Brand-new child on trick A1. Two calibration jump sizes are shown:")
    print(f"  confident (no hints, fast) -> +{CALIBRATION_DELTA}")
    print(f"  hesitant  (used a hint)    -> +{CALIBRATION_SLOW_DELTA}")
    print("Calibration ends only on the first wrong answer.")

    state = make_child_state(trick_id="A1", phase="discovery", difficulty=1)
    print("\nInitial state:")
    print_state(state)
    print(f"  (practice_problems_attempted=0 -> calibration is ON)\n")

    print(f"{SEP}")
    print("DISCOVERY PHASE — calibration active (practice counters not updated in discovery)\n")

    # Step 1: confident correct at diff 1 → +2 → diff 3
    run_step(state, answer_correct=True, hints_used=0, duration_ms=12000,
             label="discovery 1 — confident (no hints, fast) at diff 1")

    # Step 2: confident correct at diff 3 → +2 → diff 5, phase flips to practice
    run_step(state, answer_correct=True, hints_used=0, duration_ms=12000,
             label="discovery 2 — confident (no hints, fast) at diff 3")

    print(f"\n  (Reveal screen shown — child now in PRACTICE at difficulty {state['current_difficulty']})\n")

    print(f"{SEP}")
    print("PRACTICE PHASE — calibration still ON (no wrong answers yet)\n")

    # Step 3: hesitant correct at diff 5 — used 1 hint → +1 → diff 6
    run_step(state, answer_correct=True, hints_used=1, duration_ms=20000,
             label="practice 1 — HESITANT (used 1 hint) at diff 5 -> +1 not +2")

    print(f"\n  (Hint used -> smaller jump. difficulty={state['current_difficulty']},"
          f" calibration still ON — only a wrong answer can end calibration)\n")

    print(f"{SEP}")
    print("FIRST WRONG ANSWER — calibration ends, difficulty drops by CALIBRATION_DROP\n")

    # Step 4: WRONG at diff 6 → calibration_complete, drop to 5
    run_step(state, answer_correct=False, hints_used=0, duration_ms=55000,
             label="practice 2 — WRONG at diff 6 (first failure)")

    print(f"\n  True level found: difficulty={state['current_difficulty']}")
    print(f"  (First wrong answer -> calibration_complete, drop -{CALIBRATION_DROP},"
          f" calibration=OFF)\n")

    print(f"{SEP}")
    print("NORMAL MODE — calibration over, session-adjustment rules now apply\n")

    # Step 5: correct in normal mode at diff 5
    run_step(state, answer_correct=True, hints_used=0, duration_ms=20000,
             label="practice 3 — correct at diff 5 (normal mode)")

    print(f"\nFinal state:")
    print_state(state)
    print(f"\nResult: Child calibrated from diff 1 -> true level ~5 in"
          f" {DISCOVERY_PROBLEMS_REQUIRED + 3} questions. [OK]")
    print(f"  Quality-aware: hesitant answer gave +1 instead of +2.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    scenario_discovery()
    scenario_mastery()
    scenario_cap()
    scenario_calibration()
    print(f"\n{'=' * 60}")
    print("Simulation complete.")
    print(f"{'=' * 60}\n")
