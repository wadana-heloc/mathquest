# MathQuest Problem Bank & Recommender — Agent Build Guide

## What This Document Is
This is the build guide for the **second phase** of the MathQuest AI pipeline. The first phase (problem generation) is already complete and documented in `claude.md`. Do not modify any of those files unless explicitly told to.

This document tells you exactly what to build, why each decision was made, and how every piece connects.

---

## What We Are Adding and Why

The existing pipeline generates problems on-demand — which takes ~20 seconds. That is too slow for a children's game. The new architecture flips the model:

- A **shared problem bank** in the DB stores pre-generated, validated problems
- A **fast recommender** picks the right problem for each child in milliseconds
- A **difficulty adjuster** updates the child's state after each answer
- The **existing generator** runs in the background only when the bank runs low — triggered by a flag, not a schedule

The child never waits for generation. The generator runs silently while the child is already playing.

---

## New Files To Build

```
problem_recommender.py   — scores candidates, picks the best problem, raises refill flag
difficulty_adjuster.py   — updates difficulty + phase after each answer
```

That is all. No other new files. `bank_monitor.py` was considered and rejected — a flag-based trigger is simpler and needs no scheduler.

### Files You Must NOT Modify
- `agent_generator.py`
- `agent_reviewer.py`
- `orchestrator.py`
- `difficulty_engine.py`
- `schemas.py`

### Files You Will Extend
- `config.py` — add new constants (see below)
- `test_agents.py` — add tests for both new modules

---

## New Constants To Add to `config.py`

```python
# int — minimum unseen problems remaining before triggering a refill
MIN_BANK_SIZE = 5

# int — number of discovery-phase problems before trick reveal
DISCOVERY_PROBLEMS_REQUIRED = 2

# int — number of practice problems required before mastery check
MIN_PRACTICE_PROBLEMS = 10

# float — correct rate threshold to declare mastery and advance trick
MASTERY_THRESHOLD = 0.80

# int — max practice attempts per trick before forced advance (cap)
MAX_PROBLEMS_PER_TRICK = 7

# int — difficulty jump per confident correct answer during calibration
CALIBRATION_DELTA = 2

# int — difficulty jump per hesitant correct answer during calibration
CALIBRATION_SLOW_DELTA = 1

# int — difficulty drop when first wrong answer ends calibration
CALIBRATION_DROP = 1
```

All thresholds live here. Never hardcode them in the module files.

---

## New DB Tables

You do not build these — the backend engineer does. But you need to know their shape because your code depends on it. The full schema and backend contract is in `BACKEND_CONTRACT.md`.

The three new tables are:

- `problem_bank` — the shared pool of all generated problems
- `child_problem_state` — tracks what each child has seen, solved, or failed
- `child_trick_phase` — tracks the pedagogical phase per child per trick

---

## Module 1: `problem_recommender.py`

### What This Module Does
Receives the child profile and a pre-filtered list of candidate problems from the backend. Scores each candidate. Returns the best problem plus a `needs_refill` flag if the bank is running low.

### What It Does NOT Do
- It does not query the DB
- It does not filter out solved problems (the backend SQL does that)
- It does not call the generator
- It does not make any API calls

### Input Shape
The backend calls this as a FastAPI endpoint. The input is one JSON object:

```json
{
  "child": {
    "id": 42,
    "age": 8,
    "grade": 3,
    "current_zone": 2,
    "current_difficulty": 4,
    "difficulty_ceiling": 10,
    "current_trick": "A1",
    "current_phase": "practice",
    "unlocked_tricks": ["A1", "A2", "B1"],
    "session_stats": {
      "problems_solved_today": 5,
      "current_streak": 3,
      "avg_time_per_problem_ms": 4200
    }
  },
  "candidate_problems": [
    {
      "id": "p_001",
      "trick_id": "A1",
      "difficulty": 4,
      "grade": 3,
      "phase_tag": "practice",
      "previously_failed": false
    }
  ]
}
```

`candidate_problems` is the already-filtered list from the backend SQL query. It contains only:
- Problems matching the child's `current_trick`, `current_difficulty`, and `grade`
- Problems the child has NOT solved (solved ones are removed by the SQL)
- Problems that are either unseen OR previously failed (never previously-solved-and-correct)

