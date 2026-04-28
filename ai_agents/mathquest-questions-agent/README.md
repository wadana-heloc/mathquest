# MathQuest Questions Agent

An agentic math problem generation system built with the Anthropic API. The pipeline reads a child's profile and performance history, selects the right trick and difficulty, generates a personalized math problem, and has a second AI agent review and validate it before returning it to the backend.

---

## What It Does

The backend calls `run_pipeline(child_profile)` and always gets back a validated, child-safe math problem. The pipeline handles everything in between: difficulty computation, trick selection, problem generation, quality review, retries, and fallback.

```
Backend → Orchestrator → Difficulty Engine → Agent 1 → Pydantic → Agent 2 → Problem
```

---

## Project Structure

```
mathquest-questions-agent/
├── orchestrator.py          # Entry point — wires the full pipeline
├── agent_generator.py       # Agent 1: generates one problem via Claude
├── agent_reviewer.py        # Agent 2: validates math, hints, age-appropriateness
├── difficulty_engine.py     # Pure Python — computes difficulty target and eligible tricks
├── schemas.py               # Pydantic models for all input/output types
├── config.py                # All constants: model name, token limits, thresholds
├── test_agents.py           # 88 unit tests — run with pytest, no API calls needed
├── run_test.py              # Manual end-to-end test using the real API
├── tricks/
│   └── tricks_reference.json   # All 25 tricks with descriptions
├── fallback_problems/           # Pre-made validated problems served when agents fail
└── .env                         # ANTHROPIC_API_KEY and MOCK_API flag
```

---

## Prerequisites

