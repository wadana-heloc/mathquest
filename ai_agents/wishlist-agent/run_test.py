# run_test.py
# Manual end-to-end test for the MathQuest wishlist pricing service.
# Run with: python run_test.py
# Uses the real Anthropic API — make sure ANTHROPIC_API_KEY is set in .env.
#
# Runs five scenarios that span the full cost-band range:
#   1. Food wish      — "Pizza night with family", grade 4  → expect Medium (800–1500, food)
#   2. Screen time    — "30 min tablet time", grade 2       → expect Small  (200–500,  screen_time)
#   3. Toy            — "LEGO Technic car set", grade 6     → expect Large  (2000–5000, toy)
#   4. Experience     — "Trip to trampoline park", grade 3  → expect Medium (800–1500,  experience)
#   5. Vague wish     — "Something special", grade 5        → see how Claude handles ambiguity
# Plus two edge-case checks:
#   6. Long title     — 200-char title (truncated to 120 before Claude sees it)
#   7. Empty title    — triggers fallback without calling Claude
#
# FAILURE VISIBILITY: if any scenario unexpectedly returns the fallback (cost=500,
# category="other"), it is flagged as [FALLBACK] in the output and the full
# exception traceback is printed by wishlist_agent.py to stderr so you can debug it.

import sys
import io
import logging
from fastapi.testclient import TestClient
from main import app

# Force UTF-8 so em-dashes and quotes in reasoning print correctly on Windows cp1252 terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# Show wishlist_agent log output (exception tracebacks) in the terminal
logging.basicConfig(stream=sys.stderr, level=logging.ERROR,
                    format="%(levelname)s %(name)s — %(message)s")

# TestClient — drives the real FastAPI app; no mocks, so the Anthropic client is real
http = TestClient(app)

# tuple — the two field values that identify the fallback response
_FALLBACK_COST     = 500
_FALLBACK_CATEGORY = "other"


# ---------------------------------------------------------------------------
# Scenario helpers
# ---------------------------------------------------------------------------

def _post(wish_id: str, title: str, grade: int) -> dict:
    # What: sends one POST request to /internal/price-wish and returns the parsed body.
    # Return: dict — wish_id, cost, category, reasoning
    # Example input: "id-001", "Pizza night", 4
    # Example output: {"wish_id": "id-001", "cost": 1200, "category": "food", "reasoning": "..."}

    # dict — HTTP request body
    payload = {"wish_id": wish_id, "title": title, "grade": grade}
    # requests.Response — always HTTP 200 per the always-200 contract
    response = http.post("/internal/price-wish", json=payload)
    return response.json()


def _is_fallback(body: dict) -> bool:
    # What: returns True if the response looks like the error fallback.
    # Return: bool — True when cost==500 AND category=="other"
    # This combination only appears when the service hit an unexpected exception.
    # Example input: {"cost": 500, "category": "other", "reasoning": "Pricing unavailable..."}
    # Example output: True
    return body["cost"] == _FALLBACK_COST and body["category"] == _FALLBACK_CATEGORY


def _print_result(label: str, title: str, grade: int, body: dict,
                  expect_fallback: bool = False) -> None:
    # What: pretty-prints one scenario result with a labelled header.
    #       Prints a [FALLBACK] warning when an unexpected fallback is detected
    #       so failures are immediately visible rather than silently hidden.
    # Return: None — side-effect only
    # Example input: "Scenario 1", "Pizza night", 4, {"cost": 1200, "category": "food", ...}
    # Example output: prints the scenario header, input, and Claude's pricing to stdout

    # str — visual separator between scenarios
    separator = "=" * 72

    print(f"\n{separator}")
    print(f"  {label}")
    print(separator)
    # str — input summary so it's easy to judge whether the output makes sense
    print(f"  Title : {title!r}  |  Grade: {grade}")

    # bool — whether this response is the error fallback
    got_fallback = _is_fallback(body)

    if got_fallback and not expect_fallback:
        # Unexpected fallback — the service hit an exception.
        # The full traceback is already printed to stderr by wishlist_agent.py.
        print(f"  [FALLBACK] cost={body['cost']}  category={body['category']}")
        print(f"  [FALLBACK] UNEXPECTED — Claude call failed. See traceback above (stderr).")
    else:
        print(f"  Cost  : {body['cost']} coins  |  Category: {body['category']}")
        print(f"  Why   : {body['reasoning']}")
        if got_fallback and expect_fallback:
            print(f"  (fast-path fallback as expected — no Claude call made)")

    print()


