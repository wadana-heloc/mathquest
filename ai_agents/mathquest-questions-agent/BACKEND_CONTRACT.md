# MathQuest Backend Contract

This document tells the backend engineer exactly what to do at every step — which Python functions to call, what to pass in, and what to write back to the DB.

The two Python modules live in the AI pipeline repo:
- `problem_recommender.py` — call `recommend()` before serving a problem
- `difficulty_adjuster.py` — call `process_answer()` after the child submits an answer

Those are the only two functions you need to call. Everything else inside those modules is internal.

---

## New DB Tables You Own

### `problem_bank`
Shared pool of all pre-generated problems.

| column | type | notes |
|---|---|---|
| id | varchar PK | e.g. "p_001" |
| trick_id | varchar | A1–D5 format |
| difficulty | int | 1–10 |
| grade | int | school grade |
| phase_tag | varchar | "discovery" or "practice" |
| zone | int | 1–5 |
| stem | text | problem text shown to child |
| answer | int | correct answer |
| answer_type | varchar | "exact", "range", or "set" |
| hints | jsonb | array of 3 hint objects |
| aha_moment | text | |
| flavor_text | text | |
| tags | jsonb | array of strings |
| shortcut_path | text | internal only — never send to client |
| brute_force_path | text | internal only — never send to client |
| shortcut_time_threshold_ms | int | |
| estimated_brute_force_seconds | int | |
| estimated_trick_seconds | int | |

### `child_problem_state`
Tracks what each child has done with each problem.

| column | type | notes |
|---|---|---|
| child_id | int FK | |
| problem_id | varchar FK | references problem_bank |
| solved_correctly | bool | |
| previously_failed | bool | true if attempted and wrong at least once |
| hints_used | int | |
| duration_ms | int | |
| attempts | int | |
| answered_at | timestamp | |

### `child_trick_phase`
Tracks the pedagogical phase per child per trick.

| column | type | notes |
|---|---|---|
| child_id | int FK | |
| trick_id | varchar | A1–D5 |
| current_phase | varchar | "discovery" or "practice" |
| discovery_problems_seen | int | resets to 0 when trick changes |
| practice_problems_solved | int | correct answers only — resets to 0 when trick changes |
| practice_problems_attempted | int | all attempts correct + wrong — resets to 0 when trick changes |

---

## Flow 1 — Serving a Problem

Call this flow every time the child requests the next problem.

### Step 1 — Read child state from DB

Fetch from your `children` / `child_progress` table:
- `current_trick`, `current_phase`, `current_difficulty`, `difficulty_ceiling`
- `unlocked_tricks` (list of A1–D5 strings)
- `discovery_problems_seen` from `child_trick_phase`

### Step 2 — Query candidates from `problem_bank`

```sql
SELECT id, trick_id, difficulty, grade, phase_tag
FROM problem_bank
WHERE trick_id = :current_trick
  AND difficulty = :current_difficulty
  AND grade = :child_grade
  AND id NOT IN (
      SELECT problem_id FROM child_problem_state
      WHERE child_id = :child_id AND solved_correctly = true
  )
```

Then for each result, check `child_problem_state` to set `previously_failed`:
```sql
SELECT problem_id FROM child_problem_state
WHERE child_id = :child_id AND previously_failed = true
```

### Step 3 — Call `recommend()`

```python
from problem_recommender import recommend

child = {
    "current_phase": "practice",       # from DB
    "current_difficulty": 4,           # from DB
    "current_trick": "A1",             # from DB
    "discovery_problems_seen": 0,      # from child_trick_phase
}

candidates = [
    {"id": "p_044", "trick_id": "A1", "difficulty": 4, "grade": 3,
     "phase_tag": "practice", "previously_failed": False},
    # ... all rows from SQL above, with previously_failed set
]

response = recommend(child, candidates)
```