- Python 3.11
- An [Anthropic API key](https://console.anthropic.com/)

---

## Setup

**1. Install dependencies**

```bash
pip install anthropic pydantic python-dotenv pytest
```

**2. Create your `.env` file**

```
ANTHROPIC_API_KEY=your_key_here
MOCK_API=false
```

Set `MOCK_API=true` to run the pipeline without making real API calls (uses hardcoded fixtures). Useful during development and required for all unit tests.

---

## Running the Pipeline

**End-to-end test with the real API:**

```bash
python run_test.py
```

**Unit tests (no API, no credentials needed):**

```bash
pytest test_agents.py -v
```

**From your own code:**

```python
from schemas import ChildProfileInput
from orchestrator import run_pipeline

child_profile = ChildProfileInput(**your_profile_dict)
problem = run_pipeline(child_profile)
```

`run_pipeline` always returns a dict. It never raises and never returns `None`.

---

## Pipeline Flow

```
1. Backend fetches child profile from DB and passes it as JSON
         │
         ▼
2. Difficulty Engine (pure Python, no AI)
   ├─ compute_difficulty_target()  →  int on the 1–10 scale
   └─ get_eligible_tricks()        →  list[str] ordered by priority
         │
         ▼
3. Agent 1 — generate_problem()
   Receives: child profile (capped to last 5 problems) +
             difficulty target + eligible trick descriptions
   Returns:  raw problem dict | None
         │
         ▼
4. Pydantic validation (ProblemOutput)
   Pass → continue   |   Fail → skip Agent 2, retry or fallback
         │
         ▼
5. Agent 2 — review_problem()
   Receives: validated problem + single trick description (not the full 25)
   Checks:   math correctness · trick alignment · hint quality ·
             schema completeness · age-appropriateness
   Returns:  approved=True → pass through
             approved=False + correction → use corrected problem
             approved=False, no correction → retry
         │
         ▼
6. Retry loop (max 2 total attempts)
         │
         ▼
7. Fallback: fallback_problems/{trick_id}_d{difficulty}.json
   Last resort: hardcoded mock fixture (always valid)
         │
         ▼
8. Strip internal fields (shortcut_path, brute_force_path)
         │
         ▼
   Return problem dict to backend
```

---

## Child Profile Input

The backend must pre-fetch and pass this JSON. The pipeline never connects to the database directly.

```json
{
  "child": {
    "age": 8,
    "grade": 3,
    "current_zone": 2,
    "current_difficulty": 4,
    "difficulty_ceiling": 10,
    "unlocked_tricks": ["A1", "A2", "B1"],
    "session_stats": {
      "problems_solved_today": 5,
      "current_streak": 3,
      "avg_time_per_problem_ms": 4200
    }
  },
  "recent_problems": [
    {
      "trick_id": "A2",
      "problem": "9 × 8 = ?",
      "solved": true,
      "hints_used": 0,
      "difficulty": 4,
      "duration_ms": 1800,
      "insight_detected": true,
      "attempts": 1
    }
  ]
}
```

The pipeline caps `recent_problems` to the last 5 before sending to Agent 1. The backend may send more.

---

## Problem Output

Internal fields (`shortcut_path`, `brute_force_path`) are stripped before the problem reaches the backend. The backend must never expose these to the child client.

```json
{
  "id": "p_001",
  "zone": 2,
  "category": "pattern",
  "difficulty": 4,
  "trick_id": "A1",
  "stem": "The vault door reads: 11 × 23 = ?",
  "answer": 253,
  "answer_type": "exact",
  "shortcut_time_threshold_ms": 3000,
  "hints": [
    { "level": 1, "text": "What do you notice about the digits of 23?", "cost": 0 },
    { "level": 2, "text": "Try adding the two digits of 23 together.", "cost": 5 },
    { "level": 3, "text": "Place that sum between the original digits.", "cost": 15 }
  ],
  "aha_moment": "When multiplying by 11, the middle digit is always the sum of the two outer digits.",
  "flavor_text": "The ancient vault cipher displays 11 × 23. Solve it to open the door.",
  "tags": ["multiplication", "×11", "two-digit", "zone-2"],
  "estimated_brute_force_seconds": 10,
  "estimated_trick_seconds": 2
}
```

---

## Difficulty Engine

Lives in `difficulty_engine.py` and is owned by the AI pipeline, not the backend. This is intentional — difficulty logic can be tuned and tested independently without backend coordination.

**Difficulty scale:** 1 (basic arithmetic) to 10 (competition level).

**Session-level adjustment** — checked each request:

| Condition | Result |
|---|---|
| hints_used ≥ 3 OR failed ≥ 2 OR avg_time > 90s | Hold difficulty (`consolidate`) |
| hints == 0 AND failed == 0 AND avg_time < 25s | Advance by +1 (`advance`) |
| Everything else | Hold (`maintain`) |

**Long-term advancement rule** — checked when ≥ 10 problems of history exist:
- If correct rate over last 10 problems ≥ 80% **and** at least 5 problems solved at the current difficulty level → advance by +1.

Advancement never fires twice in a single call (session rule and long-term rule cannot both add +1).

---

## The 25 Tricks

Tricks are referenced by code (A1–D5) across four categories. Agent 1 receives only the subset eligible for this child — never all 25.

| Category | Tricks |
|---|---|
| A — Pattern Shortcuts | A1 ×11 Digit-Sum, A2 ×9 Complement, A3 Doubling Chains, A4 Near-Square Identity, A5 Sum of First N Odds, A6 Difference of Squares, A7 ×25 and ×125 |
| B — Invariants | B1 Parity, B2 Perimeter Invariance, B3 Conservation of Sum, B4 Modular Arithmetic, B5 Digit Sum Divisibility, B6 Pigeonhole Principle |
| C — Mental Acceleration | C1 Chunking, C2 Complement to 100, C3 Benchmark Numbers, C4 Near-Doubles, C5 ×5 via Half-of-Ten, C6 Estimation and Bounds, C7 Left-to-Right Multiplication |
| D — Structural Thinking | D1 Symmetry and Half-Double, D2 State Transitions, D3 Balance/Equilibrium, D4 Geometric Series Intuition, D5 Triangular Numbers |

Tricks follow a prerequisite graph — a new trick is only introduced once its prerequisite chain is fully unlocked. For example, A6 (Difference of Squares) requires A4 (Near-Square Identity). At most 2 new tricks are introduced at once to avoid overwhelming the child.

---

## Trick Ordering in Eligible List

`get_eligible_tricks` returns tricks in this priority order:

1. **Struggling tricks first** — any unlocked trick with recent failures or hint usage
2. **Solid unlocked tricks** — cleanly solved with no hints
3. **Up to 2 new tricks** — locked tricks whose prerequisites are all satisfied

Agent 1 naturally prioritizes the first trick in the list, giving the child more practice on weak spots.

---

## Token Efficiency

| Technique | Effect |
|---|---|
| Prompt caching on system prompts | Input tokens not re-charged within Anthropic's 5-minute cache window |
| Only eligible tricks sent to Agent 1 | Smaller user message; 5 trick descriptions instead of 25 |
| `recent_problems` capped at 5 | Older history dropped before it reaches the API |
| Tight `max_tokens` (600 for Agent 1, 300 for Agent 2) | Forces structured JSON, prevents model rambling |
| Agent 2 skipped if Pydantic validation fails | No tokens spent reviewing structurally broken output |
| `MOCK_API=true` in development | Zero tokens in all tests and local iteration |

---

## Fallback Problem Bank

`fallback_problems/` holds pre-made, manually validated problems named `{trick_id}_d{difficulty}.json` (e.g. `A1_d4.json`). The orchestrator loads from here when both Agent 1 attempts are exhausted.

If no matching file exists, the pipeline returns a hardcoded mock fixture for trick A1 at difficulty 4. The pipeline **always** returns a problem.

---

## Configuration Reference

All values live in `config.py`. Edit there to tune the system.

| Constant | Default | Description |
|---|---|---|
| `MODEL_NAME` | `claude-sonnet-4-5` | Anthropic model used by both agents |
| `AGENT1_MAX_TOKENS` | `600` | Token budget for Agent 1 response |
| `AGENT2_MAX_TOKENS` | `300` | Token budget for Agent 2 response |
| `MAX_RETRIES` | `1` | Retry attempts before fallback (2 total attempts) |
| `RETRY_WAIT_SECONDS` | `2` | Seconds between retry attempts |
| `DIFFICULTY_MIN` | `1` | Minimum difficulty level |
| `DIFFICULTY_MAX` | `10` | Maximum difficulty level |
| `ADVANCEMENT_CORRECT_RATE` | `0.80` | Correct rate required for long-term advancement |
| `ADVANCEMENT_WINDOW` | `10` | Number of recent problems measured for advancement |
| `MIN_PROBLEMS_PER_LEVEL` | `5` | Minimum solved at current level before advancement |
| `CONSOLIDATE_HINTS_THRESHOLD` | `3` | Hints-used threshold for difficulty hold |
| `CONSOLIDATE_FAILED_THRESHOLD` | `2` | Failed problems threshold for difficulty hold |
| `CONSOLIDATE_DURATION_THRESHOLD_MS` | `90000` | Avg time threshold (ms) for difficulty hold |
| `ADVANCE_DURATION_THRESHOLD_MS` | `25000` | Avg time threshold (ms) for difficulty advance |
| `RECENT_PROBLEMS_CAP` | `5` | Max recent problems sent to Agent 1 |
| `PROMPT_CACHING_ENABLED` | `True` | Toggle Anthropic prompt caching |

---

## Backend Integration Notes

- The backend is responsible for **fetching the child profile** from the DB and passing it as JSON. The pipeline never reads the DB.
- The backend must **write back `current_difficulty`** after each problem answer. Use the `difficulty` field from the returned problem — that is the level the pipeline targeted.
- `shortcut_path` and `brute_force_path` are always stripped from the return value. Never expose them to the child client.
- All time values are in **milliseconds** throughout — `duration_ms`, `shortcut_time_threshold_ms`, etc.
- All trick references use **A1–D5 codes** — never integer IDs.
