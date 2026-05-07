# Problems flow

Scope: how problems are fetched, answered, and hinted end-to-end. Covers
the coin/insight/streak/trick-unlock logic and the AI recommender/adjuster
integration.

Spec refs: `MathQuest_TDD_v1.1.docx` §06 (Gameplay Mechanics), §08 (Problem Catalogue).

---

## Components

```
┌──────────────────┐       ┌────────────────────┐       ┌──────────────────────────┐
│ Browser (child)  │  ───► │  FastAPI backend   │  ───► │ Supabase Postgres        │
│ game UI          │       │  /problems/*       │       │ public.problems           │
└──────────────────┘       └────────────────────┘       │ public.children          │
                                    │                   │ public.sessions           │
                                    │ direct import     │ public.trick_discoveries  │
                                    ├───► problem_       │ public.tricks             │
                                    │     recommender   │ public.problem_attempts   │
                                    └───► difficulty_   └──────────────────────────┘
                                          adjuster
```

All three endpoints require a child's bearer token. The role is re-read
from `public.users` on every call — never trusted from the JWT.

The AI pipeline modules (`problem_recommender.py`, `difficulty_adjuster.py`)
live in `ai_agents/mathquest-questions-agent/` and are imported directly via
`sys.path`. There is no HTTP boundary. The `_AI_AVAILABLE` flag is set at
module load; if the import fails, `GET /problems` returns an empty list —
there is no zone-based fallback.

---

## DB tables involved

| Table | Purpose |
|---|---|
| `public.problems` | Problem catalog. Added columns: `grade` (int), `phase_tag` (text), `trick_id` (text FK → tricks). `answer`, `shortcut_path`, `shortcut_time_threshold_ms` are server-only — never SELECTed in client-facing queries. |
| `public.tricks` | Static trick catalog (25 codes A1–D5). 17 seeded in migration 0009, 8 added in 0018. |
| `public.sessions` | One row per gameplay session. `id` is a client-generated UUID. |
| `public.trick_discoveries` | Per-child insight count and unlock state per trick. Added columns: `current_phase`, `discovery_problems_seen`, `practice_problems_solved`, `practice_problems_attempted`. |
| `public.children` | `coins`, `streak_current`, `streak_best`, `daily_coins_earned`, `daily_coins_reset_at`, `current_difficulty`, `current_trick` are mutated on each attempt. |
| `public.problem_attempts` | Per-child per-problem attempt history. UNIQUE(child_id, problem_id) — upserted on re-attempt. |

---

## GET /problems — fetch a problem

**Auth:** child JWT.

```
Browser                       FastAPI                     Supabase
───────                       ───────                     ────────
GET /problems
          │
          ├───► verify child JWT → get_current_user
          │     (returns 200 { problems: [] } if _AI_AVAILABLE = False)
          │
          │     load user_row (role='child' check)
          │     load child_row (current_difficulty, difficulty_ceiling,
          │                     current_trick, grade, date_of_birth)
          │     load parent_settings (difficulty_ceiling)
          │
          │     effective_difficulty = min(
          │         child.current_difficulty,
          │         child.difficulty_ceiling,
          │         parent.difficulty_ceiling
          │     )
          │
          │     ── Trick assignment ──────────────────────────────────
          │     if child.current_trick IS NULL:
          │         get_eligible_tricks(child_ctx) → first eligible trick
          │         ensure trick_discoveries row exists (INSERT if missing)
          │         UPDATE children SET current_trick = <trick_id>
          │
          │     ── Phase context ─────────────────────────────────────
          │     fetch trick_discoveries row for (child_id, current_trick)
          │     current_phase = row.current_phase  (default: 'discovery')
          │     disc_seen     = row.discovery_problems_seen
          │
          │     ── Candidate selection ───────────────────────────────
          │     fetch all problem_attempts (problem_id, solved_correctly,
          │                                 previously_failed) for child
          │     build solved_ids set (solved_correctly = true)
          │
          │     SELECT id, trick_id, difficulty, grade, phase_tag
          │     FROM public.problems
          │     WHERE trick_id = current_trick
          │       AND difficulty <= effective_difficulty   ← no grade filter
          │
          │     filter solved_ids in Python → candidates
          │     mark previously_failed on each candidate
          │
          │     ── Bank-empty: inline generation ─────────────────────
          │     if candidates is empty:
          │         await _refill_problem_bank(
          │             child_row, {trick_id, difficulty, grade},
          │             skip_if_count_gte=1   ← guard against concurrent calls
          │         )
          │         → runs AI pipeline synchronously (~20s, cold slot only)
          │         → INSERT new problem, return its safe fields
          │         if generated: increment disc_seen, return problem
          │         else: return { problems: [] }
          │
          │     ── Recommender call ──────────────────────────────────
          │     recommend(child_ctx, candidates) →
          │         { problem_id, needs_refill, refill_context, phase_signal }
          │
          │     if phase_signal == "reveal":
          │         UPDATE trick_discoveries SET current_phase = 'practice'
          │         return { problems: [], phase_signal: "reveal" }
          │                                   ↑ triggers reveal animation
          │
          │     ── Post-selection updates ────────────────────────────
          │     if current_phase == 'discovery':
          │         UPDATE trick_discoveries
          │         SET discovery_problems_seen = discovery_problems_seen + 1
          │
          │     if exact-difficulty slot is thin (no unseen at effective):
          │         background_tasks.add_task(
          │             _refill_problem_bank, child_row, refill_context,
          │             skip_if_count_gte=2   ← prevents duplicate bg inserts
          │         )
          │
          │     fetch full problem row → strip server-only fields
          │
          ◄─── 200 { problems: [ProblemResponse], phase_signal: null }
```