`recommend()` uses a weighted scoring formula by default. If you later want to replace it with an ML model, pass a scorer function — nothing else changes:
```python
# future ML swap — only this line changes, no other code is affected
response = recommend(child, candidates, scorer=my_ml_model.score)
```
The scorer receives `(candidate_dict, child_dict)` and returns a number. Higher = better fit.

`response` will be one of:

**Normal — serve a problem:**
```json
{ "problem_id": "p_044", "needs_refill": false, "refill_context": null, "phase_signal": null }
```

**Discovery phase complete — show reveal screen:**
```json
{ "problem_id": null, "needs_refill": false, "refill_context": null, "phase_signal": "reveal" }
```

**Bank running low — serve problem AND trigger refill:**
```json
{
  "problem_id": "p_044",
  "needs_refill": true,
  "refill_context": { "trick_id": "A1", "difficulty": 4, "grade": 3, "current_count": 3 },
  "phase_signal": null
}
```

### Step 4 — Act on the response

**If `phase_signal == "reveal"`:**
- Do not fetch a problem. Show the trick reveal animation to the child.
- Update `child_trick_phase` → set `current_phase = "practice"` once the child taps "I got it".
- Do not call `process_answer()` — the child did not answer a problem.

**If `problem_id` is set:**
- Fetch the full problem from `problem_bank` by `problem_id`.
- Strip `shortcut_path` and `brute_force_path` before sending to the client.
- Record the problem as "seen" in `child_problem_state`.
- If `current_phase == "discovery"`, increment `discovery_problems_seen` **now** (when served, not after the answer):
  ```sql
  UPDATE child_trick_phase
  SET discovery_problems_seen = discovery_problems_seen + 1
  WHERE child_id = :child_id AND trick_id = :current_trick AND current_phase = 'discovery';
  ```

**If `needs_refill == true`:**
- Trigger the AI generator as a background task (do not block the response):
  ```python
  # run in a background worker / task queue — never inline
  from orchestrator import run_pipeline
  new_problem = run_pipeline(child_profile_input)
  # insert new_problem into problem_bank
  ```
- Use `refill_context` to pass the right trick/difficulty/grade to the generator.

---

## Flow 2 — After the Child Submits an Answer

Call this flow every time the child taps "Submit".

### Step 1 — Write the raw answer to `child_problem_state`

```sql
INSERT INTO child_problem_state
  (child_id, problem_id, solved_correctly, previously_failed, hints_used, duration_ms, attempts, answered_at)
VALUES
  (:child_id, :problem_id, :correct, NOT :correct, :hints_used, :duration_ms, :attempts, NOW())
ON CONFLICT (child_id, problem_id) DO UPDATE
  SET solved_correctly = :correct,
      previously_failed = NOT :correct,
      hints_used = :hints_used,
      attempts = :attempts;
```

If `current_phase == "practice"`, increment `practice_problems_attempted` on every answer and `practice_problems_solved` only on a correct one:
```sql
-- every answer in practice phase (correct or wrong):
UPDATE child_trick_phase
SET practice_problems_attempted = practice_problems_attempted + 1
WHERE child_id = :child_id AND trick_id = :current_trick AND current_phase = 'practice';

-- additionally, only on a correct answer:
UPDATE child_trick_phase
SET practice_problems_solved = practice_problems_solved + 1
WHERE child_id = :child_id AND trick_id = :current_trick
  AND current_phase = 'practice' AND :answer_was_correct = true;
```

> `discovery_problems_seen` is **not** updated here — it was already incremented in Flow 1 Step 4 when the problem was served. Wrong answers in discovery phase do not undo that increment.

### Step 2 — Fetch recent performance

```sql
SELECT difficulty, solved_correctly AS correct, hints_used, duration_ms
FROM child_problem_state
WHERE child_id = :child_id
  AND difficulty = :current_difficulty
ORDER BY answered_at DESC
LIMIT 10
```

### Step 3 — Call `process_answer()`

> **Important:** read `phase_counters` from `child_trick_phase` **after** the Step 1 increments have been written. Do not use a value cached at the start of the request — the cap check depends on the current answer already being counted.

