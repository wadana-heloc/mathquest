# run_test.py
# Quick manual test for the full MathQuest pipeline.
# Run with: python run_test.py
# Uses the real Anthropic API — make sure ANTHROPIC_API_KEY is set in .env.

import json
from schemas import ChildProfileInput
from orchestrator import run_pipeline


# dict — sample child profile matching the ChildProfileInput schema
sample_input = {
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
            "avg_time_per_problem_ms": 4200,
        },
    },
    "recent_problems": [
        {
            "trick_id": "A2",
            "problem": "9 × 8 = ?",
            "solved": True,
            "hints_used": 0,
            "difficulty": 4,
            "duration_ms": 1800,
            "insight_detected": True,
            "attempts": 1,
        },
        {
            "trick_id": "A1",
            "problem": "11 × 14 = ?",
            "solved": True,
            "hints_used": 1,
            "difficulty": 4,
            "duration_ms": 5200,
            "insight_detected": False,
            "attempts": 2,
        },
    ],
}

# ChildProfileInput — validated input object
child_profile = ChildProfileInput(**sample_input)

print("Running pipeline...\n")

# dict — the generated and reviewed problem, internal fields already stripped
result = run_pipeline(child_profile)

print(json.dumps(result, indent=2))