### Output Shape

```json
{
  "problem_id": "p_001",
  "needs_refill": false,
  "refill_context": null
}
```

When `needs_refill` is true:

```json
{
  "problem_id": "p_001",
  "needs_refill": true,
  "refill_context": {
    "trick_id": "A1",
    "difficulty": 4,
    "grade": 3,
    "current_count": 3
  }
}
```

The recommender returns only the `problem_id` — the backend fetches the full problem from `problem_bank` and serves it to the child. The recommender never handles the full problem object.

### The Scoring Function
This is the core logic. Score each candidate with a simple weighted formula. Higher score = better fit for this child right now.

```python
score = 0

# Retry bonus — child failed this before, it has the highest learning value
if candidate["previously_failed"]:
    score += WEIGHT_RETRY          # from config.py, e.g. 30

# Unseen bonus — prefer problems the child has never seen at all
# (previously_failed problems are seen but not solved — they still get this minus the unseen bonus)
if not candidate["previously_failed"]:
    score += WEIGHT_UNSEEN         # from config.py, e.g. 20

# Phase fit — does this problem match the child's current phase?
if candidate["phase_tag"] == child["current_phase"]:
    score += WEIGHT_PHASE_FIT      # from config.py, e.g. 25

# Difficulty fit — penalise problems that are off-target difficulty
difficulty_delta = abs(candidate["difficulty"] - child["current_difficulty"])
score -= difficulty_delta * WEIGHT_DIFFICULTY_PENALTY  # from config.py, e.g. 10
```

Add these weights to `config.py`:

```python
WEIGHT_RETRY = 30
WEIGHT_UNSEEN = 20
WEIGHT_PHASE_FIT = 25
WEIGHT_DIFFICULTY_PENALTY = 10
```

### The Refill Check
After picking the best problem, count remaining unseen candidates:

```python
# int — unseen candidates after this problem is served
remaining = len([p for p in candidates if not p["previously_failed"]]) - 1

# bool — true if the bank is running low for this combo
needs_refill = remaining < MIN_BANK_SIZE
```

### The Phase Signal
If the child is in `discovery` phase and has now seen `DISCOVERY_PROBLEMS_REQUIRED` problems, return a special signal instead of a problem:

```python
# The backend uses this to trigger the trick reveal screen in the frontend
{
  "problem_id": None,
  "phase_signal": "reveal",
  "needs_refill": False,
  "refill_context": None
}
```

The frontend shows the trick reveal animation. No problem is served in this response.

### Functions To Write

```
score_candidate(candidate: dict, child: dict) -> int
    # Computes the score for one candidate problem
    # Returns: int score (higher = better fit)
    # Example input: candidate={"id":"p_001","phase_tag":"practice","previously_failed":False,"difficulty":4}, child={"current_phase":"practice","current_difficulty":4}
    # Example output: 45

pick_best_problem(candidates: list[dict], child: dict) -> dict | None
    # Scores all candidates, returns the one with the highest score
    # Returns: the winning candidate dict, or None if candidates is empty
    # Example input: candidates=[...], child={...}
    # Example output: {"id": "p_001", "trick_id": "A1", ...}

check_phase_signal(child: dict, problems_seen_in_phase: int) -> str | None
    # Returns "reveal" if child has completed discovery phase, else None
    # Returns: "reveal" or None
    # Example input: child={"current_phase":"discovery"}, problems_seen_in_phase=2
    # Example output: "reveal"

build_response(best: dict | None, candidates: list[dict], child: dict, phase_signal: str | None) -> dict
    # Assembles the final response dict including needs_refill flag
    # Returns: dict with problem_id, needs_refill, refill_context, phase_signal
    # Example output: {"problem_id": "p_001", "needs_refill": True, "refill_context": {...}, "phase_signal": None}
```

---

## Module 2: `difficulty_adjuster.py`

### What This Module Does
Called by the backend after every answer. Receives the answer result and recent performance history. Returns the new difficulty target, any phase update, and any trick update. The backend writes all of these to the DB.

### What It Does NOT Do
- It does not write to the DB
- It does not call any agent
- It does not pick the next problem