```python
from difficulty_adjuster import process_answer

response = process_answer(
    answer_result={
        "correct": True,
        "hints_used": 1,
        "duration_ms": 3800,
        "attempts": 1,
    },
    current_difficulty=4,           # from DB
    difficulty_ceiling=10,          # from DB
    current_phase="practice",       # from DB
    phase_counters={
        "discovery_problems_seen": 0,     # from child_trick_phase (post-Step-1)
        "practice_problems_solved": 5,    # from child_trick_phase (post-Step-1) — correct answers only
        "practice_problems_attempted": 6, # from child_trick_phase (post-Step-1) — all attempts including this one
    },
    recent_performance=[
        {"difficulty": 4, "correct": True, "hints_used": 0, "duration_ms": 2900},
        # ... up to 10 rows from SQL above
    ],
    current_trick="A1",             # from DB
    unlocked_tricks=["A1", "A2"],   # from DB
)

# No calibration_active parameter — the adjuster derives it internally from
# practice_problems_attempted and practice_problems_solved.
```

`response` will look like:

**Normal — difficulty adjusted:**
```json
{ "new_difficulty_target": 5, "adjustment_reason": "advance", "phase_update": null, "trick_update": null, "calibration_active": true }
```

**Discovery phase complete:**
```json
{ "new_difficulty_target": 4, "adjustment_reason": "maintain", "phase_update": "practice", "trick_update": null, "calibration_active": true }
```

**Trick mastered — move to next trick:**
```json
{ "new_difficulty_target": 1, "adjustment_reason": "maintain", "phase_update": "discovery", "trick_update": "A2", "calibration_active": true }
```

**Calibration complete — child's level found:**
```json
{ "new_difficulty_target": 6, "adjustment_reason": "calibration_complete", "phase_update": null, "trick_update": null, "calibration_active": false }
```

### Step 4 — Write the response to DB

```python
# Always write the new difficulty
update_child_difficulty(child_id, response["new_difficulty_target"])

# Write phase change if any
if response["phase_update"]:
    update_child_phase(child_id, current_trick, response["phase_update"])

# Write trick change if mastery was reached
if response["trick_update"]:
    new_trick = response["trick_update"]
    unlock_trick(child_id, new_trick)
    set_current_trick(child_id, new_trick)
    reset_phase_counters(child_id, new_trick)   # discovery_problems_seen = 0, practice_problems_solved = 0, practice_problems_attempted = 0
    # new_difficulty_target is already 1 — no extra reset needed
```

---

## Phase Counters Reference

`discovery_problems_seen` and `practice_problems_solved` live in the `child_trick_phase` table — one row per child per trick. Here is the complete lifecycle of both counters.

---

### How a row is created

When a child unlocks a new trick for the first time, insert a fresh row:

```sql
INSERT INTO child_trick_phase
  (child_id, trick_id, current_phase, discovery_problems_seen, practice_problems_solved, practice_problems_attempted)
VALUES
  (:child_id, :new_trick, 'discovery', 0, 0, 0);
```

All new tricks start in `discovery` phase with both counters at zero.

---

### `discovery_problems_seen`

**What it counts:** every problem served to the child while `current_phase = 'discovery'` for this trick — correct or wrong.

**When to increment:** immediately after you serve the problem (not after the answer), because "seen" means the problem was shown, not solved.

```sql
UPDATE child_trick_phase
SET discovery_problems_seen = discovery_problems_seen + 1
WHERE child_id = :child_id AND trick_id = :current_trick AND current_phase = 'discovery';
```

**When it resets to 0:** when `process_answer()` returns `trick_update` (child advances to a new trick). The new trick's row starts at 0.

