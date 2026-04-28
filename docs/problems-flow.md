# Problems flow

Scope: how problems are fetched, answered, and hinted end-to-end. Covers
the coin/insight/streak/trick-unlock logic and the AI model integration path.

Spec refs: `MathQuest_TDD_v1.1.docx` §06 (Gameplay Mechanics), §08 (Problem Catalogue).

---

## Components

```
┌──────────────────┐       ┌────────────────────┐       ┌──────────────────────────┐
│ Browser (child)  │  ───► │  FastAPI backend   │  ───► │ Supabase Postgres        │
│ game UI          │       │  /problems/*       │       │ public.problems           │
└──────────────────┘       └────────────────────┘       │ public.children          │
                                    │                   │ public.sessions           │
                                    │ (TODO)            │ public.trick_discoveries  │
                                    ├───► AI model      │ public.tricks             │
                                    │     (pending)     └──────────────────────────┘
```

All three endpoints require a child's bearer token. The role is re-read
from `public.users` on every call — never trusted from the JWT.

---

## DB tables involved

| Table | Purpose |
|---|---|
| `public.problems` | Problem catalog. `answer`, `shortcut_path`, `shortcut_time_threshold_ms` are server-only — never SELECTed in client-facing queries. |
| `public.tricks` | Static trick catalog (17 codes A1–D5). Seeded in migration 0009. |
| `public.sessions` | One row per gameplay session. `id` is a client-generated UUID. |
| `public.trick_discoveries` | Per-child insight count and unlock state per trick. Fires unlock at `insight_count = 3`. |
| `public.children` | `coins`, `streak_current`, `streak_best`, `daily_coins_earned`, `daily_coins_reset_at` are mutated on each attempt. |

---

## GET /problems — fetch a batch

**Auth:** child JWT. Query params: `zone` (required, 1–5), `difficulty` (optional override, 1–10), `exclude_ids` (optional UUID list of already-seen problems in the session).

```
Browser                       FastAPI                     Supabase
───────                       ───────                     ────────
GET /problems?zone=2&exclude_ids=<uuid1>
          │
          ├───► verify child JWT → get_current_user
          │
          │     load user_row (role='child' check)
          │     load child_row (current_difficulty, difficulty_ceiling)
          │     load parent_settings (difficulty_ceiling)
          │
          │     effective_difficulty = min(
          │         difficulty override OR child.current_difficulty,
          │         child.difficulty_ceiling,
          │         parent.difficulty_ceiling
          │     )
          │
          │     SELECT id, zone, category, difficulty, stem,
          │            answer_type, hints, flavor_text, tags    ← answer NOT selected
          │     FROM public.problems
          │     WHERE zone = ? AND difficulty <= effective_difficulty
          │
          │     filter out exclude_ids in Python
          │     shuffle → return first 5
          │
          ◄─── 200 { problems: [ ProblemResponse, ... ] }
```

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

**AI integration (TODO):** When the AI model is ready, the flow becomes:
build the AI request payload (child context + recent_problems), call model,
INSERT the returned problem into `public.problems`, return the UUID-backed
row. The seeded 40 problems serve as the dataset until then.

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
          │     SELECT answer, answer_type, shortcut_time_threshold_ms, trick_ids
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
| `trick_unlocked` | string \| null | Trick code if a trick just unlocked. |
| `daily_cap_reached` | bool | True if the 300-coin daily cap is now hit. |

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
TODO pending the `problem_attempts` table.

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
6. Future `GET /problems` AI context will include `'A1'` in `unlocked_tricks`.

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

- **AI model integration**: replace seeded-DB query with model call → INSERT → serve.
- **`problem_attempts` table**: needed for recent_problems AI context, hint-sequence enforcement (must request tier 1 before 2), and duplicate-attempt prevention. Blocked on AI engineer completing her model.
- **`POST /problems/session`**: explicit session creation endpoint.
- **`GET /parent/children`**: list child summaries including per-child trick unlock progress.
- **`current_difficulty` adaptive update**: after each attempt, the difficulty engine should update `children.current_difficulty` based on performance. Not yet implemented.

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
