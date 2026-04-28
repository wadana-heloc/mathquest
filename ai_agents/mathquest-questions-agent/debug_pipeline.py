# debug_pipeline.py
# Temporary debug script — calls Agent 1 directly without catching exceptions
# so we can see exactly what is failing.
# Delete this file once the pipeline is confirmed working.

import os
import json
from dotenv import load_dotenv
import anthropic
from agent_generator import _build_system_prompt, _build_user_message, _MOCK_PROBLEM_FIXTURE
from schemas import ChildProfileInput

load_dotenv()

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
    "recent_problems": [],
}

child_profile = ChildProfileInput(**sample_input)

api_key = os.getenv("ANTHROPIC_API_KEY")
print(f"API key present: {bool(api_key)}")
print(f"API key prefix: {api_key[:15]}..." if api_key else "NO KEY")

client = anthropic.Anthropic(api_key=api_key)
system_blocks = _build_system_prompt()
user_text = _build_user_message(child_profile, 4, ["A1", "A2"])

print("\nCalling Agent 1 (no try/except)...\n")

response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=600,
    system=system_blocks,
    messages=[{"role": "user", "content": user_text}],
)

raw_text = response.content[0].text.strip()
print("Raw response:")
print(raw_text)

# Strip markdown fences if the model wrapped the JSON (same fix as agent_generator.py)
if raw_text.startswith("```"):
    raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

print("\nParsed JSON:")
print(json.dumps(json.loads(raw_text), indent=2))