This module is pure deterministic Python — same philosophy as `difficulty_engine.py`.

### Input Shape

```json
{
  "child_id": 42,
  "current_difficulty": 4,
  "difficulty_ceiling": 10,
  "current_trick": "A1",
  "current_phase": "practice",
  "answer_result": {
    "correct": true,
    "hints_used": 1,
    "duration_ms": 3800,
    "attempts": 1
  },
  "phase_counters": {
    "discovery_problems_seen": 2,
    "practice_problems_solved": 7,
    "practice_problems_attempted": 8
  },
  "recent_performance": [
    {
      "difficulty": 4,
      "correct": true,
      "hints_used": 0,
      "duration_ms": 2900
    }
  ]
}
```

`recent_performance` is the last 10 problems at `current_difficulty`. The backend pre-fetches this from `child_problem_state`. It is used for the mastery check.

### Output Shape

```json
{
  "new_difficulty_target": 5,
  "adjustment_reason": "advance",
  "phase_update": null,
  "trick_update": null,
  "calibration_active": true
}
```

`calibration_active` is always present. The backend does **not** need to store it — it is for informational use only (e.g. show a "finding your level" UI state). The adjuster re-derives it on every call from existing counters.

When a phase transition happens (discovery complete):

```json
{
  "new_difficulty_target": 4,
  "adjustment_reason": "maintain",
  "phase_update": "practice",
  "trick_update": null,
  "calibration_active": true
}
```

When a trick transition happens (mastery reached or cap hit):

```json
{
  "new_difficulty_target": 1,
  "adjustment_reason": "maintain",
  "phase_update": "discovery",
  "trick_update": "A2",
  "calibration_active": true
}
```

`new_difficulty_target` is always 1 on a trick transition. Calibration restarts automatically.

### Calibration Mode

Before normal session-adjustment rules fire, the adjuster runs a fast-climb phase. Calibration is active as long as the child has had zero wrong answers on the current trick. It is derived internally — the backend never passes or stores it.

```
calibration_active = (practice_problems_attempted - practice_problems_solved == 0)
                     AND current_difficulty < difficulty_ceiling
```

**Timing correction:** the backend increments `practice_problems_attempted` BEFORE calling `process_answer`. For a wrong answer this inflates the count by 1. The adjuster subtracts 1 internally for wrong answers to recover the pre-answer wrong count.

Calibration jump size uses hints and duration from the current answer:

| Quality | Condition | Delta |
|---|---|---|
| Confident | hints = 0 AND duration < ADVANCE_DURATION_THRESHOLD_MS | +CALIBRATION_DELTA |
| Hesitant | hints > 0 OR duration >= ADVANCE_DURATION_THRESHOLD_MS | +CALIBRATION_SLOW_DELTA |
| Wrong | correct = False | −CALIBRATION_DROP, calibration ends |

Mastery checks are suppressed while calibration is active.

### Difficulty Adjustment Rules (normal mode)
Reuse the logic already in `difficulty_engine.py — compute_session_adjustment`. Do not duplicate it. Import and call it.

```python
from difficulty_engine import compute_session_adjustment
```