# ---------------------------------------------------------------------------
# Scenario 1 — Food / meal-out wish (Medium band expected)
# Grade 4 child wants a pizza night with the family.
# "Meal out" sits in the Medium band (800–1500 coins, 3–5 days of play).
# ---------------------------------------------------------------------------

SCENARIO_1_ID    = "wish-001"
SCENARIO_1_TITLE = "Pizza night with the family"
SCENARIO_1_GRADE = 4

# ---------------------------------------------------------------------------
# Scenario 2 — Screen time wish (Small band expected)
# Grade 2 child wants extra tablet time. Small-band (200–500 coins, 1–2 days).
# ---------------------------------------------------------------------------

SCENARIO_2_ID    = "wish-002"
SCENARIO_2_TITLE = "30 extra minutes of tablet time"
SCENARIO_2_GRADE = 2

# ---------------------------------------------------------------------------
# Scenario 3 — Toy wish (Large band expected)
# Grade 6 child wants an expensive LEGO set (2000–5000 coins, 1–3 weeks).
# ---------------------------------------------------------------------------

SCENARIO_3_ID    = "wish-003"
SCENARIO_3_TITLE = "LEGO Technic supercar set"
SCENARIO_3_GRADE = 6

# ---------------------------------------------------------------------------
# Scenario 4 — Experience wish (Medium band expected)
# Grade 3 child wants a group outing (800–1500 coins, 3–5 days).
# ---------------------------------------------------------------------------

SCENARIO_4_ID    = "wish-004"
SCENARIO_4_TITLE = "Trip to the trampoline park with two friends"
SCENARIO_4_GRADE = 3

# ---------------------------------------------------------------------------
# Scenario 5 — Vague wish (ambiguity test)
# Grade 5 child typed something non-specific. Claude should still return valid
# JSON with a sensible cost — not crash or fallback.
# ---------------------------------------------------------------------------

SCENARIO_5_ID    = "wish-005"
SCENARIO_5_TITLE = "Something special and fun"
SCENARIO_5_GRADE = 5

# ---------------------------------------------------------------------------
# Scenario 6 — Long title edge case
# Title is 200 characters; the service truncates to 120 before calling Claude.
# Must return HTTP 200 without an exception.
# ---------------------------------------------------------------------------

SCENARIO_6_ID    = "wish-006"
SCENARIO_6_TITLE = "I really want a brand new gaming console with extra controllers " * 4
SCENARIO_6_GRADE = 5

# ---------------------------------------------------------------------------
# Scenario 7 — Empty title (fast-path fallback, no API call expected)
# ---------------------------------------------------------------------------

SCENARIO_7_ID    = "wish-007"
SCENARIO_7_TITLE = ""
SCENARIO_7_GRADE = 3


