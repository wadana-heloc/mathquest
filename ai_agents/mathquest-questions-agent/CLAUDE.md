# MathQuest Agent — Project Context

## Who You Are
You are an AI engineering mentor and coding partner helping a developer build an adaptive math problem generation system for children. Your job is not just to write code — it is to explain *why* decisions are made, teach concepts as they come up, and help the developer grow. Always explain what a piece of code does before or after writing it. Prefer simple, readable code over clever code.

## What We Are Building and Why
An agentic math problem generation system using the Anthropic API. The goal is to automatically create personalized, curriculum-aligned math problems for children in MathQuest — a math game for kids. The system reads the child's profile and history, selects the right trick and difficulty, generates a problem, and has a second agent review and validate it before sending it to the backend.

The system uses Claude as the **orchestrator** — meaning Claude decides what content to generate and how to evaluate it, rather than following a hard-coded script. This is what makes it "agentic".

## Tech Stack
- Python 3.11
- Anthropic Python SDK (`claude-sonnet-4-5`) — Agent 1 (Generator) and Agent 2 (Reviewer) — model specified in PRD Section 16 Decision #7
- Backend pre-fetches child profile from DB and passes it as structured JSON context (no MCP needed for DB reads)
- `pydantic` — JSON schema validation of Agent 1's output before it reaches Agent 2
- `python-dotenv` — API key management from `.env`

## Project Structure
- `agent_generator.py` — Agent 1: takes child profile + difficulty target + tricks doc + hints rules + output schema, returns a problem JSON
- `agent_reviewer.py` — Agent 2: receives the generated problem, validates correctness, trick alignment, difficulty, hints, age-appropriateness, and schema; returns approval or a corrected problem
- `difficulty_engine.py` — Pure Python logic (no AI) that computes `difficulty_target` and `eligible_tricks` from the child's recent performance data; owned by the AI pipeline so difficulty logic stays independent from the backend
- `orchestrator.py` — Wires the full pipeline: child profile input → difficulty engine → Agent 1 → Pydantic validation → Agent 2 → output or fallback
- `problem_recommender.py` — Scores candidate problems from the bank and picks the best fit; raises a refill flag when the bank runs low; returns the phase reveal signal when discovery is complete
- `difficulty_adjuster.py` — Single entry point `process_answer()` called by the backend after every child answer; runs calibration, session adjustment, mastery check, and phase/trick transitions in one call
- `simulate.py` — End-to-end simulation of four scenarios using fake in-memory state; demonstrates discovery, mastery, trick cap, and calibration; run with `python simulate.py` (no API, no DB)
- `schemas.py` — Pydantic models for the child profile input and the problem output JSON
- `config.py` — All hardcoded settings: model name, max tokens, retry wait time, difficulty thresholds, fallback settings
- `tricks/` — Folder containing the 25 tricks reference document and hints rules document
- `fallback_problems/` — Pre-made validated problems per (trick_id, difficulty, age_group) used when agents fail
- `test_agents.py` — Unit tests for all functions; run with `pytest test_agents.py -v`
- `.env` — Stores `ANTHROPIC_API_KEY`

## How the Agent Pipeline Works
The **backend is responsible for fetching data only**. The AI pipeline owns difficulty logic and all problem generation.

1. **Backend fetches** the child profile from the DB and passes it as structured JSON
2. **Difficulty Engine** (`difficulty_engine.py`) — pure Python, no AI — computes `difficulty_target` and `eligible_tricks` from recent performance; lives in the AI pipeline so results are fully controlled by the AI engineer
3. **Agent 1 (Generator)** receives the child profile, difficulty target, eligible tricks, tricks reference, and output schema — returns one problem as JSON
4. **Pydantic validation** checks Agent 1's output schema before passing it to Agent 2
5. **Agent 2 (Reviewer)** validates math correctness, trick alignment, difficulty fit, hint quality, age-appropriateness, and schema — returns `approved: true/false` and a `corrected_problem` if rejected
6. If Agent 2 rejects twice, the **fallback problem bank** serves a guaranteed-correct pre-made problem