An optional `scorer` parameter can be passed to both `compute_difficulty_adjustment()` and `process_answer()`. When provided it replaces `compute_session_adjustment` with the callable (e.g. an ML model's predict function). The calibration path always uses fixed rules regardless of the scorer.

### Phase Transition Rules

```
discovery phase:
  after DISCOVERY_PROBLEMS_REQUIRED problems seen → phase_update = "practice"
  (process_answer returns this; backend shows reveal screen then writes phase=practice)

practice phase:
  check mastery: if correct_rate >= MASTERY_THRESHOLD over last MIN_PRACTICE_PROBLEMS
  AND practice_problems_solved >= MIN_PROBLEMS_PER_LEVEL (from config.py)
  → trick_update = next trick from TRICK_SEQUENCE with all prerequisites unlocked
  → phase_update = "discovery" (new trick starts in discovery)
  → new_difficulty_target resets to DIFFICULTY_MIN for the new trick

  cap rule: if practice_problems_attempted >= MAX_PROBLEMS_PER_TRICK (mastery not reached)
  → same transition as mastery — trick_update, phase_update = "discovery", difficulty resets
```

### Functions To Write

```
compute_difficulty_adjustment(answer_result, current_difficulty, difficulty_ceiling,
                              calibration_active=False, scorer=None) -> dict
    # Computes new difficulty after one answer.
    # In calibration mode uses hints+duration to choose jump size (+2 confident, +1 hesitant).
    # In normal mode calls scorer (or compute_session_adjustment if scorer is None).
    # Returns: {"new_difficulty": int, "reason": str, "calibration_active": bool}
    # Example output: {"new_difficulty": 5, "reason": "calibration_advance", "calibration_active": True}

check_mastery(recent_performance: list[dict], practice_problems_solved: int) -> bool
    # Returns True if child has hit the mastery threshold for this trick.
    # Adaptive window: up to MIN_PRACTICE_PROBLEMS entries, minimum MIN_PROBLEMS_PER_LEVEL.
    # Returns: bool
    # Example input: recent_performance=[{"correct":True,...} x10], practice_problems_solved=5
    # Example output: True

compute_phase_update(current_phase, phase_counters, mastery_reached, current_trick, unlocked_tricks) -> dict
    # Decides if phase or trick should change.
    # Also fires trick advance when practice_problems_attempted >= MAX_PROBLEMS_PER_TRICK (cap).
    # Returns: {"phase_update": str|None, "trick_update": str|None}
    # Example output: {"phase_update": "discovery", "trick_update": "A2"}

build_adjuster_response(difficulty_result: dict, phase_result: dict, calibration_active: bool) -> dict
    # Assembles the final response. On trick transition: resets difficulty to DIFFICULTY_MIN
    # and sets calibration_active=True so the child is re-calibrated on the new trick.
    # Returns: dict with new_difficulty_target, adjustment_reason, phase_update, trick_update, calibration_active
    # Example output: {"new_difficulty_target": 5, "adjustment_reason": "advance",
    #                  "phase_update": None, "trick_update": None, "calibration_active": True}

process_answer(answer_result, current_difficulty, difficulty_ceiling, current_phase,
               phase_counters, recent_performance, current_trick, unlocked_tricks,
               scorer=None) -> dict
    # Single public entry point the backend calls after every answer.
    # Derives calibration_active internally. Calls the four functions above in order.
    # scorer: optional ML predict function — replaces compute_session_adjustment in normal mode.
    # The backend never passes calibration_active and never passes scorer.
    # Returns: same shape as build_adjuster_response
```

---

## FastAPI Endpoints

Both modules are exposed as FastAPI endpoints. Add them to the backend's existing FastAPI app — or create a new `recommender_api.py` if the project structure requires it.

```python
POST /recommend
    body: RecommenderInput (Pydantic model)
    returns: RecommenderOutput (Pydantic model)

POST /adjust
    body: AdjusterInput (Pydantic model)
    returns: AdjusterOutput (Pydantic model)
```

### Pydantic Models To Add to `schemas.py`

```python
class CandidateProblem(BaseModel):
    id: str
    trick_id: str
    difficulty: int
    grade: int
    phase_tag: str          # "discovery" | "practice"
    previously_failed: bool

class RecommenderInput(BaseModel):
    child: ChildProfileInput   # already exists
    candidate_problems: list[CandidateProblem]

class RecommenderOutput(BaseModel):
    problem_id: str | None
    phase_signal: str | None   # "reveal" | None
    needs_refill: bool
    refill_context: dict | None

class AnswerResult(BaseModel):
    correct: bool
    hints_used: int
    duration_ms: int
    attempts: int

class PhaseCounters(BaseModel):
    discovery_problems_seen: int
    practice_problems_solved: int

class RecentProblemPerformance(BaseModel):
    difficulty: int
    correct: bool
    hints_used: int
    duration_ms: int

class AdjusterInput(BaseModel):
    child_id: int
    current_difficulty: int
    difficulty_ceiling: int
    current_trick: str
    current_phase: str
    answer_result: AnswerResult
    phase_counters: PhaseCounters
    recent_performance: list[RecentProblemPerformance]

class AdjusterOutput(BaseModel):
    new_difficulty_target: int
    adjustment_reason: str
    phase_update: str | None
    trick_update: str | None
```

---

## Testing Rules

Every function must have a unit test in `test_agents.py`. No API calls. No DB calls. No real credentials.

### Tests To Write for `problem_recommender.py`

```
TestScoreCandidate
  - phase match gives higher score than phase mismatch
  - previously_failed gets higher score than unseen
  - difficulty delta penalises off-target problems correctly
  - all weights sum correctly for a perfect-fit candidate

TestPickBestProblem
  - returns highest-scoring candidate
  - returns None when candidates list is empty
  - prefers retry over unseen when retry is available

TestCheckPhaseSignal
  - returns "reveal" when discovery count reaches threshold
  - returns None when count is below threshold
  - returns None when phase is not "discovery"

TestBuildResponse
  - needs_refill is True when remaining < MIN_BANK_SIZE
  - needs_refill is False when remaining >= MIN_BANK_SIZE
  - refill_context is None when needs_refill is False
  - refill_context contains correct trick_id, difficulty, grade when needs_refill is True
  - problem_id is None and phase_signal is "reveal" when phase transition triggered
```

### Tests To Write for `difficulty_adjuster.py`

```
TestComputeDifficultyAdjustment
  - advances when hints=0, fast duration, correct (normal mode)
  - holds when hints >= 3 (normal mode)
  - holds when failed >= 2 (normal mode)
  - does not exceed difficulty_ceiling
  - calibration: confident correct (no hints, fast) → +CALIBRATION_DELTA
  - calibration: hesitant correct (hints used) → +CALIBRATION_SLOW_DELTA
  - calibration: hesitant correct (slow) → +CALIBRATION_SLOW_DELTA
  - calibration: hesitant stays calibration_active=True (only wrong ends calibration)
  - calibration: wrong → -CALIBRATION_DROP, calibration_active=False
  - calibration: wrong at floor → stays at DIFFICULTY_MIN
  - calibration: correct at ceiling → calibration_active=False
  - normal mode always returns calibration_active=False

TestCheckMastery
  - returns True at exactly 80% correct over 10 problems
  - returns False at 70% correct
  - returns False when practice_problems_solved < MIN_PROBLEMS_PER_LEVEL
  - returns False when fewer than MIN_PROBLEMS_PER_LEVEL recent problems
  - adaptive window: uses shorter window when history < MIN_PRACTICE_PROBLEMS

TestComputePhaseUpdate
  - returns phase_update="practice" when discovery count hits threshold
  - returns phase_update="discovery" and trick_update when mastery reached
  - returns both None when no transition condition is met
  - trick_update fires when practice_problems_attempted >= MAX_PROBLEMS_PER_TRICK (cap)
  - new trick is prerequisite-gated (only unlocked when full chain satisfied)

TestBuildAdjusterResponse
  - assembles all five fields correctly (includes calibration_active)
  - trick transition resets difficulty to DIFFICULTY_MIN
  - trick transition always sets calibration_active=True (restart calibration)
  - no trick transition preserves calibration_active from difficulty_result

TestProcessAnswer
  - calibration derived from practice_problems_attempted - practice_problems_solved
  - calibration ends on first wrong (timing correction for backend pre-increment)
  - mastery cannot fire during calibration
  - trick advance restarts calibration
  - scorer=None uses rule-based compute_session_adjustment
  - scorer=custom_fn calls custom_fn instead
```

---

## Code Comment Standard
Every file must follow the comment standard from `claude.md`:
- File header block before imports
- Structured comment block inside every function: what it does, return type, example input, example output
- Inline type comment before every variable

---

## Constraints
- Never hardcode weights, thresholds, or model names outside `config.py`
- Never let the recommender or adjuster write to the DB
- Never call the Anthropic API from either new module
- Never duplicate `compute_session_adjustment` logic — import it from `difficulty_engine.py`
- Always validate inputs with Pydantic before processing
- Always use milliseconds for time fields
- Always use A1–D5 codes for trick references, never integer IDs
- Never store or accept `calibration_active` from the backend — derive it internally from `practice_problems_attempted` and `practice_problems_solved` with the timing correction
- Never check mastery during calibration — the child is being placed, not practicing
- Never pass `scorer` from the backend — it is an AI-pipeline-internal hook for swapping in an ML model