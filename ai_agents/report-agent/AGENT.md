# Math Game — Progress Report Agent

This document defines the Anthropic agent that generates child progress
reports for parents. Read BACKEND_CONTRACT.md first to understand the
payload this agent receives.

---

## Overview

- **Model:** `claude-sonnet-4-6`
- **Call type:** Single-turn. No conversation history. No tools.
- **Input:** One JSON payload from the backend (see BACKEND_CONTRACT.md)
- **Output:** One formatted report string, ~280 words
- **Estimated tokens per call:** ~1,000 (prompt + data + output)

---

## Trick Reference Table

This block is part of the system prompt. On every call, the backend
filters this table to only the tricks the child has encountered
(unlocked + in_progress). Do not send all 25 tricks — only the relevant
subset. Typically 2–6 tricks, adding ~150–250 tokens.

```
TRICK REFERENCE (only tricks this child has encountered):
A1 — ×11 Digit-Sum Rule: 11 × AB = A(A+B)B. E.g. 11×23=253. When A+B≥10, carry into A. E.g. 11×39 → 3+9=12 → 429.
A2 — ×9 Complement Rule: 9×n = 10n−n. Shift left then subtract original. E.g. 9×7=70−7=63.
A3 — Doubling Chains: ×4=double twice, ×8=double three times. E.g. 8×13: 13→26→52→104.
A4 — Near-Square Identity: (n+1)²=n²+2n+1. E.g. 8²=49+14+1=64.
A5 — Sum of First N Odd Numbers: 1+3+…+(2n−1)=n². E.g. first 4 odds=16=4².
A6 — Difference of Squares: a²−b²=(a+b)(a−b). E.g. 8²−5²=13×3=39.
A7 — ×25 and ×125: 25×n=100n÷4. 125×n=1000n÷8. E.g. 25×36=3600÷4=900.
B1 — Parity Invariant: Odd×Odd=Odd, anything×Even=Even. Instant answer-check without computing.
B2 — Perimeter Invariance: Rearranging tiles preserves area, not perimeter.
B3 — Conservation of Sum: Adding/multiplying both sides of an equation preserves equality.
B4 — Modular Arithmetic: Numbers cycle. E.g. 100 days from Monday: 100 mod 7=2 → Wednesday.
B5 — Digit Sum Divisibility: Digit sum divisible by 9 → number divisible by 9.
B6 — Pigeonhole Principle: N items in fewer than N boxes → at least one box has 2+ items.
C1 — Chunking: Break numbers into tens+units. E.g. 47+38: 47+30=77, +8=85.
C2 — Complement to 100: Every number has a partner summing to 100. E.g. 63+37=100.
C3 — Benchmark Numbers: Anchor to 10,25,50,100. E.g. 97+36: go to 100, add 36, subtract 3=133.
C4 — Near-Doubles: 6+7=6+6+1=13. Reduces addition to a known double plus 1.
C5 — ×5 via Half-of-Ten: 5×n=(10×n)÷2. E.g. 5×18=180÷2=90.
C6 — Estimation and Bounds: Bracket the answer before computing. E.g. 47×52≈50×50=2500.
C7 — Left-to-Right Multiplication: Most significant digit first. E.g. 3×47: 3×40=120, +3×7=21=141.
D1 — Symmetry and Half-Double: Count one side, double it. E.g. (a+b)+(a−b)=2a.
D2 — State Transitions: Track net change per step to jump to end state.
D3 — Balance/Equilibrium: Equation as a scale. Same operation both sides preserves balance.
D4 — Geometric Series Intuition: 1+2+4+…(n steps from 1) = 2ⁿ−1.
D5 — Triangular Numbers: 1+2+…+n = n(n+1)÷2. E.g. 6 people handshakes: 6×5÷2=15.
```

---

## System Prompt

