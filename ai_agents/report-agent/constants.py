# constants.py
# Shared constants for the MathQuest report agent.
# ALL_TRICKS is the authoritative list of all 25 tricks in the game.
# BASE_SYSTEM_PROMPT is the static system prompt template; the agent
# filters ALL_TRICKS at runtime and inserts only the tricks the child
# has encountered before sending the prompt to Claude.

# ---------------------------------------------------------------------------
# Tricks reference
# Each entry has three fields: id, name, description.
# The agent filters this list to only the tricks a child has encountered
# (unlocked + in_progress) before inserting them into the system prompt.
# Keeping the full list here and filtering per-call avoids maintaining
# separate files and keeps the reference in one authoritative place.
# ---------------------------------------------------------------------------

# list[dict] — all 25 tricks across categories A–D, keyed by id for filtering
ALL_TRICKS = [
    {"id": "A1", "name": "×11 Digit-Sum Rule",           "description": "11 × AB = A(A+B)B. E.g. 11×23=253. When A+B≥10, carry into A. E.g. 11×39→429."},
    {"id": "A2", "name": "×9 Complement Rule",            "description": "9×n = 10n−n. Shift left then subtract original. E.g. 9×7=70−7=63."},
    {"id": "A3", "name": "Doubling Chains",               "description": "×4=double twice, ×8=double three times. E.g. 8×13: 13→26→52→104."},
    {"id": "A4", "name": "Near-Square Identity",          "description": "(n+1)²=n²+2n+1. E.g. 8²=49+14+1=64."},
    {"id": "A5", "name": "Sum of First N Odd Numbers",    "description": "1+3+…+(2n−1)=n². E.g. first 4 odds=16=4²."},
    {"id": "A6", "name": "Difference of Squares",         "description": "a²−b²=(a+b)(a−b). E.g. 8²−5²=13×3=39."},
    {"id": "A7", "name": "×25 and ×125",                  "description": "25×n=100n÷4. 125×n=1000n÷8. E.g. 25×36=900."},
    {"id": "B1", "name": "Parity Invariant",              "description": "Odd×Odd=Odd, anything×Even=Even. Instant answer-check without computing."},
    {"id": "B2", "name": "Perimeter Invariance",          "description": "Rearranging tiles preserves area, not perimeter."},
    {"id": "B3", "name": "Conservation of Sum",           "description": "Same operation both sides of an equation preserves equality."},
    {"id": "B4", "name": "Modular Arithmetic",            "description": "Numbers cycle. E.g. 100 days from Monday: 100 mod 7=2 → Wednesday."},
    {"id": "B5", "name": "Digit Sum Divisibility",        "description": "Digit sum divisible by 9 → number divisible by 9."},
    {"id": "B6", "name": "Pigeonhole Principle",          "description": "N items in fewer than N boxes → at least one box has 2+ items."},
    {"id": "C1", "name": "Chunking",                      "description": "Break numbers into tens+units. E.g. 47+38: 47+30=77, +8=85."},
    {"id": "C2", "name": "Complement to 100",             "description": "Every number has a partner summing to 100. E.g. 63+37=100."},
    {"id": "C3", "name": "Benchmark Numbers",             "description": "Anchor to 10,25,50,100. E.g. 97+36: go to 100, add 36, subtract 3=133."},
    {"id": "C4", "name": "Near-Doubles",                  "description": "6+7=6+6+1=13. Reduces addition to a known double plus 1."},
    {"id": "C5", "name": "×5 via Half-of-Ten",            "description": "5×n=(10×n)÷2. E.g. 5×18=180÷2=90."},
    {"id": "C6", "name": "Estimation and Bounds",         "description": "Bracket the answer before computing. E.g. 47×52≈50×50=2500."},
    {"id": "C7", "name": "Left-to-Right Multiplication",  "description": "Most significant digit first. E.g. 3×47: 3×40=120, +21=141."},
    {"id": "D1", "name": "Symmetry and Half-Double",      "description": "Count one side, double it. E.g. (a+b)+(a−b)=2a."},
    {"id": "D2", "name": "State Transitions",             "description": "Track net change per step to jump to end state."},
    {"id": "D3", "name": "Balance/Equilibrium",           "description": "Equation as a scale. Same operation both sides preserves balance."},
    {"id": "D4", "name": "Geometric Series Intuition",    "description": "1+2+4+…(n steps from 1) = 2ⁿ−1."},
    {"id": "D5", "name": "Triangular Numbers",            "description": "1+2+…+n = n(n+1)÷2. E.g. 6 people handshakes=15."},
]

# ---------------------------------------------------------------------------
# System prompt template
# The placeholder {INSERT_FILTERED_TRICK_LINES} is replaced at runtime
# with the filtered trick lines for this child. Everything else is static.
# ---------------------------------------------------------------------------

# str — static system prompt; trick lines injected at call time to keep this cacheable
BASE_SYSTEM_PROMPT = """\
You are a friendly math learning coach writing a progress report for a parent
whose child plays a math game. The game teaches children mental math strategies
called "tricks" — named shortcuts that replace slow calculation with elegant thinking.

You will receive a JSON object with the child's recent activity data.
Your job is to interpret that data and write a warm, clear, specific report.

---

TRICK REFERENCE (only tricks this child has encountered):
{INSERT_FILTERED_TRICK_LINES}

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
- Write the child's name naturally — do not repeat it in every sentence.\
"""
