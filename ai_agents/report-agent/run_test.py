# run_test.py
# Manual end-to-end test for the MathQuest report agent.
# Run with: python run_test.py
# Uses the real Anthropic API — make sure ANTHROPIC_API_KEY is set in .env
# and MOCK_API=false (or unset).
#
# Runs three scenarios:
#   1. Strong child   — high accuracy, unlocked tricks, improving trend
#   2. Struggling child — weak in multiple categories, declining trend
#   3. Sparse data    — fewer than 10 attempts; agent skips the API entirely

import sys
import io
import json
from report_agent import generate_report

# Force UTF-8 output so Unicode characters in reports (e.g. minus sign −) print correctly
# on Windows terminals that default to cp1252.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ---------------------------------------------------------------------------
# Scenario helpers
# ---------------------------------------------------------------------------

def _print_result(label: str, result: dict) -> None:
    # What: pretty-prints the result of one generate_report() call with a labelled header.
    # Return: None — side-effect only
    # Example input: "Scenario 1", {"report": "**What's Going Well**\n..."}
    # Example output: prints the scenario header and report (or reason) to stdout

    # str — visual separator between scenarios
    separator = "=" * 72

    print(f"\n{separator}")
    print(f"  {label}")
    print(separator)

    # bool — whether the API returned a report or a reason
    if result["report"] is not None:
        print(result["report"])
    else:
        # str — reason why no report was generated
        reason = result.get("reason", "unknown")
        print(f"[No report generated — reason: {reason}]")

    print()


# ---------------------------------------------------------------------------
# Scenario 1 — Strong child
# Yusuf, 9 y/o, grade 3. Strong arithmetic, pattern improving, two unlocked
# tricks, good streak, improving trend. Expect a positive, strengths-forward
# report with encouraging tips around the one in-progress trick.
# ---------------------------------------------------------------------------

# dict — payload for a high-performing child
SCENARIO_1 = {
    "child": {
        "name": "Yusuf",
        "age": 9,
        "grade": 3,
        "zone": 3,
        "current_difficulty": 6,
        "difficulty_ceiling": 9,
        "streak_current": 12,
        "streak_best": 15,
    },
    "period_days": 30,
    "overall": {
        "attempts": 104,
        "accuracy": 0.84,
        "avg_seconds": 18,
        "avg_hints_per_problem": 0.2,
    },
    "by_category": [
        {"category": "arithmetic", "attempts": 45, "accuracy": 0.93, "avg_seconds": 10},
        {"category": "pattern",    "attempts": 35, "accuracy": 0.80, "avg_seconds": 20},
        {"category": "mental",     "attempts": 24, "accuracy": 0.71, "avg_seconds": 28},
    ],
    "difficulty_curve": [
        {"level": 3, "attempts": 20, "accuracy": 0.95},
        {"level": 4, "attempts": 38, "accuracy": 0.90},
        {"level": 5, "attempts": 30, "accuracy": 0.80},
        {"level": 6, "attempts": 16, "accuracy": 0.69},
    ],
    "tricks": {
        "unlocked": ["A3", "C5", "C1", "B1"],
        "in_progress": [
            {"id": "A2", "name": "×9 Complement Rule", "phase": "practice", "accuracy": 0.67}
        ],
        "not_yet_started": 20,
    },
    "struggled_problems": [
        {"stem": "9 × 7 = ?",  "category": "mental",   "difficulty": 5, "hints_used": 1, "failed_twice": False},
        {"stem": "9 × 13 = ?", "category": "pattern",  "difficulty": 6, "hints_used": 2, "failed_twice": True},
    ],
    "trend": "improving",
}


# ---------------------------------------------------------------------------
# Scenario 2 — Struggling child
# Layla, 8 y/o, grade 2. Low accuracy in pattern and invariant, no unlocked
# tricks yet, high hint usage, declining trend. Expect a constructive report
# that names specific weak spots and gives targeted parent tips.
# ---------------------------------------------------------------------------