### `_refill_problem_bank` — generate and insert a problem

Used two ways:

| Call site | Mode | `skip_if_count_gte` | Effect |
|---|---|---|---|
| Bank empty (inline) | `await` — blocks request | `1` — skip if ≥1 already exists | Child gets the new problem in same request |
| Bank low (background) | `background_tasks.add_task` | `2` — skip if ≥2 exist | Response already sent; fills slot asynchronously |

```
_refill_problem_bank(child_row, refill_context, *, skip_if_count_gte)
    │
    ├── if skip_if_count_gte > 0:
    │       count existing problems for (trick_id, difficulty)
    │       if count >= skip_if_count_gte → return None (skip)
    │
    ├── derive age from child.date_of_birth (if set)
    │   else estimate: grade + 5
    │
    ├── import orchestrator.run_pipeline (lazy)
    ├── build ChildProfileInput (grade, difficulty, unlocked_tricks, ...)
    ├── run_pipeline(profile) → problem_dict
    │
    ├── INSERT INTO public.problems
    │       (zone, category, difficulty, trick_id, trick_ids,
    │        stem, answer, answer_type, shortcut_time_threshold_ms,
    │        hints, aha_moment, flavor_text, tags, grade, phase_tag)
    │   VALUES (...)
    │   -- AI string ID ("p_001") ignored; DB generates UUID
    │   -- difficulty forced to refill_context["difficulty"] (AI pipeline
    │      may compute a different target; we override to fill the right slot)
    │
    └── returns dict with safe response fields (id, zone, category,
        difficulty, stem, answer_type, hints, flavor_text, tags)
        or None on failure / skip
```

If the pipeline raises (network error, bad API key, etc.), the exception is
logged and None is returned. The inline path falls back to an empty response;
the background path is a no-op.

**ProblemResponse fields** (answer and shortcut fields never included):

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Stable — used in attempt/hint requests. |
| `zone` | int | 1–5 |
| `category` | string | arithmetic \| pattern \| invariant \| mental \| structural \| algebraic |
| `difficulty` | int | 1–10 |
| `stem` | string | Problem statement. |
| `answer_type` | string | exact \| range \| set |
| `hints` | `[{level, text, cost}]` | All 3 tiers always returned. |
| `flavor_text` | string | Narrative context. |
| `tags` | string[] | Topic tags. |

**ProblemsListResponse fields:**

| Field | Type | Notes |
|---|---|---|
| `problems` | `ProblemResponse[]` | Empty list when `phase_signal == "reveal"`. |
| `phase_signal` | string \| null | `"reveal"` when the child completes the discovery phase; otherwise null. |

---

## POST /problems/attempt — submit an answer

**Auth:** child JWT. Body: `{ problem_id, answer, duration_ms, hint_level_used, session_id }`.