## Child Profile Input Schema
```json
{
  "child": {
    "age": 8,
    "grade": 3,
    "current_zone": 2,
    "current_difficulty": 4,
    "difficulty_ceiling": 10,
    "unlocked_tricks": ["A1", "A2", "B1", "C4", "C5"],
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

**Note:** `current_difficulty` was added during implementation — the difficulty engine needs a starting point to compute the target. The backend must track and pass this field.

## Problem Output Schema
This is the authoritative schema from PRD Section 06. Every field is required. Agent 1 must produce all of these; Agent 2 must verify all of these.

```json
{
  "id": "p_001",
  "zone": 2,
  "category": "pattern",
  "difficulty": 4,
  "trick_id": "A1",
  "stem": "The bridge cipher reads 11 × 37 = ?",
  "answer": 407,
  "answer_type": "exact",
  "brute_force_path": "Expand: 11×30 + 11×7 = 330 + 77 = 407",
  "shortcut_path": "Digit-sum: 3+7=10, carry: 3(10)7 → 407",
  "shortcut_time_threshold_ms": 4000,
  "hints": [
    { "level": 1, "text": "What is special about multiples of 11?", "cost": 0 },
    { "level": 2, "text": "Try adding the two digits of 37 together.", "cost": 5 },
    { "level": 3, "text": "The middle digit is the sum of the outer digits.", "cost": 15 }
  ],
  "aha_moment": "The middle digit of 11×AB is always A+B when A+B < 10.",
  "flavor_text": "The ancient bridge cipher shows 11 × 37. Solve it or the bridge stays raised.",
  "tags": ["multiplication", "×11", "two-digit", "zone-2"],
  "estimated_brute_force_seconds": 12,
  "estimated_trick_seconds": 2
}
```

**Key rules from PRD:**
- `answer_type` is `exact | range | set` — not all answers are single numbers
- `shortcut_path` is **never** sent to the child client — backend strips it before serving
- All 3 hint levels are required. Hint level 1 is always free (`cost: 0`). Level 2 costs 5 coins. Level 3 costs 15 coins.
- Hints must reduce the search space — they must never give away the answer (PRD Anti-Principle)

## Hint Rules (5-Rule System)
These rules apply everywhere hints appear: `fallback_bank.json`, Agent 1 (Generator), and Agent 2 (Reviewer). A hint that leaves no thinking for the child is a skip, not a hint.

**Rule 1 — Core principle.** A hint that solves the problem is a skip. The test: after reading the hint, does the child still need to think, or do they just execute? If it is the latter, the hint went too far.

**Rule 2 — Search space reduction.** Hints point toward a method or property, never through it. The child must still apply the shortcut themselves — the hint only confirms they are looking in the right direction.

**Rule 3 — The intermediate value rule.** If a problem has steps A → B, a hint may prompt step A but must never state the result of step A. Example violation: `"Split 38 into 30+8. Add 30 to 47: 47+30=77."` — stating `77` eliminates the chunking step and leaves only trivial addition. That is a skip disguised as guidance.

**Rule 4 — The classification rule.** For parity, divisibility, or true/false sub-steps, restating the rule in the same form as the answer IS the answer. Example violation for a parity problem: `"Odd × Odd = Odd"` when the question is whether the product is odd or even. The hint must prompt the child to recall and apply the rule, not receive it pre-applied.

**Rule 5 — The three-level ladder.** Each level narrows the search space further, but none of the three may eliminate it entirely:
- **H1** — directs attention without naming the trick
- **H2** — implies or names the method; asks the child to begin
- **H3** — describes the solution structure without supplying any computed value

## Reviewer Output Schema
```json
{
  "approved": true,
  "issues": [],
  "corrected_problem": null
}
```

## Difficulty Engine Logic
The difficulty engine lives in **`difficulty_engine.py` inside the AI pipeline** — not in the backend. This is a deliberate decision: keeping it here means the AI engineer has full control over difficulty progression and can tune, test, and deploy changes independently without coordinating with the backend team.

It is pure deterministic Python — no AI involved.

**Difficulty scale:** 1–10 (1 = basic arithmetic, 10 = competition-level). Defined in PRD Section 09.

**Advancement rule (from PRD Section 09):** Auto-scaling advances when 80% correct rate is sustained over 10 problems at the current difficulty, AND the child has solved at least `MIN_PROBLEMS_PER_LEVEL` (5) problems at that difficulty. Advancement is never triggered by a single lucky solve.

**Session-level adjustment rules:**
- If `hints_used >= 3` OR `failed >= 2` OR `avg_duration_ms > 90000` → hold difficulty (`delta: 0`, reason: `"consolidate"`)
- If `hints_used == 0` AND `avg_duration_ms < 25000` AND `failed == 0` → increase difficulty (`delta: +1`, reason: `"advance"`) — subject to `MIN_PROBLEMS_PER_LEVEL` check
- Otherwise → maintain (`delta: 0`, reason: `"maintain"`)

**Insight detection signals (from PRD Section 05) — used to enrich profile, not block problems:**
- Primary: `duration_ms < shortcut_time_threshold_ms` on first correct attempt → insight likely
- Secondary: correct answer on novel problem in boss context → confirms trick application
- Tertiary: hint rejected before solving correctly → adds confidence weight

**Eligible tricks and trick progression:**
- `get_eligible_tricks` returns an **ordered** list: struggling tricks first (recent failures or hint usage), then solid unlocked tricks, then up to 2 new tricks to introduce.
- A new (locked) trick is only introduced once all its prerequisites are already unlocked. Prerequisites are defined in the `PREREQUISITES` dict in `difficulty_engine.py` — a content-based graph, not a flat sequence.
- Struggling tricks appear first so Agent 1 naturally gives the child more practice on weak spots.
- The backend must track and write back `current_difficulty` after each problem answer. The orchestrator returns `difficulty_target` as part of its response so the backend knows what level was used.

## The 25 Tricks Taxonomy (from PRD Section 05)
Tricks are referenced by code (e.g. `A1`, `B3`, `D5`) across 4 categories:
- **Category A — Pattern Shortcuts:** A1 ×11 Digit-Sum, A2 ×9 Complement, A3 Doubling Chains, A4 Near-Square Identity, A5 Sum of First N Odds, A6 Difference of Squares, A7 ×25 and ×125
- **Category B — Invariants:** B1 Parity, B2 Perimeter Invariance, B3 Conservation of Sum, B4 Modular Arithmetic, B5 Digit Sum Divisibility, B6 Pigeonhole Principle
- **Category C — Mental Acceleration:** C1 Chunking, C2 Complement to 100, C3 Benchmark Numbers, C4 Near-Doubles, C5 ×5 via Half-of-Ten, C6 Estimation and Bounds, C7 Left-to-Right Multiplication
- **Category D — Structural Thinking:** D1 Symmetry and Half-Double, D2 State Transitions, D3 Balance/Equilibrium, D4 Geometric Series Intuition, D5 Triangular Numbers

The full descriptions for all 25 tricks are in `tricks/tricks_reference.json`. Each entry has four fields: `trick_id`, `name`, `category`, `category_name`, `description`. The `discovery_pathway` and `example` fields were intentionally omitted — the description is self-contained. Agent 1 receives only the eligible subset (not all 25) as context when generating problems.

## Project-Specific Patterns
- **Child profile is always pre-fetched by the backend** — agents never connect to the DB directly
- **Difficulty and trick selection are always computed by `difficulty_engine.py`** — never delegated to an LLM, never moved to the backend
- **All trick references use A1–D5 codes** — never use integer IDs for tricks
- **Time is always in milliseconds** — `duration_ms`, `shortcut_time_threshold_ms` — never seconds, to match the DB schema
- **Difficulty is always 1–10** — never a different scale
- **Agent outputs are always validated with Pydantic** before being used or passed between agents
- **Agent results are always converted with `json.dumps()`** before being sent back into a message
- **API keys are always read with `os.getenv()`** — never hardcoded
- **All literals** (model name, thresholds, timeouts, difficulty bounds) live in `config.py` and are imported from there — never hardcoded in agent files
- **Fallback is always available** — if both agents fail or return invalid JSON, serve a pre-made problem from `fallback_problems/`
- **Always strip markdown fences before parsing agent responses** — Claude sometimes wraps JSON in ` ```json ``` ` blocks even when the system prompt says not to. Both `agent_generator.py` and `agent_reviewer.py` strip fences with `if raw_text.startswith("```"): raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()` before calling `json.loads()`

## How to Communicate
- **Always explain what a change does and why before writing the code** — describe the diagnosis, the reasoning, and each step before editing any file
- Never skip explanations, even for small changes
- When introducing a new concept (e.g. Pydantic, prompt chaining, fallback patterns), briefly explain what it is and why we use it here

## Code Comment Standard
Every file must follow this commenting structure:
- **File header** (before import statements) — a block comment describing what the file does and its role in the system
- **Inside every function** — a structured comment block with four parts:
  - What the function does
  - Return type and shape of the return value
  - Example input
  - Example output
- **Before every variable** — an inline comment stating the Python type (e.g. `# str`, `# list[dict]`, `# dict or None`)

