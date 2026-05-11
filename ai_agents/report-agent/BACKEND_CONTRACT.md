# Backend Contract — Child Progress Report Agent

This document defines exactly what the backend must supply to the agent endpoint.
The backend is responsible for all SQL queries and data aggregation.
The agent receives one JSON payload and returns one report string.

---

## Endpoint

```
POST /api/reports/generate
```

---

## Request Payload Shape

```ts
interface ReportPayload {
  child:              ChildInfo;
  period_days:        number;
  overall:            OverallStats;
  by_category:        CategoryStat[];
  difficulty_curve:   DifficultyStat[];
  tricks:             TrickSummary;
  struggled_problems: StruggledProblem[];
  trend:              "improving" | "stable" | "declining";
}
```

---

## Field Definitions

### `child` — ChildInfo

```ts
interface ChildInfo {
  name:                string;   // display_name from users table
  age:                 number;   // derived from children.date_of_birth
  grade:               number;   // children.grade
  zone:                number;   // children.current_zone (1–5)
  current_difficulty:  number;   // children.current_difficulty (1–10)
  difficulty_ceiling:  number;   // children.difficulty_ceiling (1–10)
  streak_current:      number;   // children.streak_current
  streak_best:         number;   // children.streak_best
}
```

---

### `period_days` — number

How many days back the report covers. Typically `30`. The backend filters
all queries using `answered_at > NOW() - INTERVAL '{period_days} days'`.

---

### `overall` — OverallStats

```ts
interface OverallStats {
  attempts:              number;  // total problem_attempts rows in period
  accuracy:              number;  // 0.00–1.00, two decimal places
  avg_seconds:           number;  // average duration_ms / 1000, rounded
  avg_hints_per_problem: number;  // average hints_used, one decimal place
}
```

SQL hint:
```sql
SELECT
  COUNT(*)                                              AS attempts,
  ROUND(AVG(CASE WHEN solved_correctly THEN 1.0 ELSE 0.0 END), 2) AS accuracy,
  ROUND(AVG(duration_ms) / 1000)                        AS avg_seconds,
  ROUND(AVG(hints_used), 1)                             AS avg_hints_per_problem
FROM problem_attempts
WHERE child_id = $1
  AND answered_at > NOW() - INTERVAL '30 days';
```

---

### `by_category` — CategoryStat[]

One entry per category that has at least 1 attempt. Categories in the
`problems` table are: `arithmetic`, `pattern`, `invariant`, `mental`,
`structural`, `algebraic`.

```ts
interface CategoryStat {
  category:    string;  // matches problems.category exactly
  attempts:    number;
  accuracy:    number;  // 0.00–1.00
  avg_seconds: number;  // rounded
}
```

SQL hint:
```sql
SELECT
  p.category,
  COUNT(*)                                                        AS attempts,
  ROUND(AVG(CASE WHEN pa.solved_correctly THEN 1.0 ELSE 0.0 END), 2) AS accuracy,
  ROUND(AVG(pa.duration_ms) / 1000)                               AS avg_seconds
FROM problem_attempts pa
JOIN problems p ON p.id = pa.problem_id
WHERE pa.child_id = $1
  AND pa.answered_at > NOW() - INTERVAL '30 days'
GROUP BY p.category;
```

---

### `difficulty_curve` — DifficultyStat[]

Only include difficulty levels the child has actually attempted.

```ts
interface DifficultyStat {
  level:    number;  // 1–10
  attempts: number;
  accuracy: number;  // 0.00–1.00
}
```

SQL hint:
```sql
SELECT
  pa.difficulty                                                        AS level,
  COUNT(*)                                                             AS attempts,
  ROUND(AVG(CASE WHEN pa.solved_correctly THEN 1.0 ELSE 0.0 END), 2)  AS accuracy
FROM problem_attempts pa
WHERE pa.child_id = $1
  AND pa.answered_at > NOW() - INTERVAL '30 days'
  AND pa.difficulty IS NOT NULL
GROUP BY pa.difficulty
ORDER BY pa.difficulty;
```

---

### `tricks` — TrickSummary

```ts
interface TrickInProgress {
  id:       string;  // tricks.id e.g. "A1", "C3"
  name:     string;  // tricks.name
  phase:    "discovery" | "practice";
  accuracy: number | null;  // practice accuracy, null if still in discovery
}

interface TrickSummary {
  unlocked:         string[];          // trick IDs only e.g. ["A1", "C5"]
  in_progress:      TrickInProgress[];
  not_yet_started:  number;            // count of tricks with no trick_discovery row
}
```

**Unlocked:** `trick_discoveries.unlocked = true`
**In progress:** `trick_discoveries.unlocked = false` and `first_seen_at IS NOT NULL`
**Not yet started:** total tricks count minus any row in `trick_discoveries` for this child