```
Browser                       FastAPI                     Supabase
submit { problem_id, answer,
         duration_ms,
         hint_level_used: 0,
         session_id }
          │
          ├───► verify child JWT
          │     load child context (role check)
          │     _ensure_session(session_id, child.id)
          │         → if session missing: INSERT (implicit creation, TODO: dedicated endpoint)
          │         → if session found: verify child_id matches + is_active = true
          │
          │     SELECT answer, answer_type, shortcut_time_threshold_ms,
          │            trick_ids, trick_id, difficulty
          │     FROM public.problems WHERE id = problem_id
          │
          │     correct = _check_answer(answer_type, stored, submitted)
          │         exact → float comparison (math.isclose)
          │         set   → case-insensitive string match ('odd', 'yes', 'no', etc.)
          │         range → stored as "low,high"; check low ≤ val ≤ high
          │
          │     insight_detected = (
          │         correct
          │         AND hint_level_used == 0
          │         AND duration_ms < shortcut_time_threshold_ms
          │     )
          │
          │     ── Daily reset check ────────────────────────────────
          │     if now() - daily_coins_reset_at >= 24h:
          │         reset daily_coins_earned to 0
          │         update daily_coins_reset_at
          │
          │     ── Coin calculation ──────────────────────────────────
          │     base_coins = 10
          │     raw_coins:
          │         insight:          30 (3×)
          │         no hints, slow:   10 (1×)
          │         hint level 1:      7 (0.7×)
          │         hint level 2:      5 (0.5×)
          │         hint level 3:      3 (0.3×, no insight even if fast)
          │         incorrect:         0
          │     coins_awarded = min(raw_coins, 300 - daily_coins_earned)
          │     daily_cap_reached = daily_coins_earned + coins_awarded >= 300
          │
          │     ── Streak update ─────────────────────────────────────
          │     correct:   streak_current += 1; streak_best = max(streak_current, streak_best)
          │     incorrect: streak_current = 0
          │
          │     UPDATE public.children SET coins, daily_coins_earned,
          │                                streak_current, streak_best, [daily_coins_reset_at]
          │     SELECT coins, streak_current  (re-fetch; don't trust UPDATE .data)
          │
          │     ── Trick insight (if insight_detected) ──────────────
          │     for each trick_id in problem.trick_ids:
          │         UPSERT trick_discoveries (child_id, trick_id)
          │         increment insight_count
          │         if insight_count == 3 → set unlocked=true, unlocked_at=now
          │         → return first newly-unlocked trick_id as trick_unlocked
          │
          │     ── AI adjuster block (if _AI_AVAILABLE and trick_id set) ──
          │     _upsert_problem_attempt(child_id, problem_id, correct,
          │                             hints_used, duration_ms, difficulty)
          │         → SELECT existing row → INSERT or UPDATE
          │         → previously_failed is sticky: once true, never reset
          │
          │     fetch phase_row from trick_discoveries
          │     if current_phase == 'practice':
          │         UPDATE trick_discoveries SET
          │             practice_problems_attempted += 1
          │             [practice_problems_solved += 1 if correct]
          │
          │     recent_performance = last 10 problem_attempts for this child
          │         at current_difficulty (uses denormalized difficulty column)
          │
          │     unlocked_tricks = trick codes where unlocked = true
          │
          │     process_answer(answer_result, current_difficulty,
          │                    difficulty_ceiling, current_phase,
          │                    phase_counters, recent_performance,
          │                    current_trick, unlocked_tricks)
          │         → { new_difficulty_target, phase_update, trick_update }
          │
          │     _apply_adjuster_results(child_id, current_trick, result):
          │         UPDATE children SET current_difficulty = new_difficulty_target
          │         if phase_update:
          │             UPDATE trick_discoveries SET current_phase = phase_update
          │         if trick_update:
          │             INSERT trick_discoveries (child_id, new_trick, current_phase='discovery')
          │             UPDATE children SET current_trick = new_trick
          │
          ◄─── 200 AttemptResponse
```

**AttemptResponse fields:**

| Field | Type | Notes |
|---|---|---|
| `correct` | bool | Whether the answer was right. |
| `coins_awarded` | int | 0 if incorrect or daily cap hit. |
| `insight_detected` | bool | True if fast + correct + no hints. |
| `new_balance` | int | Child's coin balance after award. |
| `streak_count` | int | Current streak after this attempt. |
| `trick_unlocked` | string \| null | Trick code if a trick just unlocked (insight mechanic). |
| `daily_cap_reached` | bool | True if the 300-coin daily cap is now hit. |
| `new_difficulty` | int \| null | New `current_difficulty` set by adjuster. Null if adjuster was not invoked. |
| `phase_update` | string \| null | `"practice"` or `"discovery"` if the phase changed. Null otherwise. |
| `trick_advance` | string \| null | Next trick code (A1–D5) if the child advanced to a new trick. Null otherwise. |

---

## POST /problems/hint — request the next hint tier

**Auth:** child JWT. Body: `{ problem_id, hint_level (1/2/3), session_id }`.

```
Browser                       FastAPI                     Supabase
submit { problem_id,
         hint_level: 2,
         session_id }
          │
          ├───► verify child JWT
          │     load child context
          │     _ensure_session(session_id, child.id)
          │
          │     SELECT hints FROM public.problems WHERE id = problem_id
          │     find hint where level = hint_level
          │
          │     cost = { 1: 0, 2: 5, 3: 15 }[hint_level]
          │
          │     if cost > 0 and child.coins < cost:
          │         raise InsufficientCoins (422)
          │
          │     UPDATE public.children SET coins = coins - cost
          │     SELECT coins  (re-fetch)
          │
          ◄─── 200 { hint_text, cost_paid, new_balance }
```