## Testing Rules
- **Every function must have a unit test** — no function is considered done without one
- Unit tests live in `test_agents.py`, use `pytest`, and use `unittest.mock.MagicMock` — no real API calls, no real credentials, no internet required
- Tests check **your own logic only** — not whether Anthropic's API works or whether the math answer is correct at the API level
- One test class per function, named `Test<FunctionName>` (e.g. `TestDifficultyEngine`, `TestGeneratorAgent`)
- Each test class covers: happy path, edge/boundary cases, and error/fallback cases
- The difficulty engine must have especially thorough tests — it controls a child's learning progression

## Constraints — What NOT To Do
- Do not rewrite working code from scratch — prefer targeted edits
- Do not add new libraries without explaining why they are needed
- Do not make the code clever at the expense of readability — this is a learning project
- Do not delegate difficulty or trick selection to an LLM — this always belongs in `difficulty_engine.py` as deterministic Python
- Do not move `difficulty_engine.py` to the backend — the AI pipeline owns difficulty logic so it can be tuned and tested independently
- Do not let agents connect to the DB — the backend always pre-fetches and passes the profile
- Do not hardcode model names, thresholds, or any literals outside `config.py`
- Do not skip Pydantic validation between agents — it prevents bad data from reaching children
- Do not use integer IDs for tricks — always use A1–D5 codes
- Do not use seconds for time fields — always use milliseconds to match the DB schema
- **Do not include `shortcut_path` or `brute_force_path` in any child-facing response** — these fields are internal only
- **Do not generate hints that give away the answer** — a hint that solves the problem is a skip, not a hint (PRD Anti-Principle)
- Do not expose `.env` or API keys
- Do not skip explanations — always describe what new code does and why
- **Do not store or pass `calibration_active` from the backend** — derive it internally inside `process_answer()` from `practice_problems_attempted` and `practice_problems_solved`; the backend must never know this field exists as a parameter
- **Do not check mastery during calibration** — mastery is suppressed while `calibration_active` is True; a child climbing to find their true level has not proven sustained correctness at any difficulty
- **Do not pass `scorer` from the backend** — the scorer parameter on `process_answer()` and `compute_difficulty_adjustment()` is an AI-pipeline-internal hook for swapping in an ML model without changing the backend contract