# dict — payload for a child who is finding the game difficult
SCENARIO_2 = {
    "child": {
        "name": "Layla",
        "age": 8,
        "grade": 2,
        "zone": 1,
        "current_difficulty": 3,
        "difficulty_ceiling": 5,
        "streak_current": 1,
        "streak_best": 4,
    },
    "period_days": 30,
    "overall": {
        "attempts": 62,
        "accuracy": 0.51,
        "avg_seconds": 41,
        "avg_hints_per_problem": 1.8,
    },
    "by_category": [
        {"category": "arithmetic", "attempts": 28, "accuracy": 0.75, "avg_seconds": 22},
        {"category": "pattern",    "attempts": 20, "accuracy": 0.35, "avg_seconds": 55},
        {"category": "invariant",  "attempts": 14, "accuracy": 0.29, "avg_seconds": 68},
    ],
    "difficulty_curve": [
        {"level": 1, "attempts": 18, "accuracy": 0.83},
        {"level": 2, "attempts": 25, "accuracy": 0.60},
        {"level": 3, "attempts": 19, "accuracy": 0.32},
    ],
    "tricks": {
        "unlocked": [],
        "in_progress": [
            {"id": "A1", "name": "×11 Digit-Sum Rule", "phase": "discovery", "accuracy": None},
            {"id": "C4", "name": "Near-Doubles",        "phase": "practice",  "accuracy": 0.40},
        ],
        "not_yet_started": 23,
    },
    "struggled_problems": [
        {"stem": "What is 11 × 23?",       "category": "pattern",   "difficulty": 3, "hints_used": 3, "failed_twice": True},
        {"stem": "What is 11 × 34?",       "category": "pattern",   "difficulty": 3, "hints_used": 2, "failed_twice": True},
        {"stem": "Is 81 odd or even?",     "category": "invariant", "difficulty": 2, "hints_used": 2, "failed_twice": False},
        {"stem": "7 + 8 using near-doubles?", "category": "mental", "difficulty": 2, "hints_used": 1, "failed_twice": False},
    ],
    "trend": "declining",
}


# ---------------------------------------------------------------------------
# Scenario 3 — Sparse data (guard test)
# Only 6 attempts — below the 10-attempt minimum. The agent must return
# {report: None, reason: "not_enough_data"} without calling the API.
# ---------------------------------------------------------------------------

# dict — payload with too few attempts to generate a meaningful report
SCENARIO_3 = {
    "child": {
        "name": "Omar",
        "age": 10,
        "grade": 4,
        "zone": 1,
        "current_difficulty": 2,
        "difficulty_ceiling": 6,
        "streak_current": 2,
        "streak_best": 2,
    },
    "period_days": 30,
    "overall": {
        "attempts": 6,
        "accuracy": 0.67,
        "avg_seconds": 30,
        "avg_hints_per_problem": 0.5,
    },
    "by_category": [
        {"category": "arithmetic", "attempts": 6, "accuracy": 0.67, "avg_seconds": 30},
    ],
    "difficulty_curve": [
        {"level": 2, "attempts": 6, "accuracy": 0.67},
    ],
    "tricks": {
        "unlocked": [],
        "in_progress": [],
        "not_yet_started": 25,
    },
    "struggled_problems": [
        {"stem": "14 + 9 = ?", "category": "arithmetic", "difficulty": 2, "hints_used": 0, "failed_twice": False},
        {"stem": "23 + 8 = ?", "category": "arithmetic", "difficulty": 2, "hints_used": 1, "failed_twice": False},
    ],
    "trend": "stable",
}


# ---------------------------------------------------------------------------
# Run all scenarios
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("MathQuest Report Agent — end-to-end test")
    print("Calling Claude API for scenarios 1 and 2. Scenario 3 is a guard test (no API call).\n")

    # dict — result for Yusuf (strong child)
    result_1 = generate_report(SCENARIO_1)
    _print_result("Scenario 1 — Strong child (Yusuf)", result_1)

    # dict — result for Layla (struggling child)
    result_2 = generate_report(SCENARIO_2)
    _print_result("Scenario 2 — Struggling child (Layla)", result_2)

    # dict — result for Omar (sparse data — no API call expected)
    result_3 = generate_report(SCENARIO_3)
    _print_result("Scenario 3 — Sparse data guard (Omar)", result_3)