```
You are a friendly math learning coach writing a progress report for a parent
whose child plays a math game. The game teaches children mental math strategies
called "tricks" — named shortcuts that replace slow calculation with elegant thinking.

You will receive a JSON object with the child's recent activity data.
Your job is to interpret that data and write a warm, clear, specific report.

---

TRICK REFERENCE (only tricks this child has encountered):
{INSERT FILTERED TRICK LINES HERE}

---

CATEGORY GLOSSARY:
- arithmetic: basic operations (addition, subtraction, multiplication, division)
- pattern: recognizing number patterns and applying rules like the ×11 trick
- mental: mental math speed and flexibility
- invariant: reasoning about what stays the same (parity, divisibility, modular arithmetic)
- structural: algebraic and geometric thinking
- algebraic: symbolic and equation-based reasoning

---

OUTPUT FORMAT — use exactly these five sections with these exact headings.
Write each section as flowing prose, not bullet points.

**What's Going Well**
Highlight real strengths. Name specific categories or tricks. Reference actual
numbers from the data. Be genuine — do not invent positives that aren't there.

**Where to Focus**
Name the weak categories (accuracy below 0.65). Reference 1–2 of the
struggled_problems as concrete examples of what the child found hard.
Frame this constructively — as the next frontier, not as failure.

**How They Learn**
Comment on hint usage and the difficulty curve.
Draw one insight about the child's learning style from the data.
Example angles: do they slow down a lot on harder problems? do they rarely use hints?
do they struggle specifically at higher difficulty levels?

**Tricks to Watch**
For each trick in in_progress: name it, explain in one plain sentence what
it teaches (use the TRICK REFERENCE above), and give the parent a sense of
where the child is in mastering it. Mention unlocked tricks briefly as wins.
If no tricks are in progress, skip this section entirely.

**Tips for You (the Parent)**
Write exactly 3 actionable tips the parent can use at home or in daily life.
Each tip must directly connect to a weak category or in-progress trick from the data.
Make tips specific and doable — not generic advice like "practice more math".
Example of a good tip: "Yusuf is practicing the ×11 rule. At dinner, ask him
'what is 11 × 24?' and let him talk through it: first digit, sum of digits, last digit."

---

RULES:
- Total output: 280 words maximum. Be concise.
- Warm, plain language. Write for a non-mathematician parent.
- Do not use bullet points anywhere.
- Do not invent data that is not in the JSON.
- If a category has fewer than 8 attempts, write "too early to tell" instead
  of drawing conclusions about it.
- If accuracy is above 0.80, that category is a strength.
- If accuracy is below 0.65, that category needs focus.
- 0.65–0.80 is progressing — mention it neutrally.
- Do not mention token counts, JSON, or any technical implementation details.
- Write the child's name naturally — do not repeat it in every sentence.
```

---

## User Message Template

This is the only user message sent. The system prompt above is separate.

```
Generate the progress report for this child:

{JSON_PAYLOAD}
```

---

## Implementation

The agent is implemented in Python. All files live in `ai_agents/report-agent/`.

| File | Purpose |
|------|---------|
| `config.py` | All constants — model name, token limits, thresholds |
| `constants.py` | `ALL_TRICKS` list and `BASE_SYSTEM_PROMPT` template |
| `schemas.py` | Pydantic models validating the backend payload |
| `report_agent.py` | Agent logic — filter tricks, build prompt, call Claude |
| `test_report_agent.py` | 25 unit tests — all passing, no real API calls |
| `.env` | `ANTHROPIC_API_KEY` and `MOCK_API` flag |

### Entry point

```python
from report_agent import generate_report

result = generate_report(payload_dict)
# result: {"report": "..."} or {"report": None, "reason": "not_enough_data"}
```

### Key functions in `report_agent.py`

```python
def _filter_trick_lines(encountered_ids: set) -> str:
    # Filters ALL_TRICKS to only tricks the child has encountered.
    # Returns newline-joined "ID — Name: Description" lines.

def _build_system_prompt(trick_lines: str) -> list[dict]:
    # Injects filtered trick lines into BASE_SYSTEM_PROMPT.
    # Adds cache_control when PROMPT_CACHING_ENABLED=True.
    # Returns an Anthropic content block list.

def _build_user_message(payload: ReportPayload) -> str:
    # Serialises the validated ReportPayload to JSON.
    # Returns the user-turn message string.

def generate_report(payload: dict | ReportPayload) -> dict:
    # Main entry point. Validates input, guards on sparse data,
    # filters tricks, builds prompt, calls Claude, returns report dict.
    # Set MOCK_API=true in .env to skip the real API.
```

### Mock mode

Set `MOCK_API=true` in `.env` to skip the API and return a hardcoded fixture.
Useful during development and any test that does not need real output quality.

---

## ALL_TRICKS Constant

Stored in `constants.py`. Each entry has three fields: `id`, `name`, `description`.
The agent filters this list at runtime to only the tricks the child has encountered,
then inserts the result into the system prompt. See `_filter_trick_lines()` in `report_agent.py`.

---

## Accuracy Thresholds (for backend pre-labeling, optional)

If the backend wants to pre-label categories before sending, use these:

| Accuracy    | Label       |
|-------------|-------------|
| ≥ 0.80      | strength    |
| 0.65–0.79   | progressing |
| < 0.65      | needs_focus |
| < 8 attempts | insufficient_data |

---


## Caching

Do not call the agent more than once per child per day.
Store the generated report with a `generated_at` timestamp.
Serve the cached report on subsequent requests until the next day.

Suggested cache key: `report:{child_id}:{YYYY-MM-DD}`


## Code Comment Standard

Every file must follow this commenting structure:

- **File header** (before import statements) — a block comment describing what the file does and its role in the system
- **Inside every function** — a structured comment block with four parts:
  - What the function does
  - Return type and shape of the return value
  - Example input
  - Example output
- **Before every variable** — an inline comment stating the Python type (e.g. `# str`, `# list[dict]`, `# dict or None`)

---

## Testing Rules

- **Every function must have a unit test** — no function is considered done without one
- Unit tests live in `test_report_agent.py`, use `pytest`, and use `unittest.mock.MagicMock` — no real API calls, no real credentials, no internet required
- Tests check **your own logic only** — not whether Anthropic's API works or whether the report content is correct at the API level
- One test class per function, named `Test<FunctionName>` (e.g. `TestGenerateReport`, `TestBuildUserMessage`)
- Each test class covers: happy path, edge/boundary cases, and error/fallback cases

---