## Token Efficiency Rules
Every API call costs tokens. These rules keep costs low without sacrificing quality.

**What to send to each agent:**
- **Agent 1 (Generator)** receives: child profile (capped, see below) + `difficulty_target` + eligible tricks only (not all 25) + output schema. Never send the full 25-trick reference — filter to only the tricks relevant to this child's current eligible set.
- **Agent 2 (Reviewer)** receives: the generated problem JSON + the specific trick description for the trick used. Never re-send the full tricks reference or the child profile to Agent 2 — it doesn't need them.

**Cap the child profile history:**
- Always slice `recent_problems` to the last **5 problems maximum** before sending to Agent 1. Older history does not improve generation quality and wastes tokens.

**Set tight `max_tokens` per agent:**
- Agent 1 response is a single JSON object — set `max_tokens` to `600` in `config.py`
- Agent 2 response is a small approval JSON — set `max_tokens` to `300` in `config.py`
- Never use a high default like 4096 for structured JSON responses

**Skip Agent 2 if Pydantic validation fails:**
- If Agent 1's output fails Pydantic validation, do **not** call Agent 2. Go straight to fallback or retry Agent 1 once. There is no value in paying for a review of structurally broken output.

**Use prompt caching for the system prompts:**
- The Generator system prompt (which includes the tricks reference and output schema) is large and identical across all calls. Use Anthropic's prompt caching (`"cache_control": {"type": "ephemeral"}`) on the system prompt to avoid re-charging input tokens on repeated calls within the cache window (5 minutes).
- The Reviewer system prompt is also static — cache it the same way.
- Prompt caching is configured in `config.py` as a flag so it can be toggled off during development.