**What happens when it reaches `DISCOVERY_PROBLEMS_REQUIRED` (2):**
`recommend()` returns `phase_signal = "reveal"`. You show the trick reveal screen. Once the child taps "I got it", you write:
```sql
UPDATE child_trick_phase
SET current_phase = 'practice'
WHERE child_id = :child_id AND trick_id = :current_trick;
```
You do **not** reset `discovery_problems_seen` — leave it at 2. It is no longer read after phase moves to `practice`.

---

### `practice_problems_solved`

**What it counts:** problems the child answered **correctly** while `current_phase = 'practice'` for this trick. Wrong answers are not counted.

**When to increment:** after every correct answer in practice phase.

```sql
UPDATE child_trick_phase
SET practice_problems_solved = practice_problems_solved + 1
WHERE child_id = :child_id AND trick_id = :current_trick
  AND current_phase = 'practice'
  AND :answer_was_correct = true;
```

**When it resets to 0:** when `process_answer()` returns `trick_update` (child advances to a new trick). The new trick's row starts at 0.

**What happens when it reaches `MIN_PROBLEMS_PER_LEVEL` (5) AND correct rate ≥ 80% over recent history:**
`process_answer()` returns `trick_update = "A2"` (or whichever trick is next) and `phase_update = "discovery"`. You then write the new trick row and reset everything (see Flow 2 Step 4).

The mastery window is adaptive: up to the last 10 entries if available, but as few as 5 (= `MIN_PROBLEMS_PER_LEVEL`). This allows a child to reach mastery in a single trick stint even though `MAX_PROBLEMS_PER_TRICK (7) < MIN_PRACTICE_PROBLEMS (10)`. A child with a longer history across previous tricks and difficulties is measured over the fuller window, which is more rigorous.

### `practice_problems_attempted`

**What it counts:** every answer in practice phase — correct and wrong.

**When to increment:** after every answer in practice phase, regardless of correctness.

**When it resets to 0:** when `process_answer()` returns `trick_update`. The new trick's row starts at 0.

**What happens when it reaches `MAX_PROBLEMS_PER_TRICK` (7):**
`process_answer()` forces a trick advance even if mastery was not reached. The child moves to the next trick's discovery phase so they don't grind endlessly on the same concept. The response looks identical to a mastery advance — `trick_update` and `phase_update = "discovery"` are both set.

---

### Counter state at every phase transition

| event | discovery_problems_seen | practice_problems_solved | practice_problems_attempted | current_phase |
|---|---|---|---|---|
| trick first unlocked | 0 | 0 | 0 | discovery |
| each problem served in discovery | +1 | — | — | discovery |
| child taps "I got it" on reveal screen | stays at 2 | 0 | 0 | **practice** |
| correct answer in practice | — | +1 | +1 | practice |
| wrong answer in practice | — | — | +1 | practice |
| mastery reached (≥80% over 10) | reset to 0 (new row) | reset to 0 (new row) | reset to 0 (new row) | **discovery** |
| cap hit (attempted ≥ 7, no mastery) | reset to 0 (new row) | reset to 0 (new row) | reset to 0 (new row) | **discovery** |

---

## Rules You Must Follow

- **Never send `shortcut_path` or `brute_force_path` to the client** — strip them before every response.
- **Never call the AI generator inside a request that is already serving a problem** — generator calls go to a background task queue only.
- **Always call `process_answer()` after every answer** — even wrong ones. The adjuster needs every data point.
- **`discovery_problems_seen`, `practice_problems_solved`, and `practice_problems_attempted` all reset to 0** whenever `trick_update` is not null.
- **`current_difficulty` resets to 1** whenever `trick_update` is not null (the adjuster already sets `new_difficulty_target = 1` in this case).
- **`calibration_active` is handled entirely inside `process_answer()`** — you do not pass it and do not store it. The only requirement on your side is that `practice_problems_attempted` is always included in `phase_counters` and is accurate (post-Step-1 increment).
- **Time fields are always milliseconds** — `duration_ms`, `shortcut_time_threshold_ms`. Never seconds.
- **Trick IDs are always A1–D5 strings** — never integers.