Hint costs are deducted at request time. The `coins_awarded` on a
subsequent attempt is reduced by the appropriate multiplier (0.7×/0.5×/0.3×),
so the net economic impact is: hint cost deducted now + lower reward on solve.

**Hint sequence enforcement** (must request tier 1 before 2, etc.) is a
TODO — the `problem_attempts` table now exists, but the route does not yet
enforce ordering.

---

## Insight scoring table (TDD §06)

| Condition | Coins | insight_detected |
|---|---|---|
| Correct, no hints, fast (< threshold) | 30 (3×) | true |
| Correct, no hints, normal speed | 10 (1×) | false |
| Correct after hint level 1 (free) | 7 (0.7×) | false |
| Correct after hint level 2 (−5 coins) | 5 (0.5×) | false |
| Correct after hint level 3 (−15 coins) | 3 (0.3×) | false |
| Incorrect | 0 | false |
| insight_detected = true × 3 for same trick | trick_unlocked fired | — |

---

## Trick unlock lifecycle

1. Problem has `trick_ids = ['A1']`.
2. Child solves correctly, fast, no hints → `insight_detected = true`.
3. `trick_discoveries` row for `(child_id, 'A1')` upserted; `insight_count` incremented.
4. When `insight_count` reaches 3: `unlocked = true`, `unlocked_at = now()`.
5. `AttemptResponse.trick_unlocked = 'A1'` returned to trigger the journal animation.
6. Future `GET /problems` context will include `'A1'` in `unlocked_tricks` passed to the adjuster.

---

## Pedagogical phase lifecycle

```
[child assigned to trick T]
        │
        │  current_phase = 'discovery'
        ▼
[GET /problems] → discovery problem served
        │
        │  discovery_problems_seen incremented each call
        ▼
        │  recommend() returns phase_signal = "reveal"
        │  (fired when child has seen enough discovery problems)
        │
        ├── backend auto-advances: current_phase → 'practice'
        │
        ◄── 200 { problems: [], phase_signal: "reveal" }
                 Frontend shows trick-reveal animation
        │
        │  current_phase = 'practice'
        ▼
[GET /problems] → practice problem served
[POST /problems/attempt] → practice counters updated
        │
        │  process_answer() evaluates mastery:
        │  ≥ 80% correct over last 10 attempts AND ≥ 5 solved
        │
        ├── if mastery reached: trick_update → advance to next trick
        │       INSERT new trick_discoveries row
        │       UPDATE children SET current_trick = next_trick
        │       current_phase resets to 'discovery' for new trick
        │
        └── if not yet mastered: continue practice
```

---

## Session lifecycle

```
[Client generates UUID]
        │
        ├──► POST /problems/attempt  (first call with this session_id)
        │        → _ensure_session: INSERT INTO public.sessions
        │
        ├──► POST /problems/attempt  (subsequent calls)
        │        → _ensure_session: SELECT, verify child_id, verify is_active
        │
        └──► POST /problems/session/end  (TODO)
                 → UPDATE sessions SET is_active=false, ended_at=now()
```

The explicit `POST /problems/session` creation endpoint is TODO. Until it
is built, the first attempt with a new `session_id` creates the row
implicitly. This is backward compatible: when the session endpoint lands,
it will pre-create the row, and `_ensure_session` will find it and just validate.

---

## Open items (backend)

- **`POST /problems/session`**: explicit session creation endpoint.
- **`GET /parent/children`**: list child summaries including per-child trick unlock progress.
- **Hint sequence enforcement**: `POST /problems/hint` should reject level 2 before level 1 has been requested; `problem_attempts` table now exists but the route doesn't yet check.
- **Phase reveal acknowledgment**: currently the backend auto-advances to practice when `phase_signal="reveal"` is returned. A future product decision may require an explicit acknowledge call before advancing.
- **Zone advancement**: `current_zone` advancement on trick mastery is tracked by a separate `zone_advancement` flow (see AGENTS.md).

---

## Error codes

| HTTP | Code | When |
|---|---|---|
| 403 | `forbidden_role` | Non-child caller hits a problems endpoint. |
| 403 | `session_invalid` | Session belongs to a different child or is inactive. |
| 404 | `problem_not_found` | `problem_id` not in `public.problems`. |
| 404 | `hint_not_found` | Requested hint level not present on this problem. |
| 422 | `insufficient_coins` | Hint level 2/3 requested with too few coins. |

Shape (TDD §10.1): `{ "error": "...", "code": "...", "status": 4xx }`.