# ---------------------------------------------------------------------------
# Run all scenarios
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("MathQuest Wishlist Pricing Service — end-to-end test")
    print("Calling Claude API for scenarios 1–6. Scenario 7 is the fast-path fallback.")
    print("Any unexpected fallback is flagged [FALLBACK] and the traceback appears on stderr.\n")

    # dict — Scenario 1 result
    r1 = _post(SCENARIO_1_ID, SCENARIO_1_TITLE, SCENARIO_1_GRADE)
    _print_result("Scenario 1 — Meal-out wish (Medium band expected)",
                  SCENARIO_1_TITLE, SCENARIO_1_GRADE, r1)

    # dict — Scenario 2 result
    r2 = _post(SCENARIO_2_ID, SCENARIO_2_TITLE, SCENARIO_2_GRADE)
    _print_result("Scenario 2 — Screen time (Small band expected)",
                  SCENARIO_2_TITLE, SCENARIO_2_GRADE, r2)

    # dict — Scenario 3 result
    r3 = _post(SCENARIO_3_ID, SCENARIO_3_TITLE, SCENARIO_3_GRADE)
    _print_result("Scenario 3 — Toy wish (Large band expected)",
                  SCENARIO_3_TITLE, SCENARIO_3_GRADE, r3)

    # dict — Scenario 4 result
    r4 = _post(SCENARIO_4_ID, SCENARIO_4_TITLE, SCENARIO_4_GRADE)
    _print_result("Scenario 4 — Experience wish (Medium band expected)",
                  SCENARIO_4_TITLE, SCENARIO_4_GRADE, r4)

    # dict — Scenario 5 result
    r5 = _post(SCENARIO_5_ID, SCENARIO_5_TITLE, SCENARIO_5_GRADE)
    _print_result("Scenario 5 — Vague wish (ambiguity test)",
                  SCENARIO_5_TITLE, SCENARIO_5_GRADE, r5)

    # dict — Scenario 6 result (long title — truncated, not a fallback)
    r6 = _post(SCENARIO_6_ID, SCENARIO_6_TITLE, SCENARIO_6_GRADE)
    _print_result(
        f"Scenario 6 — Long title ({len(SCENARIO_6_TITLE)} chars, truncated to 120)",
        SCENARIO_6_TITLE[:50] + "...",
        SCENARIO_6_GRADE,
        r6,
    )

    # dict — Scenario 7 result (fast-path fallback — expected, no Claude call)
    r7 = _post(SCENARIO_7_ID, SCENARIO_7_TITLE, SCENARIO_7_GRADE)
    _print_result("Scenario 7 — Empty title (fallback expected)",
                  "(empty)", SCENARIO_7_GRADE, r7, expect_fallback=True)

    # ---------------------------------------------------------------------------
    # Summary assertions
    # ---------------------------------------------------------------------------

    print("=" * 72)
    print("  Sanity checks")
    print("=" * 72)

    # bool — True when cost and category match the fallback exactly
    s1_unexpected_fallback = _is_fallback(r1)
    s2_unexpected_fallback = _is_fallback(r2)
    s3_unexpected_fallback = _is_fallback(r3)
    s4_unexpected_fallback = _is_fallback(r4)
    s5_unexpected_fallback = _is_fallback(r5)
    s6_unexpected_fallback = _is_fallback(r6)

    # list[tuple[str, bool]] — (label, passed)
    checks = [
        ("S1 no unexpected fallback",  not s1_unexpected_fallback),
        ("S1 cost in Medium band",     800 <= r1["cost"] <= 1500),
        ("S1 category is food",        r1["category"] == "food"),
        ("S2 no unexpected fallback",  not s2_unexpected_fallback),
        ("S2 cost in Small band",      200 <= r2["cost"] <= 500),
        ("S3 no unexpected fallback",  not s3_unexpected_fallback),
        ("S3 cost in Large band",      2000 <= r3["cost"] <= 5000),
        ("S3 category is toy",         r3["category"] == "toy"),
        ("S4 no unexpected fallback",  not s4_unexpected_fallback),
        ("S4 cost in Medium band",     800 <= r4["cost"] <= 1500),
        ("S5 no unexpected fallback",  not s5_unexpected_fallback),
        ("S6 no unexpected fallback",  not s6_unexpected_fallback),
        ("S7 cost is 500 (expected fallback)", r7["cost"] == 500),
        ("S7 category is other",       r7["category"] == "other"),
    ]

    # int — number of checks that passed
    passed = 0
    for label, ok in checks:
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        print(f"  [{status}]  {label}")

    print(f"\n  {passed}/{len(checks)} checks passed.\n")

    if passed < len(checks):
        print("  Some checks failed. If any show [FALLBACK] above, the traceback")
        print("  has already been printed to stderr by wishlist_agent.py.\n")