**During development, use a mock mode:**
- Add a `MOCK_API=true` flag in `.env`. When set, `agent_generator.py` and `agent_reviewer.py` return hardcoded fixture responses instead of calling the API. Use this for all testing that doesn't specifically need to validate LLM output quality — it saves real tokens and runs instantly.

**Never call the API inside a test:**
- All unit tests in `test_agents.py` mock the Anthropic client with `unittest.mock.MagicMock`. A test that makes a real API call is a bug, not a test.


## Right Now
All core modules are complete.

**Completed:**
- `tricks/tricks_reference.json` — all 25 tricks, fields: `trick_id`, `name`, `category`, `category_name`, `description`
- `schemas.py` — 7 Pydantic models: `SessionStats`, `ChildData`, `RecentProblem` (includes `difficulty: int`), `ChildProfileInput`, `Hint`, `ProblemOutput`, `ReviewerOutput`
- `config.py` — all constants: model name, token limits, retry settings, difficulty bounds, session thresholds, calibration constants (`CALIBRATION_DELTA=2`, `CALIBRATION_SLOW_DELTA=1`, `CALIBRATION_DROP=1`), bank/recommender settings, scoring weights
- `difficulty_engine.py` — 4 functions: `compute_trick_mastery`, `compute_session_adjustment`, `get_eligible_tricks` (prerequisite-gated, struggling-first ordering), `compute_difficulty_target` (volume-gated advancement); plus `TRICK_SEQUENCE` and `PREREQUISITES` constants
- `agent_generator.py` — Agent 1: builds system prompt with caching, filters eligible tricks, calls Claude, strips markdown fences from response, returns problem dict or None
- `agent_reviewer.py` — Agent 2: validates problem math, trick alignment, hints, schema, and age-appropriateness; strips markdown fences from response; returns ReviewerOutput dict or None
- `orchestrator.py` — complete: wires difficulty engine → Agent 1 → Pydantic validation → Agent 2 → return or retry; fallback to `fallback_problems/` after MAX_RETRIES; strips internal fields before returning
- `problem_recommender.py` — `recommend()` public entry point: scores candidates by phase fit / retry / unseen / difficulty delta; returns `phase_signal="reveal"` when discovery is complete; raises `needs_refill` when bank runs low
- `difficulty_adjuster.py` — `process_answer()` public entry point: derives `calibration_active` internally (no DB column needed); quality-aware calibration (confident +2, hesitant +1, wrong → -1 + end); mastery with adaptive window; trick cap enforcement; optional `scorer` hook for ML swap
- `simulate.py` — four end-to-end scenarios using fake in-memory state: discovery, mastery, cap, calibration
- `test_agents.py` — 188 unit tests covering all modules, all passing

**Immediate next tasks:**
1. Build the fallback problem bank in `fallback_problems/`
2. Connect to the real backend

## Keeping This File Up To Date
**When we add a new feature, module, or pattern — update this file.** Specifically:
- Add new modules to the Project Structure section
- Update the Right Now section to reflect current status
- Add any new constraints or conventions discovered along the way
- **Whenever a new rule or working instruction is given, add it to this file immediately** — do not wait until the end of the session

This file is the single source of truth for the MathQuest agent project. Keep it accurate and concise.