SQL hint for in_progress accuracy:
```sql
SELECT
  td.trick_id                                                                   AS id,
  t.name,
  td.current_phase                                                               AS phase,
  CASE
    WHEN td.practice_problems_attempted > 0
    THEN ROUND(td.practice_problems_solved::numeric / td.practice_problems_attempted, 2)
    ELSE NULL
  END AS accuracy
FROM trick_discoveries td
JOIN tricks t ON t.id = td.trick_id
WHERE td.child_id = $1
  AND td.unlocked = false;
```

---

### `struggled_problems` — StruggledProblem[]

Up to **9 problems maximum**. Prioritize: `previously_failed = true` first,
then longest `duration_ms`. Only include problems from the current period
where `solved_correctly = false`.

```ts
interface StruggledProblem {
  stem:         string;   // problems.stem — the actual question text
  category:     string;   // problems.category
  difficulty:   number;   // problem_attempts.difficulty
  hints_used:   number;   // problem_attempts.hints_used
  failed_twice: boolean;  // problem_attempts.previously_failed
}
```

SQL hint:
```sql
SELECT
  p.stem,
  p.category,
  pa.difficulty,
  pa.hints_used,
  pa.previously_failed AS failed_twice
FROM problem_attempts pa
JOIN problems p ON p.id = pa.problem_id
WHERE pa.child_id = $1
  AND pa.solved_correctly = false
  AND pa.answered_at > NOW() - INTERVAL '30 days'
ORDER BY pa.previously_failed DESC, pa.duration_ms DESC
LIMIT 9;
```

---

### `trend` — "improving" | "stable" | "declining"

Compare accuracy in the first half of the period vs the second half.

```
improving  → second half accuracy > first half accuracy by more than 0.05
declining  → second half accuracy < first half accuracy by more than 0.05
stable     → difference ≤ 0.05 in either direction
```

SQL hint (run twice with different date ranges):
```sql
SELECT
  ROUND(
    AVG(CASE WHEN solved_correctly THEN 1.0 ELSE 0.0 END),
    2
  ) AS accuracy
FROM problem_attempts
WHERE child_id = $1
  AND answered_at BETWEEN $half_start AND $half_end;
```

---

## Full Example Payload

```json
{
  "child": {
    "name": "Yusuf",
    "age": 9,
    "grade": 3,
    "zone": 2,
    "current_difficulty": 4,
    "difficulty_ceiling": 7,
    "streak_current": 5,
    "streak_best": 9
  },
  "period_days": 30,
  "overall": {
    "attempts": 87,
    "accuracy": 0.68,
    "avg_seconds": 24,
    "avg_hints_per_problem": 0.4
  },
  "by_category": [
    { "category": "arithmetic", "attempts": 40, "accuracy": 0.85, "avg_seconds": 12 },
    { "category": "pattern",    "attempts": 22, "accuracy": 0.41, "avg_seconds": 34 },
    { "category": "mental",     "attempts": 15, "accuracy": 0.47, "avg_seconds": 38 },
    { "category": "invariant",  "attempts": 10, "accuracy": 0.30, "avg_seconds": 51 }
  ],
  "difficulty_curve": [
    { "level": 1, "attempts": 18, "accuracy": 0.95 },
    { "level": 2, "attempts": 25, "accuracy": 0.88 },
    { "level": 3, "attempts": 30, "accuracy": 0.74 },
    { "level": 4, "attempts": 14, "accuracy": 0.51 }
  ],
  "tricks": {
    "unlocked": ["A3", "C5"],
    "in_progress": [
      { "id": "A1", "name": "×11 Digit-Sum Rule", "phase": "practice", "accuracy": 0.44 }
    ],
    "not_yet_started": 22
  },
  "struggled_problems": [
    { "stem": "What is 11 × 47?",                       "category": "pattern",   "difficulty": 4, "hints_used": 2, "failed_twice": true  },
    { "stem": "What is 11 × 39?",                       "category": "pattern",   "difficulty": 4, "hints_used": 1, "failed_twice": true  },
    { "stem": "Use the ×9 complement rule: 9 × 8",      "category": "mental",    "difficulty": 3, "hints_used": 1, "failed_twice": false },
    { "stem": "Is 4518 divisible by 9?",                "category": "invariant", "difficulty": 3, "hints_used": 2, "failed_twice": false }
  ],
  "trend": "improving"
}
```

---

## Agent Response

The agent returns a JSON object. The backend passes `report` through as-is to the frontend.

```ts
interface ReportResponse {
  report: string | null;
  reason?: "api_error";  // only present when report is null
}
```

| `report` | `reason` | Meaning |
|----------|----------|---------|
| `string` | absent | Success — render the report |
| `null` | `"api_error"` | Claude API call failed; retry once, then show a fallback message |

**Handling `api_error`:** The backend should retry the request once after a short
delay. If it fails again, surface a friendly message to the parent:
*"Your child's report is being prepared. Check back shortly."*
Do not surface raw error details